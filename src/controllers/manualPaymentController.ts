import { randomBytes } from 'node:crypto'
import type { Request } from 'express'
import { Op, UniqueConstraintError } from 'sequelize'
import { sequelize } from '../config/database.js'
import { CustomCakeRequest } from '../models/CustomCakeRequest.js'
import { Order } from '../models/Order.js'
import { Payment } from '../models/Payment.js'
import { PaymentProof } from '../models/PaymentProof.js'
import { getOrderReceipt, requireOrderAccess } from '../services/orderService.js'
import { cakePaymentUrl, getMomoDetails, proofResponse, requireCakePaymentLink } from '../services/manualPaymentService.js'
import { deletePaymentProofImage, readPaymentProofImage, savePaymentProofImage } from '../services/paymentProofStorage.js'
import { publishOrderChanged } from '../services/orderEvents.js'
import { publishOperationChanged } from '../services/operationEvents.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'

const referenceFromRequest = (request: Request) => {
  const reference = typeof request.body?.reference === 'string' ? request.body.reference.trim() : ''
  if (reference.length > 160) throw new HttpError(400, 'Reference is too long')
  if (!reference && !request.file) throw new HttpError(400, 'Enter a transaction reference or upload a screenshot')
  return reference || null
}

const latestOrderPayment = (orderId: string) => Payment.findOne({ where: { orderId }, order: [['createdAt', 'DESC']] })
const proofsFor = (target: { paymentId?: string; customCakeRequestId?: string }) =>
  PaymentProof.findAll({ where: target, order: [['createdAt', 'DESC']] })

const requireCakeMomoConfiguration = async () => {
  try {
    await getMomoDetails()
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 503) throw error
    throw new HttpError(409, 'Set the Mobile Money number, recipient name, and network in Settings before creating a payment link')
  }
}

const createProof = async (target: { paymentId: string | null; customCakeRequestId: string | null }, request: Request) => {
  const reference = referenceFromRequest(request)
  const storageKey = request.file ? await savePaymentProofImage(request.file) : null
  try {
    return await sequelize.transaction(async (transaction) => {
      if (target.paymentId) {
        const payment = await Payment.findByPk(target.paymentId, { transaction, lock: transaction.LOCK.UPDATE })
        if (!payment || payment.provider !== 'manual_momo' || payment.status !== 'pending') throw new HttpError(409, 'Payment is no longer pending')
      }
      if (target.customCakeRequestId) {
        const cake = await CustomCakeRequest.findByPk(target.customCakeRequestId, { transaction, lock: transaction.LOCK.UPDATE })
        if (!cake || !['quoted', 'awaiting_payment'].includes(cake.status) ||
          (cake.quoteExpiresAt && cake.quoteExpiresAt <= new Date())) throw new HttpError(409, 'This quote is no longer payable')
        if (cake.status === 'quoted') await cake.update({ status: 'awaiting_payment' }, { transaction })
      }
      const previous = await PaymentProof.findOne({ where: target.paymentId ? { paymentId: target.paymentId } : { customCakeRequestId: target.customCakeRequestId }, order: [['createdAt', 'DESC']], transaction })
      if (previous?.status === 'submitted') throw new HttpError(409, 'Your proof is already awaiting review')
      return PaymentProof.create({
        ...target, reference, storageKey, imageType: request.file?.mimetype ?? null,
        status: 'submitted', rejectionReason: null, reviewedByUserId: null, reviewedAt: null,
      }, { transaction })
    })
  } catch (error) {
    if (storageKey) await deletePaymentProofImage(storageKey).catch(() => undefined)
    throw error
  }
}

export const submitOrderProof = asyncHandler(async (request, response) => {
  const order = await Order.findByPk(request.params.id)
  if (!order) throw new HttpError(404, 'Order not found')
  requireOrderAccess(request, order)
  const payment = await latestOrderPayment(order.id)
  if (!payment || payment.provider !== 'manual_momo' || payment.status !== 'pending' || order.status === 'cancelled') {
    throw new HttpError(409, 'This order is not awaiting Mobile Money proof')
  }
  await getMomoDetails()
  const proof = await createProof({ paymentId: payment.id, customCakeRequestId: null }, request)
  publishOrderChanged({ orderId: order.id, reason: 'payment_updated' })
  publishOperationChanged({ area: 'proofs', id: proof.id, reason: 'created' })
  response.status(201).json({ proof: proofResponse(proof), order: await getOrderReceipt(order) })
})

export const getOrderProofs = asyncHandler(async (request, response) => {
  const order = await Order.findByPk(request.params.id)
  if (!order) throw new HttpError(404, 'Order not found')
  requireOrderAccess(request, order)
  const payment = await latestOrderPayment(order.id)
  response.json({ proofs: payment?.provider === 'manual_momo' ? (await proofsFor({ paymentId: payment.id })).map(proofResponse) : [] })
})

export const getCakePayment = asyncHandler(async (request, response) => {
  const cake = await CustomCakeRequest.findByPk(request.params.id)
  if (!cake) throw new HttpError(404, 'Payment link not found')
  requireCakePaymentLink(cake, request.params.token)
  const quotePayable = ['quoted', 'awaiting_payment'].includes(cake.status) && !!cake.quotedAmount &&
    (!cake.quoteExpiresAt || cake.quoteExpiresAt > new Date())
  let momo = null
  let paymentConfigurationMissing = false
  if (quotePayable) {
    try {
      momo = await getMomoDetails()
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 503) throw error
      paymentConfigurationMissing = true
    }
  }
  response.json({
    cake: { id: cake.id, occasion: cake.occasion, quotedAmount: cake.quotedAmount, currency: cake.currency, status: cake.status, quoteExpiresAt: cake.quoteExpiresAt },
    payable: quotePayable && !paymentConfigurationMissing,
    paymentConfigurationMissing,
    momo,
    proofs: (await proofsFor({ customCakeRequestId: cake.id })).map(proofResponse),
  })
})

export const submitCakeProof = asyncHandler(async (request, response) => {
  const cake = await CustomCakeRequest.findByPk(request.params.id)
  if (!cake) throw new HttpError(404, 'Payment link not found')
  requireCakePaymentLink(cake, request.params.token)
  if (!['quoted', 'awaiting_payment'].includes(cake.status) || !cake.quotedAmount ||
    (cake.quoteExpiresAt && cake.quoteExpiresAt <= new Date())) throw new HttpError(409, 'This quote is no longer payable')
  await getMomoDetails()
  const proof = await createProof({ paymentId: null, customCakeRequestId: cake.id }, request)
  publishOperationChanged({ area: 'proofs', id: proof.id, reason: 'created' })
  publishOperationChanged({ area: 'cakes', id: cake.id, reason: 'updated' })
  response.status(201).json({ proof: proofResponse(proof) })
})

export const getCakePaymentLink = asyncHandler(async (request, response) => {
  const cake = await CustomCakeRequest.findByPk(request.params.id)
  if (!cake) throw new HttpError(404, 'Custom cake request not found')
  if (!cake.quotedAmount || !['quoted', 'awaiting_payment'].includes(cake.status)) throw new HttpError(409, 'Quote the cake first')
  await requireCakeMomoConfiguration()
  if (!cake.paymentLinkNonce) {
    await cake.update({ paymentLinkNonce: randomBytes(32).toString('hex') })
    publishOperationChanged({ area: 'cakes', id: cake.id, reason: 'updated' })
  }
  response.json({ url: cakePaymentUrl(cake) })
})

export const revokeCakePaymentLink = asyncHandler(async (request, response) => {
  const cake = await CustomCakeRequest.findByPk(request.params.id)
  if (!cake) throw new HttpError(404, 'Custom cake request not found')
  if (!['quoted', 'awaiting_payment'].includes(cake.status)) throw new HttpError(409, 'Payment link cannot be changed')
  await requireCakeMomoConfiguration()
  await cake.update({ paymentLinkNonce: randomBytes(32).toString('hex') })
  publishOperationChanged({ area: 'cakes', id: cake.id, reason: 'updated' })
  response.json({ url: cakePaymentUrl(cake) })
})

export const getAdminProofs = asyncHandler(async (request, response) => {
  const page = Number(request.query.page ?? 1)
  if (!Number.isInteger(page) || page < 1) throw new HttpError(400, 'Invalid page')
  const limit = 25
  const { count, rows: proofs } = await PaymentProof.findAndCountAll({
    where: { status: 'submitted' }, order: [['createdAt', 'ASC']], limit, offset: (page - 1) * limit,
  })
  const payments = await Payment.findAll({ where: { id: proofs.map((proof) => proof.paymentId).filter((id): id is string => !!id) } })
  const orderByPayment = new Map(payments.map((payment) => [payment.id, payment.orderId]))
  response.json({
    proofs: proofs.map((proof) => ({ ...proofResponse(proof), orderId: proof.paymentId ? orderByPayment.get(proof.paymentId) ?? null : null, customCakeRequestId: proof.customCakeRequestId })),
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  })
})

export const getProofImage = asyncHandler(async (request, response) => {
  const proof = await PaymentProof.findByPk(request.params.id)
  if (!proof?.storageKey || !proof.imageType) throw new HttpError(404, 'Proof image not found')
  response.setHeader('Content-Type', proof.imageType)
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Content-Disposition', 'inline')
  ;(await readPaymentProofImage(proof.storageKey)).pipe(response)
})

export const reviewProof = asyncHandler(async (request, response) => {
  const decision = request.body?.decision
  const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : ''
  if (!['confirm', 'reject'].includes(decision)) throw new HttpError(400, 'Choose confirm or reject')
  if (decision === 'reject' && (reason.length < 3 || reason.length > 1000)) throw new HttpError(400, 'Add a rejection reason')
  const proof = await sequelize.transaction(async (transaction) => {
    const candidate = await PaymentProof.findByPk(request.params.id, { transaction })
    if (!candidate) throw new HttpError(404, 'Proof not found')
    const order = candidate.paymentId ? await Payment.findByPk(candidate.paymentId, { transaction }) : null
    const lockedOrder = order ? await Order.findByPk(order.orderId, { transaction, lock: transaction.LOCK.UPDATE }) : null
    const cake = candidate.customCakeRequestId ? await CustomCakeRequest.findByPk(candidate.customCakeRequestId, { transaction, lock: transaction.LOCK.UPDATE }) : null
    const locked = await PaymentProof.findByPk(candidate.id, { transaction, lock: transaction.LOCK.UPDATE })
    if (!locked || locked.status !== 'submitted') throw new HttpError(409, 'This proof has already been reviewed')
    if ((lockedOrder && lockedOrder.status === 'cancelled') || (cake && ['cancelled', 'rejected'].includes(cake.status))) throw new HttpError(409, 'This payment is no longer active')
    if (decision === 'confirm' && locked.reference) {
      const duplicate = await PaymentProof.findOne({ where: { reference: { [Op.iLike]: locked.reference }, status: 'confirmed', id: { [Op.ne]: locked.id } }, transaction })
      if (duplicate) throw new HttpError(409, 'This reference was already confirmed for another payment')
    }
    if (order && lockedOrder) {
      if (order.provider !== 'manual_momo' || order.status !== 'pending') throw new HttpError(409, 'Payment is no longer pending')
      if (decision === 'confirm') {
        const now = new Date()
        await order.update({ status: 'paid', paidAt: now, adminConfirmedAt: now, adminConfirmedByUserId: request.auth!.userId }, { transaction })
        await lockedOrder.update({ paymentStatus: 'paid' }, { transaction })
      }
    }
    if (cake) {
      if (!['quoted', 'awaiting_payment'].includes(cake.status)) throw new HttpError(409, 'Cake payment is no longer pending')
      if (decision === 'confirm') await cake.update({ status: 'confirmed' }, { transaction })
    }
    await locked.update({ status: decision === 'confirm' ? 'confirmed' : 'rejected', rejectionReason: decision === 'reject' ? reason : null, reviewedByUserId: request.auth!.userId, reviewedAt: new Date() }, { transaction })
    transaction.afterCommit(() => {
      publishOperationChanged({ area: 'proofs', id: locked.id, reason: 'reviewed' })
      if (lockedOrder) publishOrderChanged({ orderId: lockedOrder.id, reason: decision === 'confirm' ? 'payment_confirmed' : 'payment_updated' })
      if (cake) publishOperationChanged({ area: 'cakes', id: cake.id, reason: 'updated' })
    })
    return locked
  }).catch((error: unknown) => {
    if (error instanceof UniqueConstraintError) throw new HttpError(409, 'This reference was already confirmed for another payment')
    throw error
  })
  response.json({ proof: proofResponse(proof) })
})
