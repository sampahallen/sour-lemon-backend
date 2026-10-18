import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveFulfillment } from './checkoutController.js'

test('new delivery quotes charge only for goods and leave the rider fee separate', async () => {
  const fulfillment = await resolveFulfillment({ fulfillmentType: 'sour_lemon_delivery' })
  assert.equal(fulfillment.deliveryArea, null)
  assert.equal(fulfillment.deliveryFeeCents, 0)
  assert.equal(fulfillment.deliveryFeeMode, 'rider')
})
