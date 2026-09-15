import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateOrderNumber, orderNumberFromBytes } from './orderNumberService.js'

describe('order numbers', () => {
  it('creates a six-character customer-friendly code', () => {
    const orderNumber = generateOrderNumber()

    assert.equal(orderNumber.length, 6)
    assert.match(orderNumber, /^[2-9A-HJ-NP-Z]{6}$/)
  })

  it('formats bytes deterministically for testing', () => {
    assert.equal(orderNumberFromBytes(Uint8Array.from([0, 1, 2, 3, 4, 5])), '234567')
  })
})
