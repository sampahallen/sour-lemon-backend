import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request } from 'express'
import type { Order } from '../models/Order.js'
import { hashOrderAccessToken, requireOrderAccess } from './orderService.js'

const ownerId = 'customer-one'
const otherId = 'customer-two'
const guestToken = 'guest-order-secret'

const requestFor = (userId?: string, role: 'customer' | 'admin' = 'customer', token?: string) => ({
  auth: userId ? { userId, role } : undefined,
  header: (name: string) => name === 'x-order-access-token' ? token : undefined,
}) as unknown as Request

const orderFor = (userId: string | null, guestAccessTokenHash: string | null = null) => ({
  userId,
  guestAccessTokenHash,
}) as Order

test('customers can access their own orders without a guest token', () => {
  assert.doesNotThrow(() => requireOrderAccess(requestFor(ownerId), orderFor(ownerId)))
})

test('another customer and an unauthenticated caller cannot access an account order', () => {
  const order = orderFor(ownerId)
  assert.throws(() => requireOrderAccess(requestFor(otherId), order), { status: 403 })
  assert.throws(() => requireOrderAccess(requestFor(), order), { status: 403 })
})

test('a guest token grants access only to its guest order', () => {
  const guestOrder = orderFor(null, hashOrderAccessToken(guestToken))
  assert.doesNotThrow(() => requireOrderAccess(requestFor(undefined, 'customer', guestToken), guestOrder))
  assert.doesNotThrow(() => requireOrderAccess(requestFor(ownerId, 'customer', guestToken), guestOrder))
  assert.throws(() => requireOrderAccess(requestFor(undefined, 'customer', 'wrong-token'), guestOrder), {
    status: 403,
  })
  assert.throws(() => requireOrderAccess(requestFor(undefined, 'customer', guestToken), orderFor(ownerId, guestOrder.guestAccessTokenHash)), {
    status: 403,
  })
  assert.throws(() => requireOrderAccess(requestFor(otherId, 'customer', guestToken), orderFor(ownerId, guestOrder.guestAccessTokenHash)), {
    status: 403,
  })
})

test('admins retain access to account and guest orders', () => {
  assert.doesNotThrow(() => requireOrderAccess(requestFor('admin-one', 'admin'), orderFor(ownerId)))
  assert.doesNotThrow(() => requireOrderAccess(requestFor('admin-one', 'admin'), orderFor(null)))
})
