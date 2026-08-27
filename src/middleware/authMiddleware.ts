import { RequestHandler } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { getJwtSecret } from '../config/auth.js'
import { User } from '../models/User.js'
import { USER_ROLES, UserRole } from '../models/types.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'

const isUserRole = (role: unknown): role is UserRole =>
  typeof role === 'string' && USER_ROLES.some((allowedRole) => allowedRole === role)

export const authenticate: RequestHandler = asyncHandler(async (request, _response, next) => {
  const authorization = request.header('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required')
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new HttpError(401, 'Authentication required')

  const secret = getJwtSecret()
  let payload: JwtPayload
  try {
    const verified = jwt.verify(token, secret)
    if (typeof verified === 'string') throw new Error('Invalid JWT payload')
    payload = verified
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }

  if (!payload.sub || !isUserRole(payload.role)) {
    throw new HttpError(401, 'Invalid or expired token')
  }

  const user = await User.findOne({
    where: { id: payload.sub, isActive: true, isDeleted: false },
    attributes: ['id', 'role'],
  })
  if (!user) throw new HttpError(401, 'Invalid or expired token')

  request.auth = { userId: user.id, role: user.role }
  next()
})

export const optionalAuthenticate: RequestHandler = asyncHandler(async (request, _response, next) => {
  const authorization = request.header('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    next()
    return
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) {
    next()
    return
  }

  const secret = getJwtSecret()
  let payload: JwtPayload
  try {
    const verified = jwt.verify(token, secret)
    if (typeof verified === 'string') throw new Error('Invalid JWT payload')
    payload = verified
  } catch {
    next()
    return
  }

  if (!payload.sub || !isUserRole(payload.role)) {
    next()
    return
  }

  const user = await User.findOne({
    where: { id: payload.sub, isActive: true, isDeleted: false },
    attributes: ['id', 'role'],
  })
  if (!user) {
    next()
    return
  }

  request.auth = { userId: user.id, role: user.role }
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
