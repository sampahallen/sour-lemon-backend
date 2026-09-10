import { randomBytes } from 'node:crypto'
import type { RequestHandler } from 'express'
import { UniqueConstraintError } from 'sequelize'
import { sequelize } from '../config/database.js'
import { Order } from '../models/Order.js'
import { Payment } from '../models/Payment.js'
import { PaymentEvent } from '../models/PaymentEvent.js'
import { applyVerifiedPaystackTransaction } from '../services/paymentService.js'
import {
  hasValidPaystackSignature,
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from '../services/paystackService.js'
import { getOrderReceipt, requireOrderAccess } from '../services/orderService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'

const requirePaymentAccess = async (request: Parameters<RequestHandler>[0], paymentId: string) => {
  const payment = await Payment.findByPk(paymentId)
  if (!payment || payment.provider !== 'paystack') throw new HttpError(404, 'Payment not found')
  const order = await Order.findByPk(payment.orderId)
  if (!order) throw new HttpError(404, 'Order not found')
  requireOrderAccess(request, order)
  return { payment, order }
}

export const verifyPayment = asyncHandler(async (request, response) => {
  const { payment, order } = await requirePaymentAccess(request, request.params.paymentId)
  if (!payment.providerReference) throw new HttpError(409, 'Payment has not been initialized')
  const verified = await verifyPaystackTransaction(payment.providerReference)
  await applyVerifiedPaystackTransaction(payment.id, verified)
  await order.reload()
  response.json({ order: await getOrderReceipt(order) })
})

export const resumeOrRetryPayment = asyncHandler(async (request, response) => {
  const order = await Order.findByPk(request.params.orderId)
  if (!order) throw new HttpError(404, 'Order not found')
  requireOrderAccess(request, order)
  if (!['received', 'pending_payment'].includes(order.status)) {
    throw new HttpError(409, 'This order is not awaiting payment')
  }
  if (order.paymentStatus === 'paid') throw new HttpError(409, 'This order has already been paid')
  if (!order.customerEmail) throw new HttpError(409, 'This order does not have a payment email')

  const latest = await Payment.findOne({ where: { orderId: order.id }, order: [['createdAt', 'DESC']] })
  if (!latest || latest.provider !== 'paystack' || latest.method === 'cash') {
    throw new HttpError(409, 'This order cannot be paid online')
  }
  if (latest.status === 'pending' && latest.providerAccessCode) {
    response.json({ payment: { id: latest.id, status: latest.status, accessCode: latest.providerAccessCode } })
    return
  }

  const payment = await sequelize.transaction(async (transaction) => {
    const lockedOrder = await Order.findByPk(order.id, { transaction, lock: transaction.LOCK.UPDATE })
    if (!lockedOrder || lockedOrder.paymentStatus === 'paid') {
      throw new HttpError(409, 'This order has already been paid')
    }
    const created = await Payment.create({
      orderId: lockedOrder.id,
      provider: 'paystack',
      method: latest.method,
      status: 'pending',
      amount: lockedOrder.total,
      currency: lockedOrder.currency,
      providerReference: `SLP-${randomBytes(12).toString('hex')}`,
      checkoutUrl: null,
      providerAccessCode: null,
      failureCode: null,
      failureMessage: null,
      paidAt: null,
      requiresManualConfirmation: latest.requiresManualConfirmation,
      adminConfirmedAt: null,
      adminConfirmedByUserId: null,
      providerData: null,
    }, { transaction })
    const initialized = await initializePaystackTransaction({
      email: lockedOrder.customerEmail!,
      amountCents: Math.round(Number(lockedOrder.total) * 100),
      currency: lockedOrder.currency,
      reference: created.providerReference!,
      method: latest.method as 'card' | 'momo',
      orderId: lockedOrder.id,
      orderNumber: lockedOrder.orderNumber,
    })
    await created.update({
      providerReference: initialized.reference,
      checkoutUrl: initialized.checkoutUrl,
      providerAccessCode: initialized.accessCode,
    }, { transaction })
    await lockedOrder.update({ paymentStatus: 'pending' }, { transaction })
    return created
  })
  response.status(201).json({
    payment: { id: payment.id, status: payment.status, accessCode: payment.providerAccessCode },
  })
})

interface PaystackWebhookBody {
  event?: string
  data?: { id?: number; reference?: string }
}

export const paystackWebhook: RequestHandler = async (request, response, next) => {
  const rawBody = Buffer.isBuffer(request.body) ? request.body : null
  if (!rawBody || !hasValidPaystackSignature(rawBody, request.header('x-paystack-signature'))) {
    response.status(401).json({ error: 'Invalid webhook signature' })
    return
  }

  let body: PaystackWebhookBody
  try {
    body = JSON.parse(rawBody.toString('utf8')) as PaystackWebhookBody
  } catch {
    response.status(400).json({ error: 'Invalid webhook payload' })
    return
  }
  const eventType = body.event ?? 'unknown'
  const reference = body.data?.reference
  const eventKey = `${eventType}:${body.data?.id ?? reference ?? createEventFallback(rawBody)}`

  let event: PaymentEvent
  try {
    event = await PaymentEvent.create({
      paymentId: null,
      provider: 'paystack',
      eventKey,
      eventType,
      payload: { reference: reference ?? null, transactionId: body.data?.id ?? null },
      processedAt: null,
      processingError: null,
    })
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const existing = await PaymentEvent.findOne({ where: { eventKey } })
      if (!existing || existing.processedAt) {
        response.status(200).json({ received: true })
        return
      }
      event = existing
    } else {
      next(error)
      return
    }
  }

  try {
    if (eventType === 'charge.success' && reference) {
      const payment = await Payment.findOne({ where: { providerReference: reference, provider: 'paystack' } })
      if (!payment) throw new HttpError(404, 'Payment reference not found')
      await event.update({ paymentId: payment.id })
      const verified = await verifyPaystackTransaction(reference)
      await applyVerifiedPaystackTransaction(payment.id, verified)
    }
    await event.update({ processedAt: new Date(), processingError: null })
    response.status(200).json({ received: true })
  } catch (error) {
    await event.update({ processingError: error instanceof Error ? error.message : 'Processing failed' })
    next(error)
  }
}

const createEventFallback = (rawBody: Buffer) =>
  randomBytes(8).toString('hex') + rawBody.length.toString(16)
