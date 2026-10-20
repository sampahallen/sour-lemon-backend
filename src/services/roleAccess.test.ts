import assert from 'node:assert/strict'
import test from 'node:test'
import { canDeleteOwnAccount, canRevokeAdmin, hasActiveRole } from './roleAccess.js'

test('dual-role accounts keep customer and admin sessions separate', () => {
  const roles = ['customer', 'admin'] as const
  assert.equal(hasActiveRole([...roles], 'admin', 'customer', 'customer'), true)
  assert.equal(hasActiveRole([...roles], 'admin', 'customer', 'admin'), false)
  assert.equal(hasActiveRole([...roles], 'admin', 'admin', 'admin'), true)
  assert.equal(hasActiveRole([...roles], 'admin', 'admin', 'customer'), false)
})

test('removing admin access invalidates its sessions while customer access remains', () => {
  assert.equal(hasActiveRole(['customer'], 'customer', 'admin', 'admin'), false)
  assert.equal(hasActiveRole(['customer'], 'customer', 'customer', 'customer'), true)
})

test('existing sessions retain their original role after migration', () => {
  assert.equal(hasActiveRole(['customer', 'admin'], 'admin', null, 'admin'), true)
  assert.equal(hasActiveRole(['customer', 'admin'], 'admin', null, 'customer'), false)
})

test('an admin keeps their account until trusted tooling removes that role', () => {
  assert.equal(canDeleteOwnAccount(['customer', 'admin']), false)
  assert.equal(canDeleteOwnAccount(['customer']), true)
})

test('trusted tooling preserves the last active administrator', () => {
  assert.equal(canRevokeAdmin(true, 1), false)
  assert.equal(canRevokeAdmin(true, 2), true)
  assert.equal(canRevokeAdmin(false, 1), true)
})
