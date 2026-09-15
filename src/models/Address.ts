import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { DeliveryArea } from './DeliveryArea.js'
import { User } from './User.js'

export class Address extends Model<InferAttributes<Address>, InferCreationAttributes<Address>> {
  declare id: CreationOptional<string>
  declare userId: ForeignKey<User['id']>
  declare deliveryAreaId: ForeignKey<DeliveryArea['id']> | null
  declare label: string | null
  declare recipientName: string
  declare phoneNumber: string
  declare addressLine1: string
  declare addressLine2: string | null
  declare city: string
  declare landmark: string | null
  declare isDefault: CreationOptional<boolean>
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initAddress = (sequelize: Sequelize) => {
  Address.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      deliveryAreaId: { type: DataTypes.UUID, allowNull: true },
      label: { type: DataTypes.STRING(50), allowNull: true },
      recipientName: { type: DataTypes.STRING(120), allowNull: false },
      phoneNumber: { type: DataTypes.STRING(32), allowNull: false },
      addressLine1: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'address_line_1',
      },
      addressLine2: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'address_line_2',
      },
      city: { type: DataTypes.STRING(120), allowNull: false },
      landmark: { type: DataTypes.STRING(255), allowNull: true },
      isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'addresses',
      modelName: 'Address',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        { fields: ['user_id'] },
        { fields: ['delivery_area_id'] },
        {
          name: 'addresses_one_default_per_user',
          unique: true,
          fields: ['user_id'],
          where: { is_default: true, is_deleted: false },
        },
      ],
    },
  )

  return Address
}
