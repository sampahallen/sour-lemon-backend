import { Router } from 'express'
import { createHash } from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import {
  forgotPassword,
  refresh,
  refreshAdmin,
  refreshCustomer,
  resetPassword,
  signIn,
  signOut,
  signOutAdmin,
  signOutCustomer,
  signUp,
} from '../controllers/authController.js'
import { validateBody } from '../middleware/validateRequest.js'
import {
  forgotPasswordSchema,
  ForgotPasswordInput,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '../validators/authSchemas.js'

export const authRouter = Router()

const rateLimitMessage = { error: 'Too many attempts. Please wait a few minutes and try again.' }
const passwordResetIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitMessage,
})
const passwordResetPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const { phoneNumber } = request.validatedBody as ForgotPasswordInput
    return createHash('sha256').update(phoneNumber).digest('hex')
  },
  message: rateLimitMessage,
})

authRouter.post('/signup', validateBody(signUpSchema), signUp)
authRouter.post('/signin', validateBody(signInSchema), signIn)
authRouter.post(
  '/forgot-password',
  passwordResetIpLimiter,
  validateBody(forgotPasswordSchema),
  passwordResetPhoneLimiter,
  forgotPassword,
)
authRouter.post(
  '/reset-password',
  passwordResetIpLimiter,
  validateBody(resetPasswordSchema),
  resetPassword,
)
authRouter.post('/refresh', refresh)
authRouter.post('/signout', signOut)
authRouter.post('/admin/refresh', refreshAdmin)
authRouter.post('/admin/signout', signOutAdmin)
authRouter.post('/customer/refresh', refreshCustomer)
authRouter.post('/customer/signout', signOutCustomer)
