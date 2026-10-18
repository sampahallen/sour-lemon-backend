import assert from 'node:assert/strict'
import test from 'node:test'
import {
  requireFulfillment,
  requirePayment,
  resolveCheckoutAvailability,
  validateCheckoutSettings,
} from './checkoutAvailability.js'

const configured = () => new Map<string, unknown>([
  ['checkout_pickup_enabled', true],
  ['checkout_customer_rider_enabled', true],
  ['checkout_delivery_enabled', true],
  ['checkout_momo_enabled', true],
  ['checkout_cash_enabled', true],
  ['momo_payment_number', '+233201234567'],
  ['momo_recipient_name', 'Sour Lemon'],
  ['momo_network', 'MTN'],
])

test('offers all configured regular checkout choices', () => {
  assert.deepEqual(resolveCheckoutAvailability(configured()), {
    fulfillmentTypes: ['pickup', 'customer_rider', 'sour_lemon_delivery'],
    paymentMethods: ['momo', 'cash'],
  })
})

test('cash-only checkout allows pickup and excludes rider and delivery', () => {
  const values = configured()
  values.set('checkout_momo_enabled', false)
  const availability = resolveCheckoutAvailability(values)
  assert.deepEqual(availability, { fulfillmentTypes: ['pickup'], paymentMethods: ['cash'] })
  assert.doesNotThrow(() => validateCheckoutSettings(values))
  assert.throws(() => requireFulfillment(availability, 'customer_rider'), { status: 409 })
})

test('unconfigured Mobile Money cannot be offered', () => {
  const values = configured()
  values.set('momo_payment_number', null)
  assert.deepEqual(resolveCheckoutAvailability(values), {
    fulfillmentTypes: ['pickup'],
    paymentMethods: ['cash'],
  })
})

test('rejects settings that leave no usable checkout combination', () => {
  const values = configured()
  values.set('checkout_momo_enabled', false)
  values.set('checkout_cash_enabled', false)
  assert.throws(() => validateCheckoutSettings(values), { status: 409 })
})

test('cash requires pickup and cannot be used with rider delivery', () => {
  const values = configured()
  values.set('checkout_pickup_enabled', false)
  assert.throws(() => validateCheckoutSettings(values), { status: 409 })
  assert.throws(() => requirePayment(resolveCheckoutAvailability(configured()), 'customer_rider', 'cash'), { status: 409 })
})

test('rejects a payment choice disabled since the customer loaded checkout', () => {
  const values = configured()
  values.set('checkout_cash_enabled', false)
  assert.throws(() => requirePayment(resolveCheckoutAvailability(values), 'pickup', 'cash'), { status: 409 })
})
