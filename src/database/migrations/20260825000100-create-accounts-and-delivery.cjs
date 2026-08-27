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
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto', { transaction })

      await queryInterface.createTable(
        'users',
        {
          id: idColumn(Sequelize),
          name: { type: Sequelize.STRING(120), allowNull: false },
          phone_number: { type: Sequelize.STRING(32), allowNull: false },
          password_hash: { type: Sequelize.STRING(255), allowNull: false },
          whatsapp_number: { type: Sequelize.STRING(32), allowNull: true },
          role: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'customer' },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'users',
        'users_role_check',
        `role IN ('customer', 'admin')`,
        transaction,
      )
      await queryInterface.addIndex('users', ['phone_number'], {
        name: 'users_active_phone_unique',
        unique: true,
        where: { is_deleted: false },
        transaction,
      })

      await queryInterface.createTable(
        'auth_sessions',
        {
          id: idColumn(Sequelize),
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          refresh_token_hash: { type: Sequelize.STRING(255), allowNull: false, unique: true },
          expires_at: { type: Sequelize.DATE, allowNull: false },
          revoked_at: { type: Sequelize.DATE, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      await queryInterface.addIndex('auth_sessions', ['user_id', 'expires_at'], { transaction })

      await queryInterface.createTable(
        'delivery_areas',
        {
          id: idColumn(Sequelize),
          name: { type: Sequelize.STRING(120), allowNull: false },
          slug: { type: Sequelize.STRING(140), allowNull: false, unique: true },
          delivery_fee: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'delivery_areas',
        'delivery_areas_fee_check',
        'delivery_fee IS NULL OR delivery_fee >= 0',
        transaction,
      )

      await queryInterface.createTable(
        'addresses',
        {
          id: idColumn(Sequelize),
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          delivery_area_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'delivery_areas', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          label: { type: Sequelize.STRING(50), allowNull: true },
          recipient_name: { type: Sequelize.STRING(120), allowNull: false },
          phone_number: { type: Sequelize.STRING(32), allowNull: false },
          address_line_1: { type: Sequelize.STRING(255), allowNull: false },
          address_line_2: { type: Sequelize.STRING(255), allowNull: true },
          city: { type: Sequelize.STRING(120), allowNull: false },
          landmark: { type: Sequelize.STRING(255), allowNull: true },
          is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await queryInterface.addIndex('addresses', ['user_id'], { transaction })
      await queryInterface.addIndex('addresses', ['delivery_area_id'], { transaction })
      await queryInterface.addIndex('addresses', ['user_id'], {
        name: 'addresses_one_default_per_user',
        unique: true,
        where: { is_default: true, is_deleted: false },
        transaction,
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(queryInterface, ['addresses', 'auth_sessions', 'delivery_areas', 'users'], transaction),
    )
  },
}
