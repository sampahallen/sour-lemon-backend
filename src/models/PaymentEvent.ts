import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { Payment } from './Payment.js'
import { JsonObject, PAYMENT_PROVIDERS, PaymentProvider } from './types.js'

export class PaymentEvent extends Model<
  InferAttributes<PaymentEvent>,
  InferCreationAttributes<PaymentEvent>
> {
  declare id: CreationOptional<string>
  declare paymentId: ForeignKey<Payment['id']> | null
  declare provider: PaymentProvider
  declare eventKey: string
  declare eventType: string
  declare payload: JsonObject
  declare processedAt: Date | null
  declare processingError: string | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

export const initPaymentEvent = (sequelize: Sequelize) => {
  PaymentEvent.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      paymentId: { type: DataTypes.UUID, allowNull: true },
      provider: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [[...PAYMENT_PROVIDERS]] },
      },
      eventKey: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      eventType: { type: DataTypes.STRING(100), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false },
      processedAt: { type: DataTypes.DATE, allowNull: true },
      processingError: { type: DataTypes.TEXT, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'payment_events',
      modelName: 'PaymentEvent',
      underscored: true,
      updatedAt: false,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['payment_id'] }, { fields: ['processed_at'] }],
    },
  )

  return PaymentEvent
}
