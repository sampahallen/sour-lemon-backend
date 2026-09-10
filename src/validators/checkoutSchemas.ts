import { z } from 'zod'
import { normalizePhoneNumber } from '../utils/phoneNumber.js'

const e164Phone = z.preprocess(
  (value) => (typeof value === 'string' ? normalizePhoneNumber(value) : value),
  z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid phone number'),
)

const fulfillmentType = z.enum(['pickup', 'customer_rider', 'sour_lemon_delivery'])

const deliveryAddress = z.object({
  recipientName: z.string().trim().min(2).max(120),
  phoneNumber: e164Phone,
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().min(1).max(255).optional(),
  city: z.string().trim().min(1).max(120),
  landmark: z.string().trim().min(1).max(255).optional(),
}).strict()

export const checkoutQuoteSchema = z.object({
  fulfillmentType,
  deliveryAreaId: z.string().uuid().nullable().optional(),
}).strict()

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  phoneNumber: e164Phone,
  whatsappNumber: e164Phone.nullable().optional(),
  fulfillmentType,
  deliveryAreaId: z.string().uuid().nullable().optional(),
  deliveryAddress: deliveryAddress.nullable().optional(),
  paymentMethod: z.enum(['card', 'momo', 'cash']),
  customerNotes: z.string().trim().max(2000).nullable().optional(),
}).strict()

export const orderStatusUpdateSchema = z.object({
  toStatus: z.enum([
    'received',
    'pending_payment',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'completed',
    'cancelled',
  ]),
  note: z.string().trim().max(1000).optional(),
}).strict()

export const orderListQuerySchema = z.object({
  scope: z.enum(['all', 'active', 'history']).default('all'),
  status: z.enum([
    'received',
    'pending_payment', 'confirmed', 'preparing', 'ready_for_pickup',
    'out_for_delivery', 'completed', 'cancelled',
  ]).optional(),
  paymentStatus: z.enum([
    'pending', 'paid', 'failed', 'cash_due', 'cash_collected', 'refunded',
  ]).optional(),
  paymentGroup: z.enum(['pending', 'needs_attention', 'paid', 'refunded']).optional(),
  fulfillmentType: fulfillmentType.optional(),
  deliveryAreaId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict()

export const groupedOrdersQuerySchema = z.object({
  status: z.enum([
    'received',
    'pending_payment', 'confirmed', 'preparing', 'ready_for_pickup',
    'out_for_delivery', 'completed', 'cancelled',
  ]).optional(),
}).strict()

export const customerOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
}).strict()

export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>
export type OrderListQuery = z.infer<typeof orderListQuerySchema>
export type GroupedOrdersQuery = z.infer<typeof groupedOrdersQuerySchema>
export type CustomerOrderListQuery = z.infer<typeof customerOrderListQuerySchema>
