import { literal, Op } from 'sequelize'
import { sequelize } from '../config/database.js'
import { AppSetting } from '../models/AppSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { CHECKOUT_REQUIRED_KEYS, validateCheckoutSettings } from '../services/checkoutAvailability.js'
import {
  APP_SETTING_KEYS,
  type AppSettingsUpdateInput,
} from '../validators/appSettingSchemas.js'

const attributes = ['key', 'value', 'description', 'updatedAt'] as const
const settingOrder = new Map<string, number>(APP_SETTING_KEYS.map((key, index) => [key, index]))

const toResponse = (setting: AppSetting) => ({
  key: setting.key,
  value: setting.value,
  description: setting.description,
  updatedAt: setting.updatedAt,
})

const sortSettings = (settings: AppSetting[]) => settings.sort(
  (left, right) => (settingOrder.get(left.key) ?? 99) - (settingOrder.get(right.key) ?? 99),
)

export const listAppSettings = asyncHandler(async (_request, response) => {
  const settings = await AppSetting.findAll({
    where: { key: { [Op.in]: [...APP_SETTING_KEYS] } },
    attributes: [...attributes],
  })
  if (settings.length !== APP_SETTING_KEYS.length) {
    throw new HttpError(503, 'App settings are not fully configured')
  }
  response.json({ settings: sortSettings(settings).map(toResponse) })
})

export const updateAppSettings = asyncHandler(async (request, response) => {
  const { updates } = request.validatedBody as AppSettingsUpdateInput

  const settings = await sequelize.transaction(async (transaction) => {
    const keysToLock = [...new Set([...updates.map((update) => update.key), ...CHECKOUT_REQUIRED_KEYS])]
    const existing = await AppSetting.findAll({
      where: { key: { [Op.in]: keysToLock } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })
    if (existing.length !== keysToLock.length) {
      throw new HttpError(409, 'One or more app settings are not configured')
    }

    const byKey = new Map(existing.map((setting) => [setting.key, setting]))
    const proposed = new Map<string, unknown>(existing.map((setting) => [setting.key, setting.value]))
    for (const update of updates) proposed.set(update.key, update.value)
    validateCheckoutSettings(proposed)
    for (const update of updates) {
      await byKey.get(update.key)!.update({
        value: update.value === null ? literal("'null'::jsonb") as never : update.value,
        updatedByUserId: request.auth!.userId,
      }, { transaction })
    }

    return AppSetting.findAll({
      where: { key: { [Op.in]: [...APP_SETTING_KEYS] } },
      attributes: [...attributes],
      transaction,
    })
  })

  response.json({ settings: sortSettings(settings).map(toResponse) })
})
