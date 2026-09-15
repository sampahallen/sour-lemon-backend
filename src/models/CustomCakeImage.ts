import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { CustomCakeRequest } from './CustomCakeRequest.js'

export class CustomCakeImage extends Model<
  InferAttributes<CustomCakeImage>,
  InferCreationAttributes<CustomCakeImage>
> {
  declare id: CreationOptional<string>
  declare customCakeRequestId: ForeignKey<CustomCakeRequest['id']>
  declare url: string
  declare storageKey: string
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

export const initCustomCakeImage = (sequelize: Sequelize) => {
  CustomCakeImage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      customCakeRequestId: { type: DataTypes.UUID, allowNull: false },
      url: { type: DataTypes.TEXT, allowNull: false, validate: { isUrl: true } },
      storageKey: { type: DataTypes.TEXT, allowNull: false, unique: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'custom_cake_images',
      modelName: 'CustomCakeImage',
      underscored: true,
      updatedAt: false,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['custom_cake_request_id'] }],
    },
  )

  return CustomCakeImage
}
