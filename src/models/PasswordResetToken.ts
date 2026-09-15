import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { User } from './User.js'

export class PasswordResetToken extends Model<
  InferAttributes<PasswordResetToken>,
  InferCreationAttributes<PasswordResetToken>
> {
  declare id: CreationOptional<string>
  declare userId: ForeignKey<User['id']>
  declare tokenHash: string
  declare expiresAt: Date
  declare usedAt: Date | null
  declare createdAt: CreationOptional<Date>
}

export const initPasswordResetToken = (sequelize: Sequelize) => {
  PasswordResetToken.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'password_reset_tokens',
      modelName: 'PasswordResetToken',
      underscored: true,
      updatedAt: false,
      indexes: [{ fields: ['user_id', 'expires_at'] }],
    },
  )

  return PasswordResetToken
}
