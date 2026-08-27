import { createHash, randomBytes } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import { getGuestCartCookieName } from '../config/auth.js'
import { Cart } from '../models/Cart.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const GUEST_CART_DAYS = 30

const guestCartCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

const readCookie = (request: Request, name: string) => {
  const entry = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  if (!entry) return null
  const value = entry.slice(name.length + 1)
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

const hashGuestToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export const identifyCart: RequestHandler = asyncHandler(async (request, response, next) => {
  if (request.auth) {
    let cart = await Cart.findOne({
      where: { userId: request.auth.userId, status: 'active' },
    })
    if (!cart) {
      cart = await Cart.create({
        userId: request.auth.userId,
        guestTokenHash: null,
        status: 'active',
        expiresAt: null,
      })
    }
    request.cartContext = { cart, isGuest: false }
    next()
    return
  }

  const cookieName = getGuestCartCookieName()
  const token = readCookie(request, cookieName)
  if (token) {
    const guestTokenHash = hashGuestToken(token)
    const cart = await Cart.findOne({ where: { guestTokenHash, status: 'active' } })
    if (cart) {
      request.cartContext = { cart, isGuest: true, guestTokenHash }
      next()
      return
    }
  }

  const newToken = randomBytes(32).toString('base64url')
  const guestExpiresAt = new Date(Date.now() + GUEST_CART_DAYS * 24 * 60 * 60 * 1000)
  const guestTokenHash = hashGuestToken(newToken)
  response.cookie(cookieName, newToken, { ...guestCartCookieOptions, expires: guestExpiresAt })
  request.cartContext = {
    cart: null,
    isGuest: true,
    guestTokenHash,
    guestExpiresAt,
  }
  next()
})
