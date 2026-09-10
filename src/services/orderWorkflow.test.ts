import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getAllowedOrderTransitions,
  getAvailableOrderActions,
  paymentGroup,
  paymentDisplayStatus,
} from './orderWorkflow.js'

const paystackPayment = (overrides: Partial<{
  status: 'pending' | 'paid' | 'failed'
  requiresManualConfirmation: boolean
  adminConfirmedAt: Date | null
}> = {}) => ({
  provider: 'paystack' as const,
  status: overrides.status ?? 'paid',
  requiresManualConfirmation: overrides.requiresManualConfirmation ?? true,
  adminConfirmedAt: overrides.adminConfirmedAt ?? null,
})

describe('order workflow', () => {
  it('groups detailed payment conditions for the admin UI', () => {
    assert.equal(paymentGroup(null), 'pending')
    assert.equal(paymentGroup(paystackPayment({ status: 'pending' })), 'pending')
    assert.equal(paymentGroup(paystackPayment()), 'needs_attention')
    assert.equal(paymentGroup(paystackPayment({ status: 'failed' })), 'needs_attention')
    assert.equal(paymentGroup(paystackPayment({ adminConfirmedAt: new Date() })), 'paid')
    assert.equal(paymentGroup({
      provider: 'cash',
      status: 'cash_due',
      requiresManualConfirmation: true,
      adminConfirmedAt: null,
    }), 'pending')
    assert.equal(paymentGroup({
      provider: 'cash',
      status: 'cash_collected',
      requiresManualConfirmation: true,
      adminConfirmedAt: new Date(),
    }), 'paid')
    assert.equal(paymentGroup({
      provider: 'paystack',
      status: 'refunded',
      requiresManualConfirmation: false,
      adminConfirmedAt: new Date(),
    }), 'refunded')
  })

  it('keeps fulfillment separate from a verified payment review', () => {
    const order = { status: 'received' as const, fulfillmentType: 'pickup' as const }
    const payment = paystackPayment()

    assert.deepEqual(getAllowedOrderTransitions(order, payment), ['cancelled'])
    assert.deepEqual(getAvailableOrderActions(order, payment), ['confirm_payment', 'cancel'])
    assert.equal(paymentDisplayStatus(payment), 'needs_review')
  })

  it('allows preparation after the verified payment is reviewed', () => {
    const payment = paystackPayment({ adminConfirmedAt: new Date() })
    assert.deepEqual(getAllowedOrderTransitions(
      { status: 'received', fulfillmentType: 'pickup' },
      payment,
    ), ['preparing', 'cancelled'])
  })

  it('routes preparation according to fulfillment type', () => {
    const payment = paystackPayment({ adminConfirmedAt: new Date() })
    assert.deepEqual(getAvailableOrderActions(
      { status: 'preparing', fulfillmentType: 'sour_lemon_delivery' },
      payment,
    ), ['dispatch', 'cancel'])
    assert.deepEqual(getAvailableOrderActions(
      { status: 'preparing', fulfillmentType: 'customer_rider' },
      payment,
    ), ['mark_ready', 'cancel'])
  })

  it('allows cash preparation but blocks completion until collection', () => {
    const cashDue = {
      provider: 'cash' as const,
      status: 'cash_due' as const,
      requiresManualConfirmation: true,
      adminConfirmedAt: null,
    }
    assert.deepEqual(getAvailableOrderActions(
      { status: 'received', fulfillmentType: 'pickup' },
      cashDue,
    ), ['collect_cash', 'start_preparing', 'cancel'])
    assert.deepEqual(getAvailableOrderActions(
      { status: 'ready_for_pickup', fulfillmentType: 'pickup' },
      cashDue,
    ), ['collect_cash', 'cancel'])
  })
})
