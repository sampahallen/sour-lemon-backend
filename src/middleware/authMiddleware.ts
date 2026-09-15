import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { getJwtSecret, getSessionAbsoluteMs, getSessionIdleMs } from '../config/auth.js'
import { AuthSession } from '../models/AuthSession.js'
import { isSessionActive } from '../services/authSessionPolicy.js'
import { User } from '../models/User.js'
import { USER_ROLES, type UserRole } from '../models/types.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'

const isUserRole = (role: unknown): role is UserRole =>
  typeof role === 'string' && USER_ROLES.some((allowedRole) => allowedRole === role)

export const verifyAccessToken = async (token: string): Promise<{ userId: string; role: UserRole; sessionId: string }> => {
  let payload: jwt.JwtPayload
  try {
    const verified = jwt.verify(token, getJwtSecret())
    if (typeof verified === 'string') throw new Error('Invalid JWT payload')
    payload = verified
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }

  if (!payload.sub || !isUserRole(payload.role)) {
    throw new HttpError(401, 'Invalid or expired token')
  }

  if (typeof payload.sid !== 'string' && process.env.ALLOW_LEGACY_ACCESS_TOKENS === 'true') {
    const legacyUser = await User.findOne({ where: { id: payload.sub, role: payload.role, isActive: true, isDeleted: false } })
    if (legacyUser) return { userId: legacyUser.id, role: legacyUser.role, sessionId: 'legacy' }
  }
  if (typeof payload.sid !== 'string') throw new HttpError(401, 'Invalid or expired token')

  const [user, session] = await Promise.all([
    User.findOne({ where: { id: payload.sub, isActive: true, isDeleted: false }, attributes: ['id', 'role'] }),
    AuthSession.findOne({ where: { id: payload.sid, userId: payload.sub, revokedAt: null } }),
  ])
  const now = new Date()
  if (!user || !session || user.role !== payload.role ||
    !isSessionActive(session, getSessionAbsoluteMs(user.role), getSessionIdleMs(user.role), now)) {
    throw new HttpError(401, 'Invalid or expired token')
  }
  return { userId: user.id, role: user.role, sessionId: session.id }
}

export const authenticate: RequestHandler = asyncHandler(async (request, _response, next) => {
  const authorization = request.header('authorization')
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required')
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new HttpError(401, 'Authentication required')
  request.auth = await verifyAccessToken(token)
  next()
})

export const optionalAuthenticate: RequestHandler = asyncHandler(async (request, _response, next) => {
  const authorization = request.header('authorization')
  if (!authorization) {
    next()
    return
  }
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, 'Invalid or expired token')
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new HttpError(401, 'Invalid or expired token')
  request.auth = await verifyAccessToken(token)
  next()
})

export const authorizeRoles = (...roles: UserRole[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.auth) {
      next(new HttpError(401, 'Authentication required'))
      return
    }
    if (!roles.includes(request.auth.role)) {
      next(new HttpError(403, 'You do not have permission to access this resource'))
      return
    }
    next()
  }
