import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { JournalCategory } from './JournalCategory.js'
import { JOURNAL_POST_STATUSES, JournalBody, JournalPostStatus } from './types.js'
import { User } from './User.js'

export class JournalPost extends Model<
  InferAttributes<JournalPost>,
  InferCreationAttributes<JournalPost>
> {
  declare id: CreationOptional<string>
  declare categoryId: ForeignKey<JournalCategory['id']>
  declare authorUserId: ForeignKey<User['id']> | null
  declare title: string
  declare slug: string
  declare excerpt: string | null
  declare body: JournalBody
  declare status: CreationOptional<JournalPostStatus>
  declare scheduledFor: Date | null
  declare publishedAt: Date | null
  declare archivedAt: Date | null
  declare isDeleted: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

const emptyBody = (): JournalBody => ({ version: 1, blocks: [] })

export const initJournalPost = (sequelize: Sequelize) => {
  JournalPost.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      authorUserId: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: true } },
      slug: { type: DataTypes.STRING(220), allowNull: false, validate: { notEmpty: true } },
      excerpt: { type: DataTypes.TEXT, allowNull: true },
      body: { type: DataTypes.JSONB, allowNull: false, defaultValue: emptyBody },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        validate: { isIn: [[...JOURNAL_POST_STATUSES]] },
      },
      scheduledFor: { type: DataTypes.DATE, allowNull: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      archivedAt: { type: DataTypes.DATE, allowNull: true },
      isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'journal_posts',
      modelName: 'JournalPost',
      underscored: true,
      defaultScope: { where: { isDeleted: false } },
      indexes: [
        {
          name: 'journal_posts_active_slug_unique',
          unique: true,
          fields: ['slug'],
          where: { is_deleted: false },
        },
        { fields: ['category_id', 'status', 'published_at'] },
        { fields: ['status', 'published_at'] },
        { fields: ['status', 'scheduled_for'] },
        { fields: ['author_user_id'] },
      ],
      validate: {
        validBody(this: JournalPost) {
          if (this.body?.version !== 1 || !Array.isArray(this.body.blocks)) {
            throw new Error('Journal body must use the version 1 block format')
          }
          if (
            this.status !== 'draft' &&
            (!this.excerpt?.trim() || this.body.blocks.length === 0)
          ) {
            throw new Error('Non-draft journal posts require an excerpt and content')
          }
        },
        validPublicationState(this: JournalPost) {
          if (
            this.status === 'draft' &&
            (this.scheduledFor || this.publishedAt || this.archivedAt)
          ) {
            throw new Error('Draft journal posts cannot have publication timestamps')
          }
          if (
            this.status === 'scheduled' &&
            (!this.scheduledFor || this.publishedAt || this.archivedAt)
          ) {
            throw new Error('Scheduled journal posts require only a scheduled date')
          }
          if (this.status === 'published' && (!this.publishedAt || this.archivedAt)) {
            throw new Error('Published journal posts require a publication date')
          }
          if (this.status === 'archived' && (!this.publishedAt || !this.archivedAt)) {
            throw new Error('Archived journal posts require publication and archive dates')
          }
        },
      },
    },
  )

  return JournalPost
}
