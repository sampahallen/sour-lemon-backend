import assert from 'node:assert/strict'
import test from 'node:test'
import { isConcurrentRefreshUse, isSessionActive, sessionDeadlines } from './authSessionPolicy.js'

const hour = 60 * 60 * 1000
const started = new Date('2026-09-14T08:00:00.000Z')

test('an active session ends at its fixed absolute deadline despite refresh activity', () => {
  const session = {
    createdAt: started,
    expiresAt: new Date(started.getTime() + 30 * 24 * hour),
    lastActivityAt: new Date(started.getTime() + 11 * hour),
  }
  const deadlines = sessionDeadlines(session, 12 * hour, 2 * hour)
  assert.equal(deadlines.absolute.toISOString(), '2026-09-14T20:00:00.000Z')
  assert.equal(isSessionActive(session, 12 * hour, 2 * hour, new Date('2026-09-14T19:59:59.000Z')), true)
  assert.equal(isSessionActive(session, 12 * hour, 2 * hour, deadlines.absolute), false)
})

test('idle expiry ends a session before the absolute deadline', () => {
  const session = {
    createdAt: started,
    expiresAt: new Date(started.getTime() + 12 * hour),
    lastActivityAt: new Date(started.getTime() + hour),
  }
  assert.equal(isSessionActive(session, 12 * hour, 2 * hour, new Date(started.getTime() + 3 * hour)), false)
  assert.equal(isSessionActive(session, 12 * hour, 2 * hour, new Date(started.getTime() + 3 * hour - 1)), true)
})

test('a simultaneous refresh receives a retry window; later token reuse is detected', () => {
  assert.equal(isConcurrentRefreshUse(started, new Date(started.getTime() + 14_999)), true)
  assert.equal(isConcurrentRefreshUse(started, new Date(started.getTime() + 15_000)), false)
})
