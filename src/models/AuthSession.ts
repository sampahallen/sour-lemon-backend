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

export class AuthSession extends Model<
  InferAttributes<AuthSession>,
  InferCreationAttributes<AuthSession>
> {
  declare id: CreationOptional<string>
  declare userId: ForeignKey<User['id']>
  declare refreshTokenHash: string
  declare expiresAt: Date
  declare revokedAt: Date | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

export const initAuthSession = (sequelize: Sequelize) => {
  AuthSession.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      refreshTokenHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'auth_sessions',
      modelName: 'AuthSession',
      underscored: true,
      updatedAt: false,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['user_id', 'expires_at'] }],
    },
  )

  return AuthSession
}
