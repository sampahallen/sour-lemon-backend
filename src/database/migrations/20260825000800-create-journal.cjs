'use strict'

const {
  addCheck,
  dropTables,
  idColumn,
  softDeleteColumn,
  timestampColumns,
} = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'journal_categories',
        {
          id: idColumn(Sequelize),
          name: { type: Sequelize.STRING(100), allowNull: false },
          slug: { type: Sequelize.STRING(120), allowNull: false },
          description: { type: Sequelize.TEXT, allowNull: true },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await queryInterface.addIndex('journal_categories', ['slug'], {
        name: 'journal_categories_active_slug_unique',
        unique: true,
        where: { is_deleted: false },
        transaction,
      })
      await queryInterface.addIndex('journal_categories', ['is_active', 'sort_order'], {
        transaction,
      })

      await queryInterface.createTable(
        'journal_posts',
        {
          id: idColumn(Sequelize),
          category_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'journal_categories', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          author_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          title: { type: Sequelize.STRING(200), allowNull: false },
          slug: { type: Sequelize.STRING(220), allowNull: false },
          excerpt: { type: Sequelize.TEXT, allowNull: true },
          body: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: { version: 1, blocks: [] },
          },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
          scheduled_for: { type: Sequelize.DATE, allowNull: true },
          published_at: { type: Sequelize.DATE, allowNull: true },
          archived_at: { type: Sequelize.DATE, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'journal_posts',
        'journal_posts_status_check',
        `status IN ('draft', 'scheduled', 'published', 'archived')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'journal_posts',
        'journal_posts_body_check',
        `jsonb_typeof(body) = 'object'
          AND COALESCE(body->>'version', '') = '1'
          AND COALESCE(jsonb_typeof(body->'blocks'), '') = 'array'`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'journal_posts',
        'journal_posts_publishable_content_check',
        `status = 'draft' OR (excerpt IS NOT NULL AND btrim(excerpt) <> '' AND jsonb_array_length(body->'blocks') > 0)`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'journal_posts',
        'journal_posts_publication_state_check',
        `(status = 'draft' AND scheduled_for IS NULL AND published_at IS NULL AND archived_at IS NULL)
          OR (status = 'scheduled' AND scheduled_for IS NOT NULL AND published_at IS NULL AND archived_at IS NULL)
          OR (status = 'published' AND published_at IS NOT NULL AND archived_at IS NULL)
          OR (status = 'archived' AND published_at IS NOT NULL AND archived_at IS NOT NULL)`,
        transaction,
      )
      await queryInterface.addIndex('journal_posts', ['slug'], {
        name: 'journal_posts_active_slug_unique',
        unique: true,
        where: { is_deleted: false },
        transaction,
      })
      await queryInterface.addIndex(
        'journal_posts',
        ['category_id', 'status', 'published_at'],
        { transaction },
      )
      await queryInterface.addIndex(
        'journal_posts',
        ['status', { name: 'published_at', order: 'DESC' }],
        { transaction },
      )
      await queryInterface.addIndex('journal_posts', ['status', 'scheduled_for'], { transaction })
      await queryInterface.addIndex('journal_posts', ['author_user_id'], { transaction })

      await queryInterface.createTable(
        'journal_post_images',
        {
          id: idColumn(Sequelize),
          journal_post_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'journal_posts', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          role: { type: Sequelize.STRING(20), allowNull: false },
          url: { type: Sequelize.TEXT, allowNull: false },
          storage_key: { type: Sequelize.TEXT, allowNull: false, unique: true },
          alt_text: { type: Sequelize.STRING(255), allowNull: false },
          caption: { type: Sequelize.TEXT, allowNull: true },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'journal_post_images',
        'journal_post_images_role_check',
        `role IN ('cover', 'body')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'journal_post_images',
        'journal_post_images_alt_text_check',
        `btrim(alt_text) <> ''`,
        transaction,
      )
      await queryInterface.addIndex('journal_post_images', ['journal_post_id'], {
        name: 'journal_post_images_one_cover_per_post',
        unique: true,
        where: { role: 'cover', is_deleted: false },
        transaction,
      })
      await queryInterface.addIndex(
        'journal_post_images',
        ['journal_post_id', 'role', 'sort_order'],
        { transaction },
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(
        queryInterface,
        ['journal_post_images', 'journal_posts', 'journal_categories'],
        transaction,
      ),
    )
  },
}
