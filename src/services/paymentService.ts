import type { Transaction } from 'sequelize'
import { sequelize } from '../config/database.js'
import { Order } from '../models/Order.js'
import { Payment } from '../models/Payment.js'
import type { VerifiedTransaction } from './paystackService.js'
import { publishOrderChanged } from './orderEvents.js'
import { HttpError } from '../utils/HttpError.js'

const cents = (value: string) => Math.round(Number(value) * 100)

export const validateSuccessfulTransaction = (
  payment: Pick<Payment, 'providerReference' | 'amount' | 'currency' | 'method'>,
  data: VerifiedTransaction,
) => {
  if (data.reference !== payment.providerReference) {
    throw new HttpError(409, 'Payment reference does not match')
  }
  if (data.amount !== cents(payment.amount)) {
    throw new HttpError(409, 'Payment amount does not match the order')
  }
  if (data.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    throw new HttpError(409, 'Payment currency does not match the order')
  }
  const expectedChannel = payment.method === 'momo' ? 'mobile_money' : 'card'
  if (data.channel !== expectedChannel) {
    throw new HttpError(409, 'Payment channel does not match the selected method')
  }
}

const markSuccessfulPayment = async (
  paymentId: string,
  data: VerifiedTransaction,
  transaction: Transaction,
) => {
  const payment = await Payment.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!payment) throw new HttpError(404, 'Payment not found')
  if (payment.status === 'paid') return payment
  if (payment.status !== 'pending') throw new HttpError(409, 'This payment is no longer pending')
  validateSuccessfulTransaction(payment, data)

  const order = await Order.findByPk(payment.orderId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!order) throw new HttpError(404, 'Order not found')
  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date()
  await payment.update({
    status: 'paid',
    paidAt,
    failureCode: null,
    failureMessage: null,
    providerData: {
      transactionId: data.id ?? null,
      channel: data.channel,
      gatewayResponse: data.gateway_response ?? null,
    },
    adminConfirmedAt: payment.requiresManualConfirmation ? null : paidAt,
    adminConfirmedByUserId: null,
  }, { transaction })
  await order.update({
    paymentStatus: 'paid',
  }, { transaction })
  return payment
}

export const applyVerifiedPaystackTransaction = async (
  paymentId: string,
  data: VerifiedTransaction,
) => {
  if (data.status === 'success') {
    return sequelize.transaction(async (transaction) => {
      const payment = await markSuccessfulPayment(paymentId, data, transaction)
      transaction.afterCommit(() => publishOrderChanged({
        orderId: payment.orderId,
        reason: 'payment_updated',
      }))
      return payment
    })
  }
  if (data.status === 'failed' || data.status === 'abandoned' || data.status === 'reversed') {
    await sequelize.transaction(async (transaction) => {
      const payment = await Payment.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE })
      if (!payment || payment.status !== 'pending') return
      await payment.update({
        status: 'failed',
        failureCode: data.status,
        failureMessage: data.gateway_response ?? 'Payment was not completed',
      }, { transaction })
      await Order.update(
        { paymentStatus: 'failed' },
        { where: { id: payment.orderId, paymentStatus: 'pending' }, transaction },
      )
      transaction.afterCommit(() => publishOrderChanged({
        orderId: payment.orderId,
        reason: 'payment_updated',
      }))
    })
  }
  return Payment.findByPk(paymentId)
}
