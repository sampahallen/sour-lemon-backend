import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class SiteSection extends Model<
  InferAttributes<SiteSection>,
  InferCreationAttributes<SiteSection>
> {
  declare id: CreationOptional<string>
  declare key: string
  declare name: string
  declare isEnabled: CreationOptional<boolean>
  declare showComingSoon: CreationOptional<boolean>
  declare isDeleted: CreationOptional<boolean>
  declare sortOrder: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initSiteSection = (sequelize: Sequelize) => {
  SiteSection.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      showComingSoon: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'site_sections',
      modelName: 'SiteSection',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
    },
  )

  return SiteSection
}
