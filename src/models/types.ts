export const USER_ROLES = ['customer', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const CART_STATUSES = ['active', 'converted', 'abandoned'] as const
export type CartStatus = (typeof CART_STATUSES)[number]

export const ORDER_STATUSES = [
  'pending_payment',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cash_due',
  'cash_collected',
  'refunded',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const FULFILLMENT_TYPES = [
  'pickup',
  'customer_rider',
  'sour_lemon_delivery',
] as const
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number]

export const PAYMENT_PROVIDERS = ['paystack', 'cash'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export const PAYMENT_METHODS = ['card', 'momo', 'cash'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const CUSTOM_CAKE_STATUSES = [
  'submitted',
  'quoted',
  'awaiting_payment',
  'confirmed',
  'rejected',
  'cancelled',
] as const
export type CustomCakeStatus = (typeof CUSTOM_CAKE_STATUSES)[number]

export const JOURNAL_POST_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const
export type JournalPostStatus = (typeof JOURNAL_POST_STATUSES)[number]

export const JOURNAL_IMAGE_ROLES = ['cover', 'body'] as const
export type JournalImageRole = (typeof JOURNAL_IMAGE_ROLES)[number]

export interface DeliveryAddressSnapshot {
  recipientName: string
  phoneNumber: string
  addressLine1: string
  addressLine2?: string
  city: string
  landmark?: string
  deliveryAreaName?: string
}

export type JsonObject = Record<string, unknown>

export interface JournalBody {
  version: 1
  blocks: JsonObject[]
}
