import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Op,
  Sequelize,
} from 'sequelize'
import { CART_STATUSES, CartStatus } from './types.js'
import { User } from './User.js'

export class Cart extends Model<InferAttributes<Cart>, InferCreationAttributes<Cart>> {
  declare id: CreationOptional<string>
  declare userId: ForeignKey<User['id']> | null
  declare guestTokenHash: string | null
  declare status: CreationOptional<CartStatus>
  declare expiresAt: Date | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initCart = (sequelize: Sequelize) => {
  Cart.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      guestTokenHash: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        validate: { isIn: [[...CART_STATUSES]] },
      },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'carts',
      modelName: 'Cart',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        {
          name: 'carts_one_active_per_user',
          unique: true,
          fields: ['user_id'],
          where: {
            status: 'active',
            is_deleted: false,
            user_id: { [Op.ne]: null },
          },
        },
      ],
      validate: {
        exactlyOneOwner(this: Cart) {
          if ((this.userId === null) === (this.guestTokenHash === null)) {
            throw new Error('A cart must belong to exactly one user or guest token')
          }
          if (this.guestTokenHash && !this.expiresAt) {
            throw new Error('Guest carts require an expiry date')
          }
        },
      },
    },
  )

  return Cart
}
