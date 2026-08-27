import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { Cart } from './Cart.js'
import { Product } from './Product.js'

export class CartItem extends Model<InferAttributes<CartItem>, InferCreationAttributes<CartItem>> {
  declare id: CreationOptional<string>
  declare cartId: ForeignKey<Cart['id']>
  declare productId: ForeignKey<Product['id']>
  declare quantity: number
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initCartItem = (sequelize: Sequelize) => {
  CartItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      cartId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'cart_items',
      modelName: 'CartItem',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        {
          unique: true,
          fields: ['cart_id', 'product_id'],
          where: { is_deleted: false },
        },
      ],
    },
  )

  return CartItem
}
