import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { JsonObject } from './types.js'
import { User } from './User.js'

export class AppSetting extends Model<
  InferAttributes<AppSetting>,
  InferCreationAttributes<AppSetting>
> {
  declare key: string
  declare value: JsonObject
  declare description: string | null
  declare updatedByUserId: ForeignKey<User['id']> | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initAppSetting = (sequelize: Sequelize) => {
  AppSetting.init(
    {
      key: { type: DataTypes.STRING(100), allowNull: false, primaryKey: true },
      value: { type: DataTypes.JSONB, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      updatedByUserId: { type: DataTypes.UUID, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'app_settings',
      modelName: 'AppSetting',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
    },
  )

  return AppSetting
}
