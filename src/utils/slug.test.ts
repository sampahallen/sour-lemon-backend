import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextAvailableSlug, toDraftSlug, toNumberedSlug } from './slug.js'

describe('numbered category slugs', () => {
  it('starts duplicate suffixes at one and fills the first available value', async () => {
    const taken = new Set(['birthday-cakes', 'birthday-cakes-1'])

    assert.equal(toNumberedSlug('Birthday cakes'), 'birthday-cakes')
    assert.equal(await nextAvailableSlug('Birthday cakes', async (slug) => taken.has(slug)), 'birthday-cakes-2')
  })

  it('keeps numbered slugs within the requested length', () => {
    const slug = toNumberedSlug('A'.repeat(200), 12, 120)

    assert.equal(slug.length, 120)
    assert.equal(slug.endsWith('-12'), true)
  })

  it('returns an empty slug when the name has no slug characters', async () => {
    assert.equal(await nextAvailableSlug('---', async () => false), '')
  })
})

describe('toDraftSlug', () => {
  it('uses the post id to keep identical draft titles unique', () => {
    assert.equal(
      toDraftSlug('Untitled post', '8DFF56DC-934E-4A20-A852-25FC3DFE45AF'),
      'untitled-post-8dff56dc-934e-4a20-a852-25fc3dfe45af',
    )
  })

  it('keeps the generated slug within the database field length', () => {
    const slug = toDraftSlug('A'.repeat(300), '8dff56dc-934e-4a20-a852-25fc3dfe45af')

    assert.equal(slug.length, 220)
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
})
