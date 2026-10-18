import type { Transaction } from 'sequelize'
import { AppSetting } from '../models/AppSetting.js'
import type { FulfillmentType } from '../models/types.js'
import { HttpError } from '../utils/HttpError.js'

export const CHECKOUT_SETTING_KEYS = [
  'checkout_pickup_enabled',
  'checkout_customer_rider_enabled',
  'checkout_delivery_enabled',
  'checkout_momo_enabled',
  'checkout_cash_enabled',
] as const

export const CHECKOUT_REQUIRED_KEYS = [
  ...CHECKOUT_SETTING_KEYS,
  'momo_payment_number',
  'momo_recipient_name',
  'momo_network',
] as const

export type CheckoutPaymentMethod = 'momo' | 'cash'
export type CheckoutAvailability = {
  fulfillmentTypes: FulfillmentType[]
  paymentMethods: CheckoutPaymentMethod[]
}

export function resolveCheckoutAvailability(values: ReadonlyMap<string, unknown>): CheckoutAvailability {
  const momoConfigured = ['momo_payment_number', 'momo_recipient_name', 'momo_network']
    .every((key) => typeof values.get(key) === 'string' && (values.get(key) as string).trim().length > 0)
  const momo = values.get('checkout_momo_enabled') === true && momoConfigured
  const cash = values.get('checkout_cash_enabled') === true && values.get('checkout_pickup_enabled') === true
  const fulfillmentTypes: FulfillmentType[] = []
  if (values.get('checkout_pickup_enabled') === true && (momo || cash)) fulfillmentTypes.push('pickup')
  if (values.get('checkout_customer_rider_enabled') === true && momo) fulfillmentTypes.push('customer_rider')
  if (values.get('checkout_delivery_enabled') === true && momo) fulfillmentTypes.push('sour_lemon_delivery')
  return { fulfillmentTypes, paymentMethods: [...(momo ? ['momo' as const] : []), ...(cash ? ['cash' as const] : [])] }
}

export function validateCheckoutSettings(values: ReadonlyMap<string, unknown>) {
  if (values.get('checkout_cash_enabled') === true && values.get('checkout_pickup_enabled') !== true) {
    throw new HttpError(409, 'Cash on pickup requires pickup to be enabled')
  }
  if (resolveCheckoutAvailability(values).fulfillmentTypes.length === 0) {
    throw new HttpError(409, 'Leave at least one usable fulfillment and payment combination enabled')
  }
}

export async function loadCheckoutAvailability(transaction?: Transaction, lock = false) {
  const settings = await AppSetting.findAll({
    where: { key: [...CHECKOUT_REQUIRED_KEYS] },
    transaction,
    ...(lock && transaction ? { lock: transaction.LOCK.SHARE } : {}),
  })
  if (settings.length !== CHECKOUT_REQUIRED_KEYS.length) throw new HttpError(503, 'Checkout settings are not fully configured')
  return resolveCheckoutAvailability(new Map(settings.map((setting) => [setting.key, setting.value])))
}

export function requireFulfillment(availability: CheckoutAvailability, fulfillmentType: FulfillmentType) {
  if (!availability.fulfillmentTypes.includes(fulfillmentType)) {
    throw new HttpError(409, 'This fulfillment option is no longer available. Please refresh checkout.')
  }
}

export function requirePayment(
  availability: CheckoutAvailability,
  fulfillmentType: FulfillmentType,
  paymentMethod: CheckoutPaymentMethod,
) {
  if (!availability.paymentMethods.includes(paymentMethod) || (paymentMethod === 'cash' && fulfillmentType !== 'pickup')) {
    throw new HttpError(409, 'This payment option is no longer available. Please refresh checkout.')
  }
}
