import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { AppSetting } from '../models/AppSetting.js'
import { Order } from '../models/Order.js'
import { OrderItem } from '../models/OrderItem.js'
import { Payment } from '../models/Payment.js'
import { ProductImage } from '../models/ProductImage.js'
import { paymentDisplayStatus } from './orderWorkflow.js'
import { HttpError } from '../utils/HttpError.js'

export const hashOrderAccessToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export const requireOrderAccess = (request: Request, order: Order) => {
  if (request.auth?.role === 'admin' || (request.auth && order.userId === request.auth.userId)) return
  const token = request.header('x-order-access-token')
  if (
    !token ||
    !order.guestAccessTokenHash ||
    hashOrderAccessToken(token) !== order.guestAccessTokenHash
  ) {
    throw new HttpError(403, 'You do not have access to this order')
  }
}

const buildWhatsAppLink = (number: string, message: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`

export const getOrderReceipt = async (order: Order): Promise<Record<string, unknown>> => {
  const [items, payment, whatsappSetting] = await Promise.all([
    OrderItem.findAll({ where: { orderId: order.id }, order: [['createdAt', 'ASC']] }),
    Payment.findOne({ where: { orderId: order.id }, order: [['createdAt', 'DESC']] }),
    AppSetting.findByPk('business_whatsapp_number'),
  ])
  const itemLines = items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')
  const message = `Hi Sour Lemon! I just placed order ${order.orderNumber}: ${itemLines}. Total: ${order.currency} ${order.total}. Fulfillment: ${order.fulfillmentType.replace(/_/g, ' ')}.`
  const businessNumber = typeof whatsappSetting?.value === 'string'
    ? whatsappSetting.value
    : null
  const productIdsNeedingFallback = [...new Set(items
    .filter((item) => !item.productImageUrl && item.productId)
    .map((item) => item.productId as string))]
  const fallbackImages = productIdsNeedingFallback.length > 0
    ? await ProductImage.findAll({
        where: { productId: productIdsNeedingFallback },
        order: [['productId', 'ASC'], ['sortOrder', 'ASC'], ['createdAt', 'ASC']],
      })
    : []
  const fallbackImageByProductId = new Map<string, string>()
  for (const image of fallbackImages) {
    if (!fallbackImageByProductId.has(image.productId)) fallbackImageByProductId.set(image.productId, image.url)
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentType: order.fulfillmentType,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    phoneNumber: order.phoneNumber,
    whatsappNumber: order.whatsappNumber,
    deliveryAddress: order.deliveryAddress,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    currency: order.currency,
    customerNotes: order.customerNotes,
    placedAt: order.placedAt,
    confirmedAt: order.confirmedAt,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productDescription: item.productDescription,
      productImageUrl: item.productImageUrl ?? (
        item.productId ? fallbackImageByProductId.get(item.productId) ?? null : null
      ),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    payment: payment ? {
      id: payment.id,
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      displayStatus: paymentDisplayStatus(payment),
      amount: payment.amount,
      accessCode: payment.status === 'pending' ? payment.providerAccessCode : null,
    } : null,
    whatsappLink: businessNumber ? buildWhatsAppLink(businessNumber, message) : null,
  }
}
