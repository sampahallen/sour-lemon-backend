import type { RequestHandler } from 'express'

export const PUBLIC_CACHE_CONTROL = {
  standard: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400',
  journal: 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600, stale-if-error=2592000',
} as const

export const noStore: RequestHandler = (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
}

export function publicCache(policy: keyof typeof PUBLIC_CACHE_CONTROL): RequestHandler {
  return (_request, response, next) => {
    response.set('Cache-Control', PUBLIC_CACHE_CONTROL[policy])
    next()
  }
}
