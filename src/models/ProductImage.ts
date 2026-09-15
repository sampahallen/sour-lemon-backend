import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { Product } from './Product.js'

export class ProductImage extends Model<
  InferAttributes<ProductImage>,
  InferCreationAttributes<ProductImage>
> {
  declare id: CreationOptional<string>
  declare productId: ForeignKey<Product['id']>
  declare url: string
  declare storageKey: string
  declare altText: string | null
  declare sortOrder: CreationOptional<number>
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

export const initProductImage = (sequelize: Sequelize) => {
  ProductImage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productId: { type: DataTypes.UUID, allowNull: false },
      url: { type: DataTypes.TEXT, allowNull: false, validate: { isUrl: true } },
      storageKey: { type: DataTypes.TEXT, allowNull: false, unique: true },
      altText: { type: DataTypes.STRING(255), allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'product_images',
      modelName: 'ProductImage',
      underscored: true,
      updatedAt: false,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['product_id', 'sort_order'] }],
    },
  )

  return ProductImage
}
