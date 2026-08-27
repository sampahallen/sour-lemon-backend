import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { Order } from './Order.js'
import {
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  JsonObject,
} from './types.js'

export class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
  declare id: CreationOptional<string>
  declare orderId: ForeignKey<Order['id']>
  declare provider: PaymentProvider
  declare method: PaymentMethod
  declare status: CreationOptional<PaymentStatus>
  declare amount: string
  declare currency: CreationOptional<string>
  declare providerReference: string | null
  declare checkoutUrl: string | null
  declare failureCode: string | null
  declare failureMessage: string | null
  declare paidAt: Date | null
  declare providerData: JsonObject | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initPayment = (sequelize: Sequelize) => {
  Payment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.UUID, allowNull: false },
      provider: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [[...PAYMENT_PROVIDERS]] },
      },
      method: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [[...PAYMENT_METHODS]] },
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'pending',
        validate: { isIn: [[...PAYMENT_STATUSES]] },
      },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0.01 } },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'GHS' },
      providerReference: { type: DataTypes.STRING(160), allowNull: true, unique: true },
      checkoutUrl: { type: DataTypes.TEXT, allowNull: true, validate: { isUrl: true } },
      failureCode: { type: DataTypes.TEXT, allowNull: true },
      failureMessage: { type: DataTypes.TEXT, allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      providerData: { type: DataTypes.JSONB, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'payments',
      modelName: 'Payment',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['order_id', 'status'] }],
      validate: {
        validProviderAndMethod(this: Payment) {
          if (this.provider === 'cash' && this.method !== 'cash') {
            throw new Error('Cash payments must use the cash method')
          }
          if (this.provider === 'paystack' && this.method === 'cash') {
            throw new Error('Paystack payments cannot use the cash method')
          }
        },
      },
    },
  )

  return Payment
}
