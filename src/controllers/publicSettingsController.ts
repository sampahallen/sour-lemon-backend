import { AppSetting } from '../models/AppSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { CHECKOUT_REQUIRED_KEYS, resolveCheckoutAvailability } from '../services/checkoutAvailability.js'
import { HttpError } from '../utils/HttpError.js'

const PUBLIC_SETTING_KEYS = [
  'business_whatsapp_number',
  ...CHECKOUT_REQUIRED_KEYS,
] as const

export const getPublicSettings = asyncHandler(async (_request, response) => {
  const settings = await AppSetting.findAll({ where: { key: PUBLIC_SETTING_KEYS } })
  const values = new Map(settings.map((setting) => [setting.key, setting.value]))
  if (CHECKOUT_REQUIRED_KEYS.some((key) => !values.has(key))) {
    throw new HttpError(503, 'Checkout settings are not fully configured')
  }
  const checkout = resolveCheckoutAvailability(values)
  response.json({
    checkout,
    businessWhatsappNumber: values.get('business_whatsapp_number') ?? null,
    deliveryFeeMode: 'rider',
    momoPaymentNumber: values.get('momo_payment_number') ?? null,
    momoRecipientName: values.get('momo_recipient_name') ?? null,
    momoNetwork: values.get('momo_network') ?? null,
  })
})
