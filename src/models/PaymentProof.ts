import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize'
import { Payment } from './Payment.js'
import { CustomCakeRequest } from './CustomCakeRequest.js'
import { User } from './User.js'

export class PaymentProof extends Model<InferAttributes<PaymentProof>, InferCreationAttributes<PaymentProof>> {
  declare id: CreationOptional<string>
  declare paymentId: ForeignKey<Payment['id']> | null
  declare customCakeRequestId: ForeignKey<CustomCakeRequest['id']> | null
  declare reference: string | null
  declare storageKey: string | null
  declare imageType: string | null
  declare status: CreationOptional<'submitted' | 'rejected' | 'confirmed'>
  declare rejectionReason: string | null
  declare reviewedByUserId: ForeignKey<User['id']> | null
  declare reviewedAt: Date | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initPaymentProof = (sequelize: Sequelize) => PaymentProof.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  paymentId: { type: DataTypes.UUID, allowNull: true },
  customCakeRequestId: { type: DataTypes.UUID, allowNull: true },
  reference: { type: DataTypes.STRING(160), allowNull: true },
  storageKey: { type: DataTypes.TEXT, allowNull: true },
  imageType: { type: DataTypes.STRING(32), allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'submitted' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true },
  reviewedByUserId: { type: DataTypes.UUID, allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: 'payment_proofs', modelName: 'PaymentProof', underscored: true })
