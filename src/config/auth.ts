import { SignOptions } from 'jsonwebtoken'

const DEFAULT_BCRYPT_ROUNDS = 12
const DEFAULT_JWT_EXPIRES_IN: SignOptions['expiresIn'] = '1h'
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

export const getGuestCartCookieName = () =>
  process.env.GUEST_CART_COOKIE_NAME?.trim() || 'sour_lemon_guest_cart'

export const validateAuthConfig = () => {
  getJwtSecret()
  getJwtExpiresIn()
  getBcryptRounds()
  getRefreshTokenDays()
}
