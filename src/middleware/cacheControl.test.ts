import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { noStore, publicCache, PUBLIC_CACHE_CONTROL } from './cacheControl.js'

function invoke(middleware: ReturnType<typeof publicCache> | typeof noStore) {
  let cacheControl = ''
  let continued = false
  const response = {
    set: (name: string, value: string) => {
      if (name === 'Cache-Control') cacheControl = value
    },
  } as unknown as Response
  middleware({} as Request, response, (() => { continued = true }) as NextFunction)
  return { cacheControl, continued }
}

test('public cache policies support shared stale revalidation', () => {
  assert.deepEqual(invoke(publicCache('standard')), {
    cacheControl: PUBLIC_CACHE_CONTROL.standard,
    continued: true,
  })
  assert.match(PUBLIC_CACHE_CONTROL.journal, /stale-if-error=2592000/)
})

test('private and transactional routes default to no-store', () => {
  assert.deepEqual(invoke(noStore), { cacheControl: 'no-store', continued: true })
})
