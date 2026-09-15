import { z } from 'zod'
import { normalizePhoneNumber } from '../utils/phoneNumber.js'

export const APP_SETTING_KEYS = [
  'business_whatsapp_number',
  'pickup_location',
  'manual_payment_review',
  'delivery_fee_mode',
  'menu_scheduling_enabled',
] as const

const nullableWhatsappNumber = z.preprocess(
  (value) => typeof value === 'string'
    ? value.trim() ? normalizePhoneNumber(value) : null
    : value,
  z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid international phone number').nullable(),
)

const nullablePickupLocation = z.preprocess(
  (value) => typeof value === 'string' && !value.trim() ? null : value,
  z.string().trim().min(1).max(500).nullable(),
)

const appSettingUpdateSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('business_whatsapp_number'), value: nullableWhatsappNumber }).strict(),
  z.object({ key: z.literal('pickup_location'), value: nullablePickupLocation }).strict(),
  z.object({ key: z.literal('manual_payment_review'), value: z.boolean() }).strict(),
  z.object({ key: z.literal('delivery_fee_mode'), value: z.enum(['included', 'rider']) }).strict(),
  z.object({ key: z.literal('menu_scheduling_enabled'), value: z.boolean() }).strict(),
])

export const appSettingsUpdateSchema = z.object({
  updates: z.array(appSettingUpdateSchema).min(1).max(APP_SETTING_KEYS.length),
}).strict().superRefine(({ updates }, context) => {
  const seen = new Set<string>()
  updates.forEach((update, index) => {
    if (seen.has(update.key)) {
      context.addIssue({
        code: 'custom',
        path: ['updates', index, 'key'],
        message: 'Each setting can only be updated once',
      })
    }
    seen.add(update.key)
  })
})

export type AppSettingsUpdateInput = z.infer<typeof appSettingsUpdateSchema>
