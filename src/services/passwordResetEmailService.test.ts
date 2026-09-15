import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPasswordResetUrl } from './passwordResetEmailService.js'

test('builds a reset link without putting the token in the query string', () => {
  const previousUrl = process.env.CUSTOMER_APP_URL
  process.env.CUSTOMER_APP_URL = 'https://example.com/shop/'
  try {
    assert.equal(
      buildPasswordResetUrl('token with spaces'),
      'https://example.com/shop/reset-password#token=token%20with%20spaces',
    )
  } finally {
    if (previousUrl === undefined) delete process.env.CUSTOMER_APP_URL
    else process.env.CUSTOMER_APP_URL = previousUrl
  }
})
