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
        'payments',
        {
          id: idColumn(Sequelize),
          order_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'orders', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          provider: { type: Sequelize.STRING(20), allowNull: false },
          method: { type: Sequelize.STRING(20), allowNull: false },
          status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'pending' },
          amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'GHS' },
          provider_reference: { type: Sequelize.STRING(160), allowNull: true, unique: true },
          checkout_url: { type: Sequelize.TEXT, allowNull: true },
          failure_code: { type: Sequelize.TEXT, allowNull: true },
          failure_message: { type: Sequelize.TEXT, allowNull: true },
          paid_at: { type: Sequelize.DATE, allowNull: true },
          provider_data: { type: Sequelize.JSONB, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'payments',
        'payments_provider_check',
        `provider IN ('paystack', 'cash')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'payments',
        'payments_method_check',
        `method IN ('card', 'momo', 'cash')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'payments',
        'payments_status_check',
        `status IN ('pending', 'paid', 'failed', 'cash_due', 'cash_collected', 'refunded')`,
        transaction,
      )
      await addCheck(queryInterface, 'payments', 'payments_amount_check', 'amount > 0', transaction)
      await addCheck(
        queryInterface,
        'payments',
        'payments_provider_method_check',
        `(provider = 'cash' AND method = 'cash') OR (provider = 'paystack' AND method IN ('card', 'momo'))`,
        transaction,
      )
      await queryInterface.addIndex('payments', ['order_id', 'status'], { transaction })

      await queryInterface.createTable(
        'payment_events',
        {
          id: idColumn(Sequelize),
          payment_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'payments', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          provider: { type: Sequelize.STRING(20), allowNull: false },
          event_key: { type: Sequelize.STRING(255), allowNull: false, unique: true },
          event_type: { type: Sequelize.STRING(100), allowNull: false },
          payload: { type: Sequelize.JSONB, allowNull: false },
          processed_at: { type: Sequelize.DATE, allowNull: true },
          processing_error: { type: Sequelize.TEXT, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'payment_events',
        'payment_events_provider_check',
        `provider IN ('paystack', 'cash')`,
        transaction,
      )
      await queryInterface.addIndex('payment_events', ['payment_id'], { transaction })
      await queryInterface.addIndex('payment_events', ['processed_at'], { transaction })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(queryInterface, ['payment_events', 'payments'], transaction),
    )
  },
}
