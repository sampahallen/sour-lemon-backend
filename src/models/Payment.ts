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
import { User } from './User.js'
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
  declare paymentName: string | null
  declare status: CreationOptional<PaymentStatus>
  declare amount: string
  declare currency: CreationOptional<string>
  declare providerReference: string | null
  declare checkoutUrl: string | null
  declare providerAccessCode: string | null
  declare failureCode: string | null
  declare failureMessage: string | null
  declare paidAt: Date | null
  declare requiresManualConfirmation: CreationOptional<boolean>
  declare adminConfirmedAt: Date | null
  declare adminConfirmedByUserId: ForeignKey<User['id']> | null
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
      paymentName: { type: DataTypes.STRING(120), allowNull: true },
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
      providerAccessCode: { type: DataTypes.STRING(255), allowNull: true },
      failureCode: { type: DataTypes.TEXT, allowNull: true },
      failureMessage: { type: DataTypes.TEXT, allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      requiresManualConfirmation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      adminConfirmedAt: { type: DataTypes.DATE, allowNull: true },
      adminConfirmedByUserId: { type: DataTypes.UUID, allowNull: true },
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
      indexes: [
        { fields: ['order_id', 'status'] },
        {
          name: 'payments_manual_confirmation_queue',
          fields: ['requires_manual_confirmation', 'admin_confirmed_at'],
        },
      ],
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
