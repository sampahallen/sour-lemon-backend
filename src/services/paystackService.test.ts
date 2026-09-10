import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { hasValidPaystackSignature } from './paystackService.js'

test('accepts a valid Paystack webhook signature', () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_signature_secret'
  const body = Buffer.from('{"event":"charge.success","data":{"id":42}}')
  const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex')
  assert.equal(hasValidPaystackSignature(body, signature), true)
})

test('rejects a changed webhook body and missing signature', () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_signature_secret'
  const body = Buffer.from('{"event":"charge.success","data":{"id":42}}')
  const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex')
  assert.equal(hasValidPaystackSignature(Buffer.from(`${body.toString()} `), signature), false)
  assert.equal(hasValidPaystackSignature(body, undefined), false)
})
