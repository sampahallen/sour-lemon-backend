import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'node:crypto'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import type { Request, Response } from 'express'
import {
  getBcryptRounds,
  getAppOrigin,
  getGuestCartCookieName,
  getJwtExpiresIn,
  getJwtSecret,
  getRefreshCookieName,
  getRoleRefreshCookieName,
  getSessionAbsoluteMs,
  getSessionIdleMs,
} from '../config/auth.js'
import { sequelize } from '../config/database.js'
import { Address } from '../models/Address.js'
import { AuthSession } from '../models/AuthSession.js'
import { AuthRefreshUse } from '../models/AuthRefreshUse.js'
import { Cart } from '../models/Cart.js'
import { CartItem } from '../models/CartItem.js'
import { User } from '../models/User.js'
import type { UserRole } from '../models/types.js'
import { PasswordResetToken } from '../models/PasswordResetToken.js'
import { getPasswordResetTokenTtlMinutes } from '../config/email.js'
import { sendPasswordResetEmail } from '../services/passwordResetEmailService.js'
import { isConcurrentRefreshUse, sessionDeadlines } from '../services/authSessionPolicy.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { toUserResponse } from '../utils/userResponse.js'
import {
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from '../validators/authSchemas.js'

const createToken = (user: User, session: AuthSession) =>
  jwt.sign({ role: user.role, sid: session.id }, getJwtSecret(), {
    subject: user.id,
    expiresIn: getJwtExpiresIn(),
  })

const authenticationResponse = (user: User, session: AuthSession) => {
  const token = createToken(user, session)
  const payload = jwt.decode(token)
  if (!payload || typeof payload === 'string' || typeof payload.exp !== 'number') throw new Error('Could not issue access token')
  return {
    user: toUserResponse(user),
    token,
    tokenType: 'Bearer' as const,
    expiresIn: getJwtExpiresIn(),
    accessExpiresAt: new Date(payload.exp * 1000).toISOString(),
    sessionExpiresAt: session.expiresAt.toISOString(),
    idleExpiresAt: new Date(session.lastActivityAt.getTime() + getSessionIdleMs(user.role)).toISOString(),
  }
}

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
}

const guestCartCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

const hashRefreshToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

const hashGuestToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

const createRefreshToken = () => randomBytes(48).toString('base64url')

const createPasswordResetToken = () => randomBytes(32).toString('base64url')

const hashPasswordResetToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

const forgotPasswordMessage =
  'If a customer account matches that phone number, a reset link will be sent to its registered email.'

const roleCookieOptions = (role: UserRole) => ({ ...refreshCookieOptions, path: `/api/auth/${role}` })

const setRefreshCookie = (response: Response, role: UserRole, token: string, expiresAt: Date) => {
  response.cookie(getRoleRefreshCookieName(role), token, { ...roleCookieOptions(role), expires: expiresAt })
}

const clearRefreshCookie = (response: Response, role: UserRole) => {
  response.clearCookie(getRoleRefreshCookieName(role), roleCookieOptions(role))
}

const clearLegacyRefreshCookie = (response: Response) => {
  response.clearCookie(getRefreshCookieName(), { ...refreshCookieOptions, path: '/api/auth', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' })
}

const assertAppOrigin = (request: Request, role: UserRole) => {
  if (request.get('origin') !== getAppOrigin(role)) throw new HttpError(403, 'Unrecognized app origin')
}

const clearGuestCartCookie = (response: Response) => {
  response.clearCookie(getGuestCartCookieName(), guestCartCookieOptions)
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

const issueRefreshSession = async (user: User, transaction: Transaction) => {
  const token = createRefreshToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + getSessionAbsoluteMs(user.role))
  const session = await AuthSession.create(
    {
      userId: user.id,
      refreshTokenHash: hashRefreshToken(token),
      expiresAt,
      lastActivityAt: now,
      revokedAt: null,
    },
    { transaction },
  )
  return { token, session }
}

const mergeGuestCart = async (
  request: Request,
  userId: string,
  transaction: Transaction,
) => {
  const guestToken = readCookie(request, getGuestCartCookieName())
  if (!guestToken) return false

  const guestCart = await Cart.findOne({
    where: {
      userId: null,
      guestTokenHash: hashGuestToken(guestToken),
      status: 'active',
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  })
  if (!guestCart) return false

  const guestItems = await CartItem.findAll({
    where: { cartId: guestCart.id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  })
  if (guestItems.length === 0) return false

  let userCart = await Cart.findOne({
    where: { userId, status: 'active' },
    transaction,
    lock: transaction.LOCK.UPDATE,
  })
  if (!userCart) {
    userCart = await Cart.create(
      { userId, guestTokenHash: null, status: 'active', expiresAt: null },
      { transaction },
    )
  }

  for (const guestItem of guestItems) {
    const userItem = await CartItem.findOne({
      where: { cartId: userCart.id, productId: guestItem.productId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })
    if (userItem) {
      await userItem.update(
        { quantity: userItem.quantity + guestItem.quantity },
        { transaction },
      )
    } else {
      await CartItem.create(
        {
          cartId: userCart.id,
          productId: guestItem.productId,
          quantity: guestItem.quantity,
        },
        { transaction },
      )
    }
  }

  await guestCart.update({ status: 'abandoned' }, { transaction })
  return true
}

export const signUp = asyncHandler(async (request, response) => {
  assertAppOrigin(request, 'customer')
  const input = request.validatedBody as SignUpInput
  const passwordHash = await bcrypt.hash(input.password, getBcryptRounds())

  const { user, mergedGuestCart, refreshSession } = await sequelize.transaction(async (transaction) => {
    const createdUser = await User.create(
      {
        name: input.name,
        email: input.email,
        phoneNumber: input.phoneNumber,
        passwordHash,
        whatsappNumber: input.whatsappNumber ?? null,
        role: 'customer',
      },
      { transaction },
    )

    await Address.create(
      {
        userId: createdUser.id,
        deliveryAreaId: null,
        label: 'Home',
        recipientName: createdUser.name,
        phoneNumber: createdUser.phoneNumber,
        addressLine1: input.deliveryAddress.addressLine1,
        addressLine2: input.deliveryAddress.addressLine2 ?? null,
        city: input.deliveryAddress.city,
        landmark: input.deliveryAddress.landmark ?? null,
        isDefault: true,
      },
      { transaction },
    )

    const mergedGuestCart = await mergeGuestCart(request, createdUser.id, transaction)
    const refreshSession = await issueRefreshSession(createdUser, transaction)
    return { user: createdUser, mergedGuestCart, refreshSession }
  })

  setRefreshCookie(response, 'customer', refreshSession.token, refreshSession.session.expiresAt)
  if (mergedGuestCart) clearGuestCartCookie(response)
  response.status(201).json(authenticationResponse(user, refreshSession.session))
})

export const signIn = asyncHandler(async (request, response) => {
  const input = request.validatedBody as SignInInput
  const user = await User.findOne({
    where: { phoneNumber: input.phoneNumber, isActive: true, isDeleted: false },
  })

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid phone number or password')
  }
  assertAppOrigin(request, user.role)

  const { refreshSession, mergedGuestCart } = await sequelize.transaction(async (transaction) => ({
    refreshSession: await issueRefreshSession(user, transaction),
    mergedGuestCart: await mergeGuestCart(request, user.id, transaction),
  }))
  setRefreshCookie(response, user.role, refreshSession.token, refreshSession.session.expiresAt)
  if (mergedGuestCart) clearGuestCartCookie(response)
  response.json(authenticationResponse(user, refreshSession.session))
})

export const forgotPassword = asyncHandler(async (request, response) => {
  const input = request.validatedBody as ForgotPasswordInput
  const user = await User.findOne({
    where: {
      phoneNumber: input.phoneNumber,
      role: 'customer',
      isActive: true,
      isDeleted: false,
    },
  })

  if (!user?.email) {
    response.status(202).json({ message: forgotPasswordMessage })
    return
  }

  const token = createPasswordResetToken()
  const now = new Date()
  const expiresInMinutes = getPasswordResetTokenTtlMinutes()
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000)
  const resetToken = await sequelize.transaction(async (transaction) => {
    await PasswordResetToken.update(
      { usedAt: now },
      { where: { userId: user.id, usedAt: null }, transaction },
    )
    return PasswordResetToken.create(
      { userId: user.id, tokenHash: hashPasswordResetToken(token), expiresAt, usedAt: null },
      { transaction },
    )
  })

  void sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    token,
    expiresInMinutes,
  }).catch(async (error: unknown) => {
    console.error('Failed to send a password reset email', error)
    await resetToken.update({ usedAt: new Date() }).catch((updateError: unknown) => {
      console.error('Failed to invalidate an undelivered password reset token', updateError)
    })
  })

  response.status(202).json({ message: forgotPasswordMessage })
})

export const resetPassword = asyncHandler(async (request, response) => {
  const input = request.validatedBody as ResetPasswordInput
  const now = new Date()
  const tokenHash = hashPasswordResetToken(input.token)
  const passwordHash = await bcrypt.hash(input.password, getBcryptRounds())

  await sequelize.transaction(async (transaction) => {
    const resetToken = await PasswordResetToken.findOne({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { [Op.gt]: now },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })
    if (!resetToken) {
      throw new HttpError(400, 'This reset link is invalid or has expired')
    }

    const user = await User.findOne({
      where: {
        id: resetToken.userId,
        role: 'customer',
        isActive: true,
        isDeleted: false,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })
    if (!user) {
      throw new HttpError(400, 'This reset link is invalid or has expired')
    }

    await user.update({ passwordHash }, { transaction })
    await PasswordResetToken.update(
      { usedAt: now },
      { where: { userId: user.id, usedAt: null }, transaction },
    )
    await AuthSession.update(
      { revokedAt: now },
      { where: { userId: user.id, revokedAt: null }, transaction },
    )
  })

  response.status(204).send()
})

const refreshFor = async (request: Request, response: Response, role: UserRole, legacy = false) => {
  assertAppOrigin(request, role)
  const token = readCookie(request, legacy ? getRefreshCookieName() : getRoleRefreshCookieName(role))
  if (!token) {
    throw new HttpError(401, 'Authentication required')
  }

  const now = new Date()
  const tokenHash = hashRefreshToken(token)
  const session = await AuthSession.findOne({
    where: {
      refreshTokenHash: tokenHash,
      revokedAt: null,
    },
  })
  if (!session) {
    const consumed = await AuthRefreshUse.findByPk(tokenHash)
    const used = consumed ? await AuthSession.findOne({ where: { id: consumed.sessionId, revokedAt: null } }) : null
    if (used) {
      const usedOwner = await User.findByPk(used.userId)
      if (usedOwner?.role !== role) throw new HttpError(401, 'Invalid or expired session')
      if (consumed && isConcurrentRefreshUse(consumed.usedAt, now)) {
        throw new HttpError(409, 'Refresh already in progress')
      }
      await used.update({ revokedAt: now })
    }
    throw new HttpError(401, 'Invalid or expired session')
  }

  const user = await User.findOne({
    where: { id: session.userId, isActive: true, isDeleted: false },
  })
  const { absolute: absoluteExpiry, idle: idleExpiry } = sessionDeadlines(session, getSessionAbsoluteMs(role), getSessionIdleMs(role))
  if (user && user.role !== role) throw new HttpError(401, 'Invalid or expired session')
  if (!user || absoluteExpiry <= now || idleExpiry <= now) {
    await session.update({ revokedAt: now })
    if (legacy) clearLegacyRefreshCookie(response)
    else clearRefreshCookie(response, role)
    throw new HttpError(401, 'Invalid or expired session')
  }

  const nextToken = createRefreshToken()
  await sequelize.transaction(async (transaction) => {
    const [rotated] = await AuthSession.update(
      {
        refreshTokenHash: hashRefreshToken(nextToken),
        lastActivityAt: now,
        expiresAt: absoluteExpiry,
      },
      {
        where: {
          id: session.id,
          refreshTokenHash: tokenHash,
          revokedAt: null,
          expiresAt: { [Op.gt]: now },
        },
        transaction,
      },
    )
    if (rotated !== 1) throw new HttpError(409, 'Refresh already in progress')
    await AuthRefreshUse.create({ tokenHash, sessionId: session.id, usedAt: now }, { transaction })
  })

  session.lastActivityAt = now
  session.expiresAt = absoluteExpiry
  setRefreshCookie(response, role, nextToken, absoluteExpiry)
  if (legacy) clearLegacyRefreshCookie(response)
  response.json(authenticationResponse(user, session))
}

export const refreshAdmin = asyncHandler((request, response) => refreshFor(request, response, 'admin'))
export const refreshCustomer = asyncHandler((request, response) => refreshFor(request, response, 'customer'))

// Existing cookies are exchanged once during the backend-first rollout.
export const refresh = asyncHandler(async (request, response) => {
  const origin = request.get('origin')
  const role = origin === getAppOrigin('admin') ? 'admin' : origin === getAppOrigin('customer') ? 'customer' : null
  if (!role) throw new HttpError(403, 'Unrecognized app origin')
  await refreshFor(request, response, role, true)
})

const signOutFor = async (request: Request, response: Response, role: UserRole, legacy = false) => {
  assertAppOrigin(request, role)
  const token = readCookie(request, legacy ? getRefreshCookieName() : getRoleRefreshCookieName(role))
  if (token) {
    await AuthSession.update(
      { revokedAt: new Date() },
      { where: { refreshTokenHash: hashRefreshToken(token), revokedAt: null } },
    )
  }
  if (legacy) clearLegacyRefreshCookie(response)
  else clearRefreshCookie(response, role)
  response.status(204).send()
}

export const signOutAdmin = asyncHandler((request, response) => signOutFor(request, response, 'admin'))
export const signOutCustomer = asyncHandler((request, response) => signOutFor(request, response, 'customer'))
export const signOut = asyncHandler(async (request, response) => {
  const origin = request.get('origin')
  const role = origin === getAppOrigin('admin') ? 'admin' : origin === getAppOrigin('customer') ? 'customer' : null
  if (!role) throw new HttpError(403, 'Unrecognized app origin')
  await signOutFor(request, response, role, true)
})
