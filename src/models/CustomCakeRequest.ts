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
import { CUSTOM_CAKE_STATUSES, CustomCakeStatus } from './types.js'
import { User } from './User.js'

export class CustomCakeRequest extends Model<
  InferAttributes<CustomCakeRequest>,
  InferCreationAttributes<CustomCakeRequest>
> {
  declare id: CreationOptional<string>
  declare userId: ForeignKey<User['id']> | null
  declare orderId: ForeignKey<Order['id']> | null
  declare customerName: string
  declare phoneNumber: string
  declare whatsappNumber: string | null
  declare occasion: string
  declare requestedSize: string
  declare notes: string | null
  declare status: CreationOptional<CustomCakeStatus>
  declare quotedAmount: string | null
  declare currency: CreationOptional<string>
  declare quotedByUserId: ForeignKey<User['id']> | null
  declare quotedAt: Date | null
  declare quoteExpiresAt: Date | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initCustomCakeRequest = (sequelize: Sequelize) => {
  CustomCakeRequest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      orderId: { type: DataTypes.UUID, allowNull: true, unique: true },
      customerName: { type: DataTypes.STRING(120), allowNull: false },
      phoneNumber: { type: DataTypes.STRING(32), allowNull: false },
      whatsappNumber: { type: DataTypes.STRING(32), allowNull: true },
      occasion: { type: DataTypes.STRING(160), allowNull: false },
      requestedSize: { type: DataTypes.STRING(100), allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'submitted',
        validate: { isIn: [[...CUSTOM_CAKE_STATUSES]] },
      },
      quotedAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'GHS' },
      quotedByUserId: { type: DataTypes.UUID, allowNull: true },
      quotedAt: { type: DataTypes.DATE, allowNull: true },
      quoteExpiresAt: { type: DataTypes.DATE, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'custom_cake_requests',
      modelName: 'CustomCakeRequest',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['status', 'created_at'] }, { fields: ['user_id'] }],
      validate: {
        validQuote(this: CustomCakeRequest) {
          const requiresQuote = ['quoted', 'awaiting_payment', 'confirmed'].includes(this.status)
          if (requiresQuote && (!this.quotedAmount || !this.quotedAt)) {
            throw new Error('Quoted custom cake requests require an amount and quote date')
          }
          if (this.quoteExpiresAt && this.quotedAt && this.quoteExpiresAt <= this.quotedAt) {
            throw new Error('Quote expiry must be later than quote date')
          }
        },
      },
    },
  )

  return CustomCakeRequest
}
