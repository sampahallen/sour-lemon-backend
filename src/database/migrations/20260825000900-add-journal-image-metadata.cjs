'use strict'

const { addCheck } = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'journal_post_images',
        'content_type',
        { type: Sequelize.STRING(100), allowNull: true },
        { transaction },
      )
      await queryInterface.addColumn(
        'journal_post_images',
        'size_bytes',
        { type: Sequelize.INTEGER, allowNull: true },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'journal_post_images',
        'journal_post_images_content_type_check',
        `content_type IS NULL OR content_type IN ('image/jpeg', 'image/png', 'image/webp')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'journal_post_images',
        'journal_post_images_size_check',
        'size_bytes IS NULL OR size_bytes > 0',
        transaction,
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint(
        'journal_post_images',
        'journal_post_images_size_check',
        { transaction },
      )
      await queryInterface.removeConstraint(
        'journal_post_images',
        'journal_post_images_content_type_check',
        { transaction },
      )
      await queryInterface.removeColumn('journal_post_images', 'size_bytes', { transaction })
      await queryInterface.removeColumn('journal_post_images', 'content_type', { transaction })
    })
  },
}
