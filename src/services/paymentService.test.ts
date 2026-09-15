import assert from 'node:assert/strict'
import test from 'node:test'
import type { Payment } from '../models/Payment.js'
import { validateSuccessfulTransaction } from './paymentService.js'
import type { VerifiedTransaction } from './paystackService.js'

const payment: Pick<Payment, 'providerReference' | 'amount' | 'currency' | 'method'> = {
  providerReference: 'SLP-reference',
  amount: '125.50',
  currency: 'GHS',
  method: 'momo',
}

const verified: VerifiedTransaction = {
  status: 'success',
  reference: 'SLP-reference',
  amount: 12550,
  currency: 'GHS',
  channel: 'mobile_money',
  paid_at: '2026-08-29T12:00:00.000Z',
}

test('accepts a matching verified Paystack transaction', () => {
  assert.doesNotThrow(() => validateSuccessfulTransaction(payment, verified))
})

test('rejects mismatched Paystack reference, amount, currency, and channel', () => {
  for (const changed of [
    { ...verified, reference: 'different' },
    { ...verified, amount: 1 },
    { ...verified, currency: 'NGN' },
    { ...verified, channel: 'card' },
  ]) {
    assert.throws(() => validateSuccessfulTransaction(payment, changed))
  }
})
