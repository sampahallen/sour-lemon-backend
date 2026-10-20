import type { Order } from '../models/Order.js'
import type { Payment } from '../models/Payment.js'
import { getAvailableOrderActions } from './orderWorkflow.js'

type SummaryOrder = Pick<Order, 'id' | 'status' | 'fulfillmentType'>
type SummaryPayment = Pick<Payment, 'orderId' | 'provider' | 'status' | 'requiresManualConfirmation' | 'adminConfirmedAt'>

export const countActionableOrders = (orders: SummaryOrder[], paymentsNewestFirst: SummaryPayment[]) => {
  const latestPayment = new Map<string, SummaryPayment>()
  for (const payment of paymentsNewestFirst) if (!latestPayment.has(payment.orderId)) latestPayment.set(payment.orderId, payment)
  return orders.filter((order) => getAvailableOrderActions(order, latestPayment.get(order.id) ?? null)
    .some((action) => action !== 'cancel')).length
}
