import { AppSetting } from '../models/AppSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const PUBLIC_SETTING_KEYS = [
  'business_whatsapp_number',
  'delivery_fee_mode',
  'momo_payment_number',
  'momo_recipient_name',
  'momo_network',
] as const

export const getPublicSettings = asyncHandler(async (_request, response) => {
  const settings = await AppSetting.findAll({ where: { key: PUBLIC_SETTING_KEYS } })
  const values = new Map(settings.map((setting) => [setting.key, setting.value]))
  response.json({
    businessWhatsappNumber: values.get('business_whatsapp_number') ?? null,
    deliveryFeeMode: values.get('delivery_fee_mode') ?? null,
    momoPaymentNumber: values.get('momo_payment_number') ?? null,
    momoRecipientName: values.get('momo_recipient_name') ?? null,
    momoNetwork: values.get('momo_network') ?? null,
  })
})
