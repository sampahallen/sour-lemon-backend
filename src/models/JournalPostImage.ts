import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { JournalPost } from './JournalPost.js'
import { JOURNAL_IMAGE_ROLES, JournalImageRole } from './types.js'

export class JournalPostImage extends Model<
  InferAttributes<JournalPostImage>,
  InferCreationAttributes<JournalPostImage>
> {
  declare id: CreationOptional<string>
  declare journalPostId: ForeignKey<JournalPost['id']>
  declare role: JournalImageRole
  declare url: string
  declare storageKey: string
  declare altText: string
  declare caption: string | null
  declare sortOrder: CreationOptional<number>
  declare contentType: string | null
  declare sizeBytes: number | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

export const initJournalPostImage = (sequelize: Sequelize) => {
  JournalPostImage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      journalPostId: { type: DataTypes.UUID, allowNull: false },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [[...JOURNAL_IMAGE_ROLES]] },
      },
      url: { type: DataTypes.TEXT, allowNull: false, validate: { isUrl: true } },
      storageKey: { type: DataTypes.TEXT, allowNull: false, unique: true },
      altText: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
      caption: { type: DataTypes.TEXT, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      contentType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        validate: { isIn: [['image/jpeg', 'image/png', 'image/webp']] },
      },
      sizeBytes: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1 } },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'journal_post_images',
      modelName: 'JournalPostImage',
      underscored: true,
      updatedAt: false,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        {
          name: 'journal_post_images_one_cover_per_post',
          unique: true,
          fields: ['journal_post_id'],
          where: { role: 'cover', is_deleted: false },
        },
        { fields: ['journal_post_id', 'role', 'sort_order'] },
      ],
    },
  )

  return JournalPostImage
}
