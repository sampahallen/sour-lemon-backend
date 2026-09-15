import { SignOptions } from 'jsonwebtoken'
import type { UserRole } from '../models/types.js'

const DEFAULT_BCRYPT_ROUNDS = 12
const DEFAULT_JWT_EXPIRES_IN: SignOptions['expiresIn'] = '15m'
const DEFAULT_REFRESH_TOKEN_DAYS = 30

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  return secret
}

export const getJwtExpiresIn = (): SignOptions['expiresIn'] => {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN
  if (typeof expiresIn === 'string' && !/^\d+[smhd]$/.test(expiresIn)) {
    throw new Error('JWT_EXPIRES_IN must use a value such as 15m, 1h, or 7d')
  }
  return expiresIn as SignOptions['expiresIn']
}

export const getBcryptRounds = () => {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? DEFAULT_BCRYPT_ROUNDS)
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 15')
  }
  return rounds
}

export const getRefreshTokenDays = () => {
  const days = Number(process.env.REFRESH_TOKEN_DAYS ?? DEFAULT_REFRESH_TOKEN_DAYS)
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('REFRESH_TOKEN_DAYS must be an integer between 1 and 365')
  }
  return days
}

export const getRefreshCookieName = () =>
  process.env.REFRESH_COOKIE_NAME?.trim() || 'sour_lemon_refresh_token'

export const getRoleRefreshCookieName = (role: UserRole) => `${getRefreshCookieName()}_${role}`

export const getAppOrigin = (role: UserRole) => {
  const configured = role === 'admin' ? process.env.ADMIN_APP_ORIGIN?.trim() : process.env.CUSTOMER_APP_ORIGIN?.trim()
  if (process.env.NODE_ENV === 'production' && !configured) throw new Error(`${role.toUpperCase()}_APP_ORIGIN must be configured`)
  const origin = new URL(configured || (role === 'admin' ? 'http://localhost:5174' : 'http://localhost:5173'))
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new Error(`${role.toUpperCase()}_APP_ORIGIN must use HTTPS`)
  return origin.origin
}

const durationHours = (name: string, fallback: number) => {
  const hours = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(hours) || hours <= 0) throw new Error(`${name} must be a positive number of hours`)
  return hours * 60 * 60 * 1000
}

export const getSessionAbsoluteMs = (role: UserRole) => role === 'admin'
  ? durationHours('ADMIN_SESSION_HOURS', 12)
  : durationHours('CUSTOMER_SESSION_HOURS', getRefreshTokenDays() * 24)

export const getSessionIdleMs = (role: UserRole) => role === 'admin'
  ? durationHours('ADMIN_SESSION_IDLE_HOURS', 2)
  : durationHours('CUSTOMER_SESSION_IDLE_HOURS', 7 * 24)

export const getGuestCartCookieName = () =>
  process.env.GUEST_CART_COOKIE_NAME?.trim() || 'sour_lemon_guest_cart'

export const validateAuthConfig = () => {
  getJwtSecret()
  getJwtExpiresIn()
  getBcryptRounds()
  getRefreshTokenDays()
  getSessionAbsoluteMs('admin')
  getSessionAbsoluteMs('customer')
  getSessionIdleMs('admin')
  getSessionIdleMs('customer')
  const adminOrigin = getAppOrigin('admin')
  const customerOrigin = getAppOrigin('customer')
  if (adminOrigin === customerOrigin) throw new Error('Admin and customer apps must use different origins')
  if (process.env.NODE_ENV === 'production') {
    const allowed = (process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim())
    if (!allowed.includes(adminOrigin) || !allowed.includes(customerOrigin)) {
      throw new Error('CORS_ORIGINS must include both app origins')
    }
  }
}
