import assert from 'node:assert/strict'
import test from 'node:test'
import { forgotPasswordSchema, resetPasswordSchema } from './authSchemas.js'

test('normalizes a Ghanaian phone number for password recovery', () => {
  assert.deepEqual(forgotPasswordSchema.parse({ phoneNumber: '020 123 4567' }), {
    phoneNumber: '+233201234567',
  })
})

test('rejects invalid password recovery input', () => {
  assert.equal(forgotPasswordSchema.safeParse({ phoneNumber: '123' }).success, false)
  assert.equal(forgotPasswordSchema.safeParse({ phoneNumber: '+233201234567', extra: true }).success, false)
})

test('enforces reset token and password requirements', () => {
  assert.equal(resetPasswordSchema.safeParse({ token: 'short', password: 'long-enough' }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ token: 'a'.repeat(43), password: 'short' }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ token: 'a'.repeat(43), password: 'long-enough' }).success, true)
})
