import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import type { CustomCakeRequest } from '../models/CustomCakeRequest.js'
import { AppSetting } from '../models/AppSetting.js'
import { cakePaymentUrl, getMomoDetails, requireCakePaymentLink } from './manualPaymentService.js'

test('cake payment links are unguessable and revoked when the nonce changes', () => {
  const previousSecret = process.env.JWT_SECRET
  const previousOrigin = process.env.CUSTOMER_APP_ORIGIN
  process.env.JWT_SECRET = 'a-secret-for-testing-with-more-than-32-characters'
  process.env.CUSTOMER_APP_ORIGIN = 'https://customer.example.com'
  try {
    const cake = { id: '1fdc3cf6-630f-49eb-a932-a3594af5ce16', paymentLinkNonce: 'first-random-nonce' } as CustomCakeRequest
    const link = cakePaymentUrl(cake)
    assert.ok(link)
    const token = link.split('/').at(-1)!
    requireCakePaymentLink(cake, token)
    assert.throws(() => requireCakePaymentLink(cake, '0'.repeat(64)))
    cake.paymentLinkNonce = 'replacement-random-nonce'
    assert.throws(() => requireCakePaymentLink(cake, token))
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
    if (previousOrigin === undefined) delete process.env.CUSTOMER_APP_ORIGIN
    else process.env.CUSTOMER_APP_ORIGIN = previousOrigin
  }
})

test('custom cake payments require all Mobile Money details', async () => {
  const findAll = mock.method(AppSetting, 'findAll', async () => [
    { key: 'momo_payment_number', value: '+233201234567' },
    { key: 'momo_recipient_name', value: 'Sour Lemon' },
  ] as AppSetting[])
  try {
    await assert.rejects(getMomoDetails(), (error: unknown) =>
      error instanceof Error && 'status' in error && error.status === 503)
  } finally {
    findAll.mock.restore()
  }
})
