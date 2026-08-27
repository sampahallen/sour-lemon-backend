'use strict'

const { dropTables, softDeleteColumn, timestampColumns } = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_settings', {
      key: { type: Sequelize.STRING(100), allowNull: false, primaryKey: true },
      value: { type: Sequelize.JSONB, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      updated_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      is_deleted: softDeleteColumn(Sequelize),
      ...timestampColumns(Sequelize),
    })
  },

  async down(queryInterface) {
    await dropTables(queryInterface, ['app_settings'])
  },
}
