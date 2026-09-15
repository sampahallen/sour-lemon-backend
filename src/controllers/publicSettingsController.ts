import { AppSetting } from '../models/AppSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const PUBLIC_SETTING_KEYS = [
  'business_whatsapp_number',
  'pickup_location',
  'delivery_fee_mode',
] as const

export const getPublicSettings = asyncHandler(async (_request, response) => {
  const settings = await AppSetting.findAll({ where: { key: PUBLIC_SETTING_KEYS } })
  const values = new Map(settings.map((setting) => [setting.key, setting.value]))
  response.json({
    businessWhatsappNumber: values.get('business_whatsapp_number') ?? null,
    pickupLocation: values.get('pickup_location') ?? null,
    deliveryFeeMode: values.get('delivery_fee_mode') ?? null,
  })
})
