import { z } from 'zod'
import { CUSTOM_CAKE_STATUSES } from '../models/types.js'
import { normalizePhoneNumber } from '../utils/phoneNumber.js'

const e164Phone = z.preprocess(
  (value) => (typeof value === 'string' ? normalizePhoneNumber(value) : value),
  z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid phone number'),
)

export const customCakeRequestCreateSchema = z
  .object({
    customerName: z.string().trim().min(1).max(120),
    phoneNumber: e164Phone,
    whatsappNumber: e164Phone.nullable().optional(),
    occasion: z.string().trim().min(1).max(160),
    requestedSize: z.string().trim().min(1).max(100),
    notes: z.string().trim().min(1).max(5_000).nullable().optional(),
  })
  .strict()

export const customCakeQuerySchema = z
  .object({
    status: z.enum(CUSTOM_CAKE_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export const customCakeQuoteSchema = z
  .object({
    quotedAmount: z.coerce.number().finite().min(0.01).max(999_999_999.99),
    quoteExpiresAt: z.coerce.date().optional(),
  })
  .strict()
  .refine((input) => !input.quoteExpiresAt || input.quoteExpiresAt > new Date(), {
    message: 'Quote expiry must be later than now',
    path: ['quoteExpiresAt'],
  })

export const customCakeRejectSchema = z
  .object({ note: z.string().trim().min(1).max(2_000).optional() })
  .strict()

export type CustomCakeRequestCreateInput = z.infer<typeof customCakeRequestCreateSchema>
export type CustomCakeQuery = z.infer<typeof customCakeQuerySchema>
export type CustomCakeQuoteInput = z.infer<typeof customCakeQuoteSchema>
export type CustomCakeRejectInput = z.infer<typeof customCakeRejectSchema>
