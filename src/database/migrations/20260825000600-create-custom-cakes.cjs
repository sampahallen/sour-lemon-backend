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
        'custom_cake_requests',
        {
          id: idColumn(Sequelize),
          user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          order_id: {
            type: Sequelize.UUID,
            allowNull: true,
            unique: true,
            references: { model: 'orders', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          customer_name: { type: Sequelize.STRING(120), allowNull: false },
          phone_number: { type: Sequelize.STRING(32), allowNull: false },
          whatsapp_number: { type: Sequelize.STRING(32), allowNull: true },
          occasion: { type: Sequelize.STRING(160), allowNull: false },
          requested_size: { type: Sequelize.STRING(100), allowNull: false },
          notes: { type: Sequelize.TEXT, allowNull: true },
          status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'submitted' },
          quoted_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
          currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'GHS' },
          quoted_by_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          quoted_at: { type: Sequelize.DATE, allowNull: true },
          quote_expires_at: { type: Sequelize.DATE, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'custom_cake_requests',
        'custom_cake_requests_status_check',
        `status IN ('submitted', 'quoted', 'awaiting_payment', 'confirmed', 'rejected', 'cancelled')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'custom_cake_requests',
        'custom_cake_requests_amount_check',
        'quoted_amount IS NULL OR quoted_amount >= 0',
        transaction,
      )
      await addCheck(
        queryInterface,
        'custom_cake_requests',
        'custom_cake_requests_quote_check',
        `status NOT IN ('quoted', 'awaiting_payment', 'confirmed') OR (quoted_amount IS NOT NULL AND quoted_at IS NOT NULL)`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'custom_cake_requests',
        'custom_cake_requests_expiry_check',
        'quote_expires_at IS NULL OR quoted_at IS NULL OR quote_expires_at > quoted_at',
        transaction,
      )
      await queryInterface.addIndex('custom_cake_requests', ['status', 'created_at'], {
        transaction,
      })
      await queryInterface.addIndex('custom_cake_requests', ['user_id'], { transaction })

      await queryInterface.createTable(
        'custom_cake_images',
        {
          id: idColumn(Sequelize),
          custom_cake_request_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'custom_cake_requests', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          url: { type: Sequelize.TEXT, allowNull: false },
          storage_key: { type: Sequelize.TEXT, allowNull: false, unique: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      await queryInterface.addIndex('custom_cake_images', ['custom_cake_request_id'], {
        transaction,
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(queryInterface, ['custom_cake_images', 'custom_cake_requests'], transaction),
    )
  },
}
