import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class JournalCategory extends Model<
  InferAttributes<JournalCategory>,
  InferCreationAttributes<JournalCategory>
> {
  declare id: CreationOptional<string>
  declare name: string
  declare slug: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare sortOrder: CreationOptional<number>
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export const initJournalCategory = (sequelize: Sequelize) => {
  JournalCategory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
      slug: { type: DataTypes.STRING(120), allowNull: false, validate: { notEmpty: true } },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'journal_categories',
      modelName: 'JournalCategory',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        {
          name: 'journal_categories_active_slug_unique',
          unique: true,
          fields: ['slug'],
          where: { is_deleted: false },
        },
        { fields: ['is_active', 'sort_order'] },
      ],
    },
  )

  return JournalCategory
}
