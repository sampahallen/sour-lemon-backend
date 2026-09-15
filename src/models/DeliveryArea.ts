import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class DeliveryArea extends Model<
  InferAttributes<DeliveryArea>,
  InferCreationAttributes<DeliveryArea>
> {
  declare id: CreationOptional<string>
  declare name: string
  declare slug: string
  declare deliveryFee: string | null
  declare isActive: CreationOptional<boolean>
  declare isDeleted: CreationOptional<boolean>
  declare sortOrder: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initDeliveryArea = (sequelize: Sequelize) => {
  DeliveryArea.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
      deliveryFee: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'delivery_areas',
      modelName: 'DeliveryArea',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
    },
  )

  return DeliveryArea
}
