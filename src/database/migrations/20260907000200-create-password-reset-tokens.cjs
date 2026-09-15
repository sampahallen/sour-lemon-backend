'use strict'

const { dropTables, idColumn, timestampColumns } = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'password_reset_tokens',
        {
          id: idColumn(Sequelize),
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
          expires_at: { type: Sequelize.DATE, allowNull: false },
          used_at: { type: Sequelize.DATE, allowNull: true },
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      await queryInterface.addIndex('password_reset_tokens', ['user_id', 'expires_at'], {
        transaction,
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(queryInterface, ['password_reset_tokens'], transaction),
    )
  },
}
