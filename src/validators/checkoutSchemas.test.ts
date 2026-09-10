import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkoutSchema,
  customerOrderListQuerySchema,
  orderListQuerySchema,
} from './checkoutSchemas.js'

const baseCheckout = {
  customerName: 'Ama Mensah',
  phoneNumber: '0244000000',
  fulfillmentType: 'pickup',
  paymentMethod: 'cash',
}

test('normalizes checkout phone numbers', () => {
  const parsed = checkoutSchema.parse(baseCheckout)
  assert.equal(parsed.phoneNumber, '+233244000000')
})

test('rejects unsupported payment methods and unknown fields', () => {
  assert.equal(checkoutSchema.safeParse({ ...baseCheckout, paymentMethod: 'bank' }).success, false)
  assert.equal(checkoutSchema.safeParse({ ...baseCheckout, price: '0.01' }).success, false)
})

test('accepts a complete Sour Lemon delivery snapshot', () => {
  const parsed = checkoutSchema.safeParse({
    ...baseCheckout,
    customerEmail: 'CUSTOMER@EXAMPLE.COM',
    fulfillmentType: 'sour_lemon_delivery',
    paymentMethod: 'momo',
    deliveryAreaId: '9e18c661-3038-4cbe-ae79-ef250bc3bbdd',
    deliveryAddress: {
      recipientName: 'Ama Mensah',
      phoneNumber: '0244000000',
      addressLine1: '1 Lemon Street',
      city: 'Accra',
    },
  })
  assert.equal(parsed.success, true)
  if (parsed.success) assert.equal(parsed.data.customerEmail, 'customer@example.com')
})

test('accepts only supported admin payment groups', () => {
  for (const paymentGroup of ['pending', 'needs_attention', 'paid', 'refunded']) {
    assert.equal(orderListQuerySchema.safeParse({ paymentGroup }).success, true)
  }
  assert.equal(orderListQuerySchema.safeParse({ paymentGroup: 'cash_due' }).success, false)
})

test('normalizes customer order pagination and rejects excessive page sizes', () => {
  assert.deepEqual(customerOrderListQuerySchema.parse({}), { page: 1, limit: 12 })
  assert.deepEqual(customerOrderListQuerySchema.parse({ page: '2', limit: '20' }), {
    page: 2,
    limit: 20,
  })
  assert.equal(customerOrderListQuerySchema.safeParse({ limit: 51 }).success, false)
})
