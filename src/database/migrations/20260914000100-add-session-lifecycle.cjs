'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('auth_sessions', 'last_activity_at', {
        type: Sequelize.DATE,
        allowNull: true,
      }, { transaction })
      await queryInterface.sequelize.query(
        'UPDATE auth_sessions SET last_activity_at = created_at WHERE last_activity_at IS NULL',
        { transaction },
      )
      await queryInterface.changeColumn('auth_sessions', 'last_activity_at', {
        type: Sequelize.DATE,
        allowNull: false,
      }, { transaction })
      await queryInterface.createTable('auth_refresh_uses', {
        token_hash: { type: Sequelize.STRING(64), primaryKey: true },
        session_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'auth_sessions', key: 'id' },
          onDelete: 'CASCADE',
        },
        used_at: { type: Sequelize.DATE, allowNull: false },
      }, { transaction })
      await queryInterface.addIndex('auth_refresh_uses', ['session_id'], { transaction })
      await queryInterface.addIndex('auth_refresh_uses', ['used_at'], { transaction })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('auth_refresh_uses', { transaction })
      await queryInterface.removeColumn('auth_sessions', 'last_activity_at', { transaction })
    })
  },
}
