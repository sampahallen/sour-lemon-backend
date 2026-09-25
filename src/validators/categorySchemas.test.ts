import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { categoryCreateSchema, categoryReorderSchema } from './catalogSchemas.js'
import { journalCategoryCreateSchema, journalCategoryReorderSchema } from './journalSchemas.js'

const sectionId = '8dff56dc-934e-4a20-a852-25fc3dfe45af'
const firstCategoryId = 'cbe30204-fc41-42af-8c28-a0cc6772db37'
const secondCategoryId = 'fa2b2915-e9a6-4a29-842f-818b54d81a27'

describe('category mutation schemas', () => {
  it('keeps menu category slugs and ordering server-managed', () => {
    assert.equal(categoryCreateSchema.safeParse({ siteSectionId: sectionId, name: 'Cakes' }).success, true)
    assert.equal(categoryCreateSchema.safeParse({ siteSectionId: sectionId, name: 'Cakes', slug: 'cakes' }).success, false)
    assert.equal(categoryCreateSchema.safeParse({ siteSectionId: sectionId, name: 'Cakes', sortOrder: 2 }).success, false)
  })

  it('keeps Journal category slugs and ordering server-managed', () => {
    assert.equal(journalCategoryCreateSchema.safeParse({ name: 'Recipes' }).success, true)
    assert.equal(journalCategoryCreateSchema.safeParse({ name: 'Recipes', slug: 'recipes' }).success, false)
    assert.equal(journalCategoryCreateSchema.safeParse({ name: 'Recipes', sortOrder: 2 }).success, false)
  })
})

describe('category reorder schemas', () => {
  it('accepts a unique ordered menu category list', () => {
    assert.equal(categoryReorderSchema.safeParse({
      siteSectionId: sectionId,
      categoryIds: [secondCategoryId, firstCategoryId],
    }).success, true)
  })

  it('rejects duplicate category ids', () => {
    assert.equal(categoryReorderSchema.safeParse({
      siteSectionId: sectionId,
      categoryIds: [firstCategoryId, firstCategoryId],
    }).success, false)
    assert.equal(journalCategoryReorderSchema.safeParse({
      categoryIds: [firstCategoryId, firstCategoryId],
    }).success, false)
  })
})
