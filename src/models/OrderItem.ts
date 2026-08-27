import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { Order } from './Order.js'
import { Product } from './Product.js'

export class OrderItem extends Model<
  InferAttributes<OrderItem>,
  InferCreationAttributes<OrderItem>
> {
  declare id: CreationOptional<string>
  declare orderId: ForeignKey<Order['id']>
  declare productId: ForeignKey<Product['id']> | null
  declare productName: string
  declare productDescription: string | null
  declare quantity: number
  declare unitPrice: string
  declare lineTotal: string
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

export const initOrderItem = (sequelize: Sequelize) => {
  OrderItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: true },
      productName: { type: DataTypes.STRING(160), allowNull: false },
      productDescription: { type: DataTypes.TEXT, allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
      unitPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      lineTotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'order_items',
      modelName: 'OrderItem',
      underscored: true,
      updatedAt: false,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['order_id'] }, { fields: ['product_id'] }],
      validate: {
        lineTotalMatches(this: OrderItem) {
          const unitPrice = Math.round(Number(this.unitPrice) * 100)
          const lineTotal = Math.round(Number(this.lineTotal) * 100)
          if (unitPrice * this.quantity !== lineTotal) {
            throw new Error('Line total must equal unit price times quantity')
          }
        },
      },
    },
  )

  return OrderItem
}
