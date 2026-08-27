import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { USER_ROLES, UserRole } from './types.js'

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>
  declare name: string
  declare phoneNumber: string
  declare passwordHash: string
  declare whatsappNumber: string | null
  declare role: CreationOptional<UserRole>
  declare isActive: CreationOptional<boolean>
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initUser = (sequelize: Sequelize) => {
  User.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      phoneNumber: { type: DataTypes.STRING(32), allowNull: false },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      whatsappNumber: { type: DataTypes.STRING(32), allowNull: true },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'customer',
        validate: { isIn: [[...USER_ROLES]] },
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'users',
      modelName: 'User',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        {
          name: 'users_active_phone_unique',
          unique: true,
          fields: ['phone_number'],
          where: { is_deleted: false },
        },
      ],
    },
  )

  return User
}
