import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toDraftSlug } from './slug.js'

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
