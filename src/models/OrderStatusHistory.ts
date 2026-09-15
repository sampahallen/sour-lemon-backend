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
import { ORDER_STATUSES, OrderStatus } from './types.js'
import { User } from './User.js'

export class OrderStatusHistory extends Model<
  InferAttributes<OrderStatusHistory>,
  InferCreationAttributes<OrderStatusHistory>
> {
  declare id: CreationOptional<string>
  declare orderId: ForeignKey<Order['id']>
  declare fromStatus: OrderStatus | null
  declare toStatus: OrderStatus
  declare changedByUserId: ForeignKey<User['id']> | null
  declare note: string | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

export const initOrderStatusHistory = (sequelize: Sequelize) => {
  OrderStatusHistory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.UUID, allowNull: false },
      fromStatus: {
        type: DataTypes.STRING(32),
        allowNull: true,
        validate: { isIn: [[...ORDER_STATUSES]] },
      },
      toStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        validate: { isIn: [[...ORDER_STATUSES]] },
      },
      changedByUserId: { type: DataTypes.UUID, allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'order_status_history',
      modelName: 'OrderStatusHistory',
      underscored: true,
      updatedAt: false,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['order_id', 'created_at'] }],
    },
  )

  return OrderStatusHistory
}
