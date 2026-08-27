import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { DeliveryArea } from './DeliveryArea.js'
import {
  DeliveryAddressSnapshot,
  FULFILLMENT_TYPES,
  FulfillmentType,
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_STATUSES,
  PaymentStatus,
} from './types.js'
import { User } from './User.js'

export class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
  declare id: CreationOptional<string>
  declare orderNumber: string
  declare userId: ForeignKey<User['id']> | null
  declare deliveryAreaId: ForeignKey<DeliveryArea['id']> | null
  declare status: CreationOptional<OrderStatus>
  declare paymentStatus: CreationOptional<PaymentStatus>
  declare fulfillmentType: FulfillmentType
  declare customerName: string
  declare phoneNumber: string
  declare whatsappNumber: string | null
  declare deliveryAddress: DeliveryAddressSnapshot | null
  declare subtotal: string
  declare deliveryFee: CreationOptional<string>
  declare total: string
  declare currency: CreationOptional<string>
  declare customerNotes: string | null
  declare placedAt: Date | null
  declare confirmedAt: Date | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initOrder = (sequelize: Sequelize) => {
  Order.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderNumber: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      deliveryAreaId: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'pending_payment',
        validate: { isIn: [[...ORDER_STATUSES]] },
      },
      paymentStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'pending',
        validate: { isIn: [[...PAYMENT_STATUSES]] },
      },
      fulfillmentType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        validate: { isIn: [[...FULFILLMENT_TYPES]] },
      },
      customerName: { type: DataTypes.STRING(120), allowNull: false },
      phoneNumber: { type: DataTypes.STRING(32), allowNull: false },
      whatsappNumber: { type: DataTypes.STRING(32), allowNull: true },
      deliveryAddress: { type: DataTypes.JSONB, allowNull: true },
      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
      deliveryFee: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: '0.00',
        validate: { min: 0 },
      },
      total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'GHS' },
      customerNotes: { type: DataTypes.TEXT, allowNull: true },
      placedAt: { type: DataTypes.DATE, allowNull: true },
      confirmedAt: { type: DataTypes.DATE, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'orders',
      modelName: 'Order',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        { fields: ['status', 'created_at'] },
        { fields: ['delivery_area_id', 'status', 'created_at'] },
        { fields: ['user_id', 'created_at'] },
      ],
      validate: {
        fulfillmentDetails(this: Order) {
          if (this.fulfillmentType === 'pickup' && this.deliveryAddress) {
            throw new Error('Pickup orders cannot have a delivery address')
          }
          if (this.fulfillmentType !== 'pickup' && !this.deliveryAddress) {
            throw new Error('Delivery orders require a delivery address')
          }
        },
        totalsMatch(this: Order) {
          const subtotal = Math.round(Number(this.subtotal) * 100)
          const deliveryFee = Math.round(Number(this.deliveryFee) * 100)
          const total = Math.round(Number(this.total) * 100)
          if (subtotal + deliveryFee !== total) {
            throw new Error('Order total must equal subtotal plus delivery fee')
          }
        },
      },
    },
  )

  return Order
}
