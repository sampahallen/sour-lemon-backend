import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { SiteSection } from './SiteSection.js'

export class Category extends Model<InferAttributes<Category>, InferCreationAttributes<Category>> {
  declare id: CreationOptional<string>
  declare siteSectionId: ForeignKey<SiteSection['id']>
  declare name: string
  declare slug: string
  declare isActive: CreationOptional<boolean>
  declare isDeleted: CreationOptional<boolean>
  declare sortOrder: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initCategory = (sequelize: Sequelize) => {
  Category.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      siteSectionId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'categories',
      modelName: 'Category',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [{ fields: ['site_section_id', 'is_active', 'sort_order'] }],
    },
  )

  return Category
}
