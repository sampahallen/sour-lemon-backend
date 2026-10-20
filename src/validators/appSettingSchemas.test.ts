import assert from 'node:assert/strict'
import test from 'node:test'
import { appSettingsUpdateSchema } from './appSettingSchemas.js'

test('accepts and normalizes every supported app setting', () => {
  const result = appSettingsUpdateSchema.parse({
    updates: [
      { key: 'business_whatsapp_number', value: '020 123 4567' },
      { key: 'pickup_location', value: '  12 Volta Street, Osu  ' },
      { key: 'menu_scheduling_enabled', value: false },
      { key: 'checkout_pickup_enabled', value: true },
      { key: 'checkout_customer_rider_enabled', value: true },
      { key: 'checkout_delivery_enabled', value: true },
      { key: 'checkout_momo_enabled', value: true },
      { key: 'checkout_cash_enabled', value: true },
      { key: 'drop_notifications_enabled', value: false },
    ],
  })

  assert.equal(result.updates[0].value, '+233201234567')
  assert.equal(result.updates[1].value, '12 Volta Street, Osu')
})

test('allows nullable contact and pickup settings', () => {
  const result = appSettingsUpdateSchema.parse({
    updates: [
      { key: 'business_whatsapp_number', value: '   ' },
      { key: 'pickup_location', value: null },
    ],
  })

  assert.equal(result.updates[0].value, null)
  assert.equal(result.updates[1].value, null)
})

test('rejects unknown, duplicate, and invalid app settings', () => {
  assert.equal(appSettingsUpdateSchema.safeParse({
    updates: [{ key: 'unknown_setting', value: true }],
  }).success, false)
  assert.equal(appSettingsUpdateSchema.safeParse({
    updates: [
      { key: 'checkout_pickup_enabled', value: true },
      { key: 'checkout_pickup_enabled', value: false },
    ],
  }).success, false)
  assert.equal(appSettingsUpdateSchema.safeParse({
    updates: [{ key: 'delivery_fee_mode', value: 'included' }],
  }).success, false)
  assert.equal(appSettingsUpdateSchema.safeParse({
    updates: [{ key: 'checkout_cash_enabled', value: 'yes' }],
  }).success, false)
  assert.equal(appSettingsUpdateSchema.safeParse({
    updates: [{ key: 'drop_notifications_enabled', value: 'true' }],
  }).success, false)
})
