import assert from 'node:assert/strict'
import test from 'node:test'
import type { Order } from '../models/Order.js'
import type { Payment } from '../models/Payment.js'
import { countActionableOrders } from './operationsSummary.js'

test('the order bubble counts actionable work and ignores waiting payments', () => {
  const orders = [
    { id: 'waiting', status: 'received', fulfillmentType: 'pickup' },
    { id: 'paid', status: 'received', fulfillmentType: 'pickup' },
    { id: 'cash', status: 'ready_for_pickup', fulfillmentType: 'pickup' },
    { id: 'done', status: 'completed', fulfillmentType: 'pickup' },
  ] as Pick<Order, 'id' | 'status' | 'fulfillmentType'>[]
  const payments = [
    { orderId: 'paid', provider: 'paystack', status: 'paid', requiresManualConfirmation: false, adminConfirmedAt: new Date() },
    { orderId: 'cash', provider: 'cash', status: 'cash_due', requiresManualConfirmation: false, adminConfirmedAt: null },
    { orderId: 'waiting', provider: 'manual_momo', status: 'pending', requiresManualConfirmation: true, adminConfirmedAt: null },
  ] as Pick<Payment, 'orderId' | 'provider' | 'status' | 'requiresManualConfirmation' | 'adminConfirmedAt'>[]
  assert.equal(countActionableOrders(orders, payments), 2)
})

test('the newest payment decides whether an order needs action', () => {
  const orders = [{ id: 'retry', status: 'received', fulfillmentType: 'pickup' }] as Pick<Order, 'id' | 'status' | 'fulfillmentType'>[]
  const payments = [
    { orderId: 'retry', provider: 'paystack', status: 'pending', requiresManualConfirmation: false, adminConfirmedAt: null },
    { orderId: 'retry', provider: 'paystack', status: 'paid', requiresManualConfirmation: false, adminConfirmedAt: new Date() },
  ] as Pick<Payment, 'orderId' | 'provider' | 'status' | 'requiresManualConfirmation' | 'adminConfirmedAt'>[]
  assert.equal(countActionableOrders(orders, payments), 0)
})
