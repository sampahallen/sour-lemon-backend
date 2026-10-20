import { createHash } from 'node:crypto'
import express from 'express'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { validateBody } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import {
  confirmSubscription, listSubscribers, subscribe, suppressSubscriber, unsubscribe,
} from '../services/newsletterService.js'

export const newsletterRouter = Router()
const email = z.email().max(254)
const token = z.string().regex(/^[0-9a-f]{64}$/)
const idSchema = z.uuid()
const ipLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: (request) => createHash('sha256').update(String((request.validatedBody as { email: string }).email).trim().toLowerCase()).digest('hex'),
})

newsletterRouter.post('/subscribe', ipLimiter, validateBody(z.object({ email, consent: z.literal(true) })), emailLimiter,
  asyncHandler(async (request, response) => {
    const input = request.validatedBody as { email: string; consent: true }
    await subscribe(input.email)
    response.json({ message: 'If this address can join, check your inbox for a confirmation link.' })
  }))

newsletterRouter.post('/confirm', ipLimiter, validateBody(z.object({ token })), asyncHandler(async (request, response) => {
  const ok = await confirmSubscription((request.validatedBody as { token: string }).token)
  if (!ok) throw new HttpError(400, 'This confirmation link has expired or was already used')
  response.json({ message: 'Your email is confirmed. You will hear from us when something new drops.' })
}))

newsletterRouter.post('/unsubscribe', ipLimiter, validateBody(z.object({ token: z.string().max(128) })), asyncHandler(async (request, response) => {
  const ok = await unsubscribe((request.validatedBody as { token: string }).token)
  if (!ok) throw new HttpError(400, 'This unsubscribe link is invalid')
  response.json({ message: 'You have been unsubscribed.' })
}))

newsletterRouter.post('/one-click/:token', express.urlencoded({ extended: false }), asyncHandler(async (request, response) => {
  if (request.body?.['List-Unsubscribe'] !== 'One-Click') {
    throw new HttpError(400, 'Invalid one-click unsubscribe request')
  }
  await unsubscribe(request.params.token)
  response.status(200).send('Unsubscribed')
}))

newsletterRouter.use(authenticate, authorizeRoles('admin'))
newsletterRouter.get('/admin/subscribers', asyncHandler(async (request, response) => {
  const search = String(request.query.search ?? '').slice(0, 100)
  const page = Math.max(1, Math.min(1000, Number(request.query.page) || 1))
  response.json(await listSubscribers(search, 25, (page - 1) * 25))
}))
newsletterRouter.post('/admin/subscribers/:id/suppress', asyncHandler(async (request, response) => {
  if (!idSchema.safeParse(request.params.id).success) throw new HttpError(400, 'Invalid subscriber ID')
  await suppressSubscriber(request.params.id)
  response.status(204).send()
}))
