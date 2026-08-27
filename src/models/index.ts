import { Sequelize } from 'sequelize'
import { Address, initAddress } from './Address.js'
import { AppSetting, initAppSetting } from './AppSetting.js'
import { AuthSession, initAuthSession } from './AuthSession.js'
import { Cart, initCart } from './Cart.js'
import { CartItem, initCartItem } from './CartItem.js'
import { Category, initCategory } from './Category.js'
import { CustomCakeImage, initCustomCakeImage } from './CustomCakeImage.js'
import { CustomCakeRequest, initCustomCakeRequest } from './CustomCakeRequest.js'
import { DeliveryArea, initDeliveryArea } from './DeliveryArea.js'
import { JournalCategory, initJournalCategory } from './JournalCategory.js'
import { JournalPost, initJournalPost } from './JournalPost.js'
import { JournalPostImage, initJournalPostImage } from './JournalPostImage.js'
import { Order, initOrder } from './Order.js'
import { OrderItem, initOrderItem } from './OrderItem.js'
import { OrderStatusHistory, initOrderStatusHistory } from './OrderStatusHistory.js'
import { Payment, initPayment } from './Payment.js'
import { PaymentEvent, initPaymentEvent } from './PaymentEvent.js'
import { Product, initProduct } from './Product.js'
import { ProductImage, initProductImage } from './ProductImage.js'
import { SiteSection, initSiteSection } from './SiteSection.js'
import { User, initUser } from './User.js'

let initialized = false

export const initializeModels = (sequelize: Sequelize) => {
  if (initialized) return

  initUser(sequelize)
  initAuthSession(sequelize)
  initDeliveryArea(sequelize)
  initAddress(sequelize)
  initSiteSection(sequelize)
  initCategory(sequelize)
  initProduct(sequelize)
  initProductImage(sequelize)
  initCart(sequelize)
  initCartItem(sequelize)
  initOrder(sequelize)
  initOrderItem(sequelize)
  initOrderStatusHistory(sequelize)
  initPayment(sequelize)
  initPaymentEvent(sequelize)
  initCustomCakeRequest(sequelize)
  initCustomCakeImage(sequelize)
  initAppSetting(sequelize)
  initJournalCategory(sequelize)
  initJournalPost(sequelize)
  initJournalPostImage(sequelize)

  User.hasMany(Address, { as: 'addresses', foreignKey: 'userId', onDelete: 'CASCADE' })
  Address.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' })
  DeliveryArea.hasMany(Address, {
    as: 'addresses',
    foreignKey: 'deliveryAreaId',
    onDelete: 'RESTRICT',
  })
  Address.belongsTo(DeliveryArea, {
    as: 'deliveryArea',
    foreignKey: 'deliveryAreaId',
    onDelete: 'RESTRICT',
  })

  User.hasMany(AuthSession, { as: 'authSessions', foreignKey: 'userId', onDelete: 'CASCADE' })
  AuthSession.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' })

  SiteSection.hasMany(Category, {
    as: 'categories',
    foreignKey: 'siteSectionId',
    onDelete: 'RESTRICT',
  })
  Category.belongsTo(SiteSection, {
    as: 'siteSection',
    foreignKey: 'siteSectionId',
    onDelete: 'RESTRICT',
  })
  Category.hasMany(Product, {
    as: 'products',
    foreignKey: 'categoryId',
    onDelete: 'RESTRICT',
  })
  Product.belongsTo(Category, {
    as: 'category',
    foreignKey: 'categoryId',
    onDelete: 'RESTRICT',
  })
  Product.hasMany(ProductImage, { as: 'images', foreignKey: 'productId', onDelete: 'CASCADE' })
  ProductImage.belongsTo(Product, {
    as: 'product',
    foreignKey: 'productId',
    onDelete: 'CASCADE',
  })

  User.hasMany(Cart, { as: 'carts', foreignKey: 'userId', onDelete: 'SET NULL' })
  Cart.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'SET NULL' })
  Cart.hasMany(CartItem, { as: 'items', foreignKey: 'cartId', onDelete: 'CASCADE' })
  CartItem.belongsTo(Cart, { as: 'cart', foreignKey: 'cartId', onDelete: 'CASCADE' })
  Product.hasMany(CartItem, {
    as: 'cartItems',
    foreignKey: 'productId',
    onDelete: 'RESTRICT',
  })
  CartItem.belongsTo(Product, {
    as: 'product',
    foreignKey: 'productId',
    onDelete: 'RESTRICT',
  })

  User.hasMany(Order, { as: 'orders', foreignKey: 'userId', onDelete: 'SET NULL' })
  Order.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'SET NULL' })
  DeliveryArea.hasMany(Order, {
    as: 'orders',
    foreignKey: 'deliveryAreaId',
    onDelete: 'RESTRICT',
  })
  Order.belongsTo(DeliveryArea, {
    as: 'deliveryArea',
    foreignKey: 'deliveryAreaId',
    onDelete: 'RESTRICT',
  })
  Order.hasMany(OrderItem, { as: 'items', foreignKey: 'orderId', onDelete: 'CASCADE' })
  OrderItem.belongsTo(Order, { as: 'order', foreignKey: 'orderId', onDelete: 'CASCADE' })
  Product.hasMany(OrderItem, {
    as: 'orderItems',
    foreignKey: 'productId',
    onDelete: 'SET NULL',
  })
  OrderItem.belongsTo(Product, {
    as: 'product',
    foreignKey: 'productId',
    onDelete: 'SET NULL',
  })

  Order.hasMany(OrderStatusHistory, {
    as: 'statusHistory',
    foreignKey: 'orderId',
    onDelete: 'CASCADE',
  })
  OrderStatusHistory.belongsTo(Order, {
    as: 'order',
    foreignKey: 'orderId',
    onDelete: 'CASCADE',
  })
  User.hasMany(OrderStatusHistory, {
    as: 'orderStatusChanges',
    foreignKey: 'changedByUserId',
    onDelete: 'SET NULL',
  })
  OrderStatusHistory.belongsTo(User, {
    as: 'changedBy',
    foreignKey: 'changedByUserId',
    onDelete: 'SET NULL',
  })

  Order.hasMany(Payment, { as: 'payments', foreignKey: 'orderId', onDelete: 'RESTRICT' })
  Payment.belongsTo(Order, { as: 'order', foreignKey: 'orderId', onDelete: 'RESTRICT' })
  Payment.hasMany(PaymentEvent, {
    as: 'events',
    foreignKey: 'paymentId',
    onDelete: 'SET NULL',
  })
  PaymentEvent.belongsTo(Payment, {
    as: 'payment',
    foreignKey: 'paymentId',
    onDelete: 'SET NULL',
  })

  User.hasMany(CustomCakeRequest, {
    as: 'customCakeRequests',
    foreignKey: 'userId',
    onDelete: 'SET NULL',
  })
  CustomCakeRequest.belongsTo(User, {
    as: 'user',
    foreignKey: 'userId',
    onDelete: 'SET NULL',
  })
  User.hasMany(CustomCakeRequest, {
    as: 'customCakeQuotes',
    foreignKey: 'quotedByUserId',
    onDelete: 'SET NULL',
  })
  CustomCakeRequest.belongsTo(User, {
    as: 'quotedBy',
    foreignKey: 'quotedByUserId',
    onDelete: 'SET NULL',
  })
  Order.hasOne(CustomCakeRequest, {
    as: 'customCakeRequest',
    foreignKey: 'orderId',
    onDelete: 'RESTRICT',
  })
  CustomCakeRequest.belongsTo(Order, {
    as: 'order',
    foreignKey: 'orderId',
    onDelete: 'RESTRICT',
  })
  CustomCakeRequest.hasMany(CustomCakeImage, {
    as: 'images',
    foreignKey: 'customCakeRequestId',
    onDelete: 'CASCADE',
  })
  CustomCakeImage.belongsTo(CustomCakeRequest, {
    as: 'customCakeRequest',
    foreignKey: 'customCakeRequestId',
    onDelete: 'CASCADE',
  })

  User.hasMany(AppSetting, {
    as: 'updatedSettings',
    foreignKey: 'updatedByUserId',
    onDelete: 'SET NULL',
  })
  AppSetting.belongsTo(User, {
    as: 'updatedBy',
    foreignKey: 'updatedByUserId',
    onDelete: 'SET NULL',
  })

  JournalCategory.hasMany(JournalPost, {
    as: 'posts',
    foreignKey: 'categoryId',
    onDelete: 'RESTRICT',
  })
  JournalPost.belongsTo(JournalCategory, {
    as: 'category',
    foreignKey: 'categoryId',
    onDelete: 'RESTRICT',
  })
  User.hasMany(JournalPost, {
    as: 'journalPosts',
    foreignKey: 'authorUserId',
    onDelete: 'SET NULL',
  })
  JournalPost.belongsTo(User, {
    as: 'author',
    foreignKey: 'authorUserId',
    onDelete: 'SET NULL',
  })
  JournalPost.hasMany(JournalPostImage, {
    as: 'images',
    foreignKey: 'journalPostId',
    onDelete: 'CASCADE',
  })
  JournalPostImage.belongsTo(JournalPost, {
    as: 'post',
    foreignKey: 'journalPostId',
    onDelete: 'CASCADE',
  })

  initialized = true
}

export {
  Address,
  AppSetting,
  AuthSession,
  Cart,
  CartItem,
  Category,
  CustomCakeImage,
  CustomCakeRequest,
  DeliveryArea,
  JournalCategory,
  JournalPost,
  JournalPostImage,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  PaymentEvent,
  Product,
  ProductImage,
  SiteSection,
  User,
}

export * from './types.js'
