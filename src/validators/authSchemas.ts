import { z } from 'zod'
import { normalizePhoneNumber } from '../utils/phoneNumber.js'

const e164Phone = z.preprocess(
  (value) => (typeof value === 'string' ? normalizePhoneNumber(value) : value),
  z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid phone number'),
)

const password = z
  .string()
  .min(8)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes')

const deliveryAddress = z
  .object({
    addressLine1: z.string().trim().min(1).max(255),
    addressLine2: z.string().trim().min(1).max(255).optional(),
    city: z.string().trim().min(1).max(120),
    landmark: z.string().trim().min(1).max(255).optional(),
  })
  .strict()

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phoneNumber: e164Phone,
    password,
    whatsappNumber: e164Phone.nullable().optional(),
    deliveryAddress,
  })
  .strict()

export const signInSchema = z
  .object({
    phoneNumber: e164Phone,
    password: z.string().min(1),
  })
  .strict()

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phoneNumber: e164Phone.optional(),
    whatsappNumber: e164Phone.nullable().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: password.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.name !== undefined ||
      body.phoneNumber !== undefined ||
      body.whatsappNumber !== undefined ||
      body.newPassword !== undefined,
    'Provide at least one field to update',
  )
  .refine((body) => !body.newPassword || Boolean(body.currentPassword), {
    message: 'currentPassword is required to set a new password',
    path: ['currentPassword'],
  })

export const userListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export const deleteUserSchema = z.object({ password: z.string().min(1) }).strict()

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UserListQuery = z.infer<typeof userListQuerySchema>
export type DeleteUserInput = z.infer<typeof deleteUserSchema>
