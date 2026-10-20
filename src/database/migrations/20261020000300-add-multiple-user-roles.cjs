'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('users', 'roles', {
        type: Sequelize.ARRAY(Sequelize.STRING(20)),
        allowNull: false,
        defaultValue: Sequelize.literal("ARRAY['customer']::varchar(20)[]"),
      }, { transaction })
      await queryInterface.sequelize.query(`
        UPDATE users SET roles = ARRAY['customer', 'admin']::varchar(20)[] WHERE role = 'admin'
      `, { transaction })
      await queryInterface.sequelize.query(`
        ALTER TABLE users ADD CONSTRAINT users_roles_check CHECK (
          roles = ARRAY['customer']::varchar(20)[] OR
          roles = ARRAY['customer', 'admin']::varchar(20)[]
        )
      `, { transaction })
      // Nullable while older API replicas can still create sessions without this column.
      await queryInterface.addColumn('auth_sessions', 'role', {
        type: Sequelize.STRING(20), allowNull: true,
      }, { transaction })
      await queryInterface.sequelize.query(`
        UPDATE auth_sessions s SET role = u.role FROM users u WHERE u.id = s.user_id
      `, { transaction })
      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_role_check
        CHECK (role IS NULL OR role IN ('customer', 'admin'))
      `, { transaction })
      await queryInterface.addIndex('auth_sessions', ['user_id', 'role', 'revoked_at'], {
        name: 'auth_sessions_user_role_revoked_index', transaction,
      })
    })
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('auth_sessions', 'auth_sessions_user_role_revoked_index', { transaction })
      await queryInterface.sequelize.query('ALTER TABLE auth_sessions DROP CONSTRAINT auth_sessions_role_check', { transaction })
      await queryInterface.removeColumn('auth_sessions', 'role', { transaction })
      await queryInterface.sequelize.query('ALTER TABLE users DROP CONSTRAINT users_roles_check', { transaction })
      await queryInterface.removeColumn('users', 'roles', { transaction })
    })
  },
}
