import { AppSetting } from '../models/AppSetting.js'
import { Cart } from '../models/Cart.js'
import { CartItem } from '../models/CartItem.js'
import { Product } from '../models/Product.js'
import { ProductImage } from '../models/ProductImage.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import type { CartAddItemInput, CartUpdateItemInput } from '../validators/cartSchemas.js'

const productInclude = {
  model: Product,
  as: 'product',
  required: true,
  attributes: ['id', 'name', 'slug', 'price', 'currency', 'isActive'],
  include: [{
    model: ProductImage,
    as: 'images',
    required: false,
    attributes: ['url', 'sortOrder'],
  }],
}

const toCents = (value: string) => Math.round(Number(value) * 100)
const fromCents = (value: number) => (value / 100).toFixed(2)

const toCartResponse = async (cart: Cart | null) => {
  if (!cart) {
    return { id: null, items: [], subtotal: '0.00', currency: 'GHS' }
  }

  const cartItems = await CartItem.findAll({
    where: { cartId: cart.id },
    include: [productInclude],
    order: [[{ model: Product, as: 'product' }, { model: ProductImage, as: 'images' }, 'sortOrder', 'ASC']],
  })

  let subtotalCents = 0
  let currency = 'GHS'
  const items = cartItems.map((cartItem, index) => {
    const raw = cartItem.toJSON() as unknown as Record<string, unknown>
    const product = raw.product as Record<string, unknown>
    const images = Array.isArray(product.images) ? product.images as Record<string, unknown>[] : []
    const unitPrice = String(product.price)
    const lineTotalCents = toCents(unitPrice) * cartItem.quantity
    const itemCurrency = String(product.currency)
    if (index === 0) currency = itemCurrency
    subtotalCents += lineTotalCents
    return {
      productId: String(product.id),
      name: String(product.name),
      slug: String(product.slug),
      coverImageUrl: typeof images[0]?.url === 'string' ? images[0].url : null,
      unitPrice: fromCents(toCents(unitPrice)),
      currency: itemCurrency,
      quantity: cartItem.quantity,
      lineTotal: fromCents(lineTotalCents),
      isActive: Boolean(product.isActive),
    }
  })

  return {
    id: cart.id,
    items,
    subtotal: fromCents(subtotalCents),
    currency,
  }
}

const requireProduct = async (productId: string) => {
  const product = await Product.findByPk(productId)
  if (!product) throw new HttpError(404, 'Product not found')
  return product
}

const requireAvailableProduct = async (productId: string) => {
  const product = await requireProduct(productId)
  const schedulingSetting = await AppSetting.findByPk('menu_scheduling_enabled')
  const schedulingEnabled = (schedulingSetting?.value as unknown) === true
  const now = new Date()
  const outsideAvailabilityWindow = schedulingEnabled && (
    (product.availableFrom !== null && product.availableFrom > now) ||
    (product.availableUntil !== null && product.availableUntil <= now)
  )
  if (!product.isActive || product.archivedAt !== null || outsideAvailabilityWindow) {
    throw new HttpError(400, 'Product is not currently available')
  }
  return product
}

const requireCartItem = async (cart: Cart | null, productId: string) => {
  if (!cart) throw new HttpError(404, 'Cart item not found')
  const item = await CartItem.findOne({ where: { cartId: cart.id, productId } })
  if (!item) throw new HttpError(404, 'Cart item not found')
  return item
}

export const getCart = asyncHandler(async (request, response) => {
  response.json({ cart: await toCartResponse(request.cartContext?.cart ?? null) })
})

export const addCartItem = asyncHandler(async (request, response) => {
  const input = request.validatedBody as CartAddItemInput
  await requireAvailableProduct(input.productId)

  const context = request.cartContext
  if (!context) throw new HttpError(500, 'Cart context is unavailable')
  if (!context.cart) {
    if (!context.isGuest || !context.guestTokenHash || !context.guestExpiresAt) {
      throw new HttpError(500, 'Guest cart context is unavailable')
    }
    context.cart = await Cart.create({
      userId: null,
      guestTokenHash: context.guestTokenHash,
      status: 'active',
      expiresAt: context.guestExpiresAt,
    })
  }

  const existingItem = await CartItem.findOne({
    where: { cartId: context.cart.id, productId: input.productId },
  })
  if (existingItem) {
    await existingItem.update({ quantity: existingItem.quantity + input.quantity })
  } else {
    await CartItem.create({
      cartId: context.cart.id,
      productId: input.productId,
      quantity: input.quantity,
    })
  }

  response.json({ cart: await toCartResponse(context.cart) })
})

export const updateCartItem = asyncHandler(async (request, response) => {
  const input = request.validatedBody as CartUpdateItemInput
  const cart = request.cartContext?.cart ?? null
  const item = await requireCartItem(cart, request.params.productId)
  await item.update({ quantity: input.quantity })
  response.json({ cart: await toCartResponse(cart) })
})

export const deleteCartItem = asyncHandler(async (request, response) => {
  const cart = request.cartContext?.cart ?? null
  const item = await requireCartItem(cart, request.params.productId)
  await item.update({ isDeleted: true })
  response.json({ cart: await toCartResponse(cart) })
})
