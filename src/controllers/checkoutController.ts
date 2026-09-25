import { randomBytes } from 'node:crypto'
import { Op, Transaction } from 'sequelize'
import { sequelize } from '../config/database.js'
import { AppSetting } from '../models/AppSetting.js'
import { Cart } from '../models/Cart.js'
import { CartItem } from '../models/CartItem.js'
import { DeliveryArea } from '../models/DeliveryArea.js'
import { Order } from '../models/Order.js'
import { OrderItem } from '../models/OrderItem.js'
import { OrderStatusHistory } from '../models/OrderStatusHistory.js'
import { Payment } from '../models/Payment.js'
import { Product } from '../models/Product.js'
import { ProductImage } from '../models/ProductImage.js'
import { User } from '../models/User.js'
import { initializePaystackTransaction } from '../services/paystackService.js'
import { getOrderReceipt, hashOrderAccessToken } from '../services/orderService.js'
import { allocateOrderNumber } from '../services/orderNumberService.js'
import { publishOrderChanged } from '../services/orderEvents.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import type { CheckoutInput, CheckoutQuoteInput } from '../validators/checkoutSchemas.js'

const toCents = (value: string) => Math.round(Number(value) * 100)
const fromCents = (value: number) => (value / 100).toFixed(2)

const getSetting = async (key: string, transaction?: Transaction) => {
  const setting = await AppSetting.findByPk(key, { transaction })
  return setting?.value as unknown
}

const loadPricedCart = async (cartId: string, transaction?: Transaction) => {
  const cartItems = await CartItem.findAll({
    where: { cartId },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  })
  if (cartItems.length === 0) throw new HttpError(400, 'Your cart is empty')

  const products = await Product.findAll({
    where: { id: { [Op.in]: cartItems.map((item) => item.productId) } },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  })
  const productsById = new Map(products.map((product) => [product.id, product]))
  const productImages = await ProductImage.findAll({
    where: { productId: { [Op.in]: products.map((product) => product.id) } },
    order: [['productId', 'ASC'], ['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    transaction,
  })
  const coverImageByProductId = new Map<string, string>()
  for (const image of productImages) {
    if (!coverImageByProductId.has(image.productId)) coverImageByProductId.set(image.productId, image.url)
  }
  const schedulingEnabled = await getSetting('menu_scheduling_enabled', transaction) === true
  const now = new Date()

  let subtotalCents = 0
  let currency: string | null = null
  const items = cartItems.map((cartItem) => {
    const product = productsById.get(cartItem.productId)
    const unavailable = !product || !product.isActive || product.archivedAt !== null || (
      schedulingEnabled && (
        (product.availableFrom !== null && product.availableFrom > now) ||
        (product.availableUntil !== null && product.availableUntil <= now)
      )
    )
    if (unavailable || !product) {
      throw new HttpError(409, 'One or more cart items are no longer available')
    }
    if (cartItem.quantity < 1 || cartItem.quantity > 99) {
      throw new HttpError(409, 'A cart item has an invalid quantity')
    }
    if (currency !== null && currency !== product.currency) {
      throw new HttpError(409, 'All cart items must use the same currency')
    }
    currency = product.currency
    const unitPriceCents = toCents(product.price)
    const lineTotalCents = unitPriceCents * cartItem.quantity
    subtotalCents += lineTotalCents
    return {
      cartItem,
      product,
      productImageUrl: coverImageByProductId.get(product.id) ?? null,
      unitPriceCents,
      lineTotalCents,
    }
  })

  return { items, subtotalCents, currency: currency ?? 'GHS' }
}

const resolveFulfillment = async (
  input: CheckoutQuoteInput,
  transaction?: Transaction,
) => {
  const feeModeValue = await getSetting('delivery_fee_mode', transaction)
  const deliveryFeeMode = feeModeValue === 'included' ? 'included' : 'rider'

  if (input.fulfillmentType !== 'sour_lemon_delivery') {
    if (input.deliveryAreaId) {
      throw new HttpError(400, 'This fulfillment option does not use a delivery area')
    }
    return { deliveryArea: null, deliveryFeeCents: 0, deliveryFeeMode }
  }
  if (!input.deliveryAreaId) throw new HttpError(400, 'Choose a delivery area')
  const deliveryArea = await DeliveryArea.findOne({
    where: { id: input.deliveryAreaId, isActive: true },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.SHARE } : {}),
  })
  if (!deliveryArea) throw new HttpError(400, 'The selected delivery area is unavailable')
  if (deliveryFeeMode === 'included' && deliveryArea.deliveryFee === null) {
    throw new HttpError(409, 'The selected delivery area does not have a configured fee')
  }
  return {
    deliveryArea,
    deliveryFeeCents: deliveryFeeMode === 'included' ? toCents(deliveryArea.deliveryFee!) : 0,
    deliveryFeeMode,
  }
}

export const quoteCheckout = asyncHandler(async (request, response) => {
  const cart = request.cartContext?.cart
  if (!cart) throw new HttpError(400, 'Your cart is empty')
  const input = request.validatedBody as CheckoutQuoteInput
  const [pricedCart, fulfillment] = await Promise.all([
    loadPricedCart(cart.id),
    resolveFulfillment(input),
  ])
  response.json({
    quote: {
      subtotal: fromCents(pricedCart.subtotalCents),
      deliveryFee: fromCents(fulfillment.deliveryFeeCents),
      total: fromCents(pricedCart.subtotalCents + fulfillment.deliveryFeeCents),
      currency: pricedCart.currency,
    },
    deliveryFeeMode: fulfillment.deliveryFeeMode,
  })
})

export const createCheckout = asyncHandler(async (request, response) => {
  const input = request.validatedBody as CheckoutInput
  const contextCart = request.cartContext?.cart
  if (!contextCart) throw new HttpError(400, 'Your cart is empty')
  if (input.paymentMethod === 'cash' && input.fulfillmentType !== 'pickup') {
    throw new HttpError(400, 'Cash payment is available only for pickup')
  }
  if (input.fulfillmentType === 'sour_lemon_delivery' && !input.deliveryAddress) {
    throw new HttpError(400, 'A delivery address is required')
  }
  if (input.fulfillmentType !== 'sour_lemon_delivery' && input.deliveryAddress) {
    throw new HttpError(400, 'This fulfillment option does not use a delivery address')
  }

  let guestAccessToken: string | null = null
  const result = await sequelize.transaction(async (transaction) => {
    const cart = await Cart.findByPk(contextCart.id, { transaction, lock: transaction.LOCK.UPDATE })
    if (!cart || cart.status !== 'active') {
      throw new HttpError(409, 'This cart has already been checked out')
    }
    const pricedCart = await loadPricedCart(cart.id, transaction)
    const fulfillment = await resolveFulfillment(input, transaction)

    let customerEmail = input.customerEmail ?? null
    if (request.auth) {
      const user = await User.findByPk(request.auth.userId, { transaction, lock: transaction.LOCK.SHARE })
      if (!user) throw new HttpError(401, 'Authentication required')
      customerEmail = user.email
    }
    if (input.paymentMethod !== 'cash' && !customerEmail) {
      throw new HttpError(400, 'Add an email address before paying online')
    }

    if (!request.auth) guestAccessToken = randomBytes(32).toString('base64url')
    const now = new Date()
    const isCash = input.paymentMethod === 'cash'
    const requiresManualConfirmation = isCash || (
      await getSetting('manual_payment_review', transaction)
    ) === true
    const totalCents = pricedCart.subtotalCents + fulfillment.deliveryFeeCents
    const reservedOrderNumber = await allocateOrderNumber(transaction)
    const createdOrder = await Order.create({
      orderNumber: reservedOrderNumber,
      userId: request.auth?.userId ?? null,
      deliveryAreaId: fulfillment.deliveryArea?.id ?? null,
      status: 'received',
      paymentStatus: isCash ? 'cash_due' : 'pending',
      fulfillmentType: input.fulfillmentType,
      customerName: input.customerName,
      customerEmail,
      phoneNumber: input.phoneNumber,
      whatsappNumber: input.whatsappNumber ?? null,
      deliveryAddress: input.deliveryAddress ? {
        ...input.deliveryAddress,
        deliveryAreaName: fulfillment.deliveryArea!.name,
      } : null,
      subtotal: fromCents(pricedCart.subtotalCents),
      deliveryFee: fromCents(fulfillment.deliveryFeeCents),
      total: fromCents(totalCents),
      currency: pricedCart.currency,
      customerNotes: input.customerNotes ?? null,
      guestAccessTokenHash: guestAccessToken ? hashOrderAccessToken(guestAccessToken) : null,
      placedAt: now,
      confirmedAt: null,
    }, { transaction })

    await OrderItem.bulkCreate(pricedCart.items.map(({ cartItem, product, productImageUrl, unitPriceCents, lineTotalCents }) => ({
      orderId: createdOrder.id,
      productId: product.id,
      productName: product.name,
      productDescription: product.description,
      productImageUrl,
      quantity: cartItem.quantity,
      unitPrice: fromCents(unitPriceCents),
      lineTotal: fromCents(lineTotalCents),
    })), { transaction, validate: true })
    await OrderStatusHistory.create({
      orderId: createdOrder.id,
      fromStatus: null,
      toStatus: createdOrder.status,
      changedByUserId: null,
      note: null,
    }, { transaction })

    const payment = await Payment.create({
      orderId: createdOrder.id,
      provider: isCash ? 'cash' : 'paystack',
      method: input.paymentMethod,
      paymentName: isCash ? null : input.paymentName!,
      status: isCash ? 'cash_due' : 'pending',
      amount: createdOrder.total,
      currency: createdOrder.currency,
      providerReference: isCash ? null : `SLP-${randomBytes(12).toString('hex')}`,
      checkoutUrl: null,
      providerAccessCode: null,
      failureCode: null,
      failureMessage: null,
      paidAt: null,
      requiresManualConfirmation,
      adminConfirmedAt: null,
      adminConfirmedByUserId: null,
      providerData: null,
    }, { transaction })

    if (!isCash) {
      const initialized = await initializePaystackTransaction({
        email: customerEmail!,
        amountCents: totalCents,
        currency: createdOrder.currency,
        reference: payment.providerReference!,
        method: input.paymentMethod as 'card' | 'momo',
        paymentName: input.paymentName!,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
      })
      await payment.update({
        providerReference: initialized.reference,
        checkoutUrl: initialized.checkoutUrl,
        providerAccessCode: initialized.accessCode,
      }, { transaction })
    }

    await cart.update({ status: 'converted' }, { transaction })
    return { order: createdOrder, payment }
  })

  publishOrderChanged({ orderId: result.order.id, reason: 'created' })

  response.status(201).json({
    order: await getOrderReceipt(result.order),
    payment: {
      id: result.payment.id,
      status: result.payment.status,
      accessCode: result.payment.providerAccessCode,
    },
    ...(guestAccessToken ? { guestAccessToken } : {}),
  })
})
