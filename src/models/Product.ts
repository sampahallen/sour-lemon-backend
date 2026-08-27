import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { Category } from './Category.js'

export class Product extends Model<InferAttributes<Product>, InferCreationAttributes<Product>> {
  declare id: CreationOptional<string>
  declare categoryId: ForeignKey<Category['id']>
  declare name: string
  declare slug: string
  declare description: string | null
  declare price: string
  declare currency: CreationOptional<string>
  declare isActive: CreationOptional<boolean>
  declare availableFrom: Date | null
  declare availableUntil: Date | null
  declare archivedAt: Date | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initProduct = (sequelize: Sequelize) => {
  Product.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'GHS' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      availableFrom: { type: DataTypes.DATE, allowNull: true },
      availableUntil: { type: DataTypes.DATE, allowNull: true },
      archivedAt: { type: DataTypes.DATE, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'products',
      modelName: 'Product',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        { fields: ['category_id', 'is_active', 'available_from', 'available_until'] },
      ],
      validate: {
        validAvailabilityWindow(this: Product) {
          if (
            this.availableFrom &&
            this.availableUntil &&
            this.availableUntil <= this.availableFrom
          ) {
            throw new Error('availableUntil must be later than availableFrom')
          }
        },
      },
    },
  )

  return Product
}
