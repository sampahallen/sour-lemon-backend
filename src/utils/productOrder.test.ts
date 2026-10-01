import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isExactProductOrder } from './productOrder.js'

describe('Bakery product order', () => {
  it('accepts every current product exactly once in a new order', () => {
    assert.equal(isExactProductOrder(['c', 'a', 'b'], ['a', 'b', 'c']), true)
    assert.equal(isExactProductOrder([], []), true)
  })

  it('rejects stale, foreign, and duplicate product ids', () => {
    assert.equal(isExactProductOrder(['a', 'b'], ['a', 'b', 'c']), false)
    assert.equal(isExactProductOrder(['a', 'b', 'x'], ['a', 'b', 'c']), false)
    assert.equal(isExactProductOrder(['a', 'a', 'b'], ['a', 'b', 'c']), false)
  })
})
