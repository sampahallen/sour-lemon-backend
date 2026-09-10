'use strict'

const { addCheck } = require('../migration-utils.cjs')

const orderStates = `'received', 'pending_payment', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'`
const legacyOrderStates = `'pending_payment', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'`

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('payments', 'requires_manual_confirmation', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }, { transaction })
      await queryInterface.addColumn('payments', 'admin_confirmed_at', {
        type: Sequelize.DATE,
        allowNull: true,
      }, { transaction })
      await queryInterface.addColumn('payments', 'admin_confirmed_by_user_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }, { transaction })
      await queryInterface.addIndex('payments', ['requires_manual_confirmation', 'admin_confirmed_at'], {
        name: 'payments_manual_confirmation_queue',
        transaction,
      })

      await queryInterface.sequelize.query(
        `UPDATE payments
         SET requires_manual_confirmation = CASE
           WHEN provider = 'cash' THEN true
           WHEN provider = 'paystack' AND status = 'paid' AND EXISTS (
             SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.status = 'pending_payment'
           ) THEN true
           ELSE false
         END,
         admin_confirmed_at = CASE
           WHEN provider = 'paystack' AND status = 'paid' AND NOT EXISTS (
             SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.status = 'pending_payment'
           ) THEN COALESCE(paid_at, updated_at)
           ELSE NULL
         END`,
        { transaction },
      )

      await queryInterface.removeConstraint('orders', 'orders_status_check', { transaction })
      await addCheck(queryInterface, 'orders', 'orders_status_check', `status IN (${orderStates})`, transaction)
      await queryInterface.removeConstraint('order_status_history', 'order_status_history_from_check', { transaction })
      await queryInterface.removeConstraint('order_status_history', 'order_status_history_to_check', { transaction })
      await addCheck(
        queryInterface,
        'order_status_history',
        'order_status_history_from_check',
        `from_status IS NULL OR from_status IN (${orderStates})`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'order_status_history',
        'order_status_history_to_check',
        `to_status IN (${orderStates})`,
        transaction,
      )

      await queryInterface.sequelize.query(
        `INSERT INTO order_status_history
           (id, order_id, from_status, to_status, changed_by_user_id, note, is_deleted, created_at)
         SELECT gen_random_uuid(), id, status, 'received', NULL,
           'Order moved to the separated fulfillment workflow', false, CURRENT_TIMESTAMP
         FROM orders
         WHERE status IN ('pending_payment', 'confirmed') AND is_deleted = false`,
        { transaction },
      )
      await queryInterface.sequelize.query(
        `UPDATE orders SET status = 'received', updated_at = CURRENT_TIMESTAMP
         WHERE status IN ('pending_payment', 'confirmed') AND is_deleted = false`,
        { transaction },
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
         WHERE status = 'received'`,
        { transaction },
      )
      await queryInterface.sequelize.query(
        `UPDATE order_status_history SET from_status = 'confirmed'
         WHERE from_status = 'received'`,
        { transaction },
      )
      await queryInterface.sequelize.query(
        `UPDATE order_status_history SET to_status = 'confirmed'
         WHERE to_status = 'received'`,
        { transaction },
      )
      await queryInterface.removeConstraint('orders', 'orders_status_check', { transaction })
      await addCheck(queryInterface, 'orders', 'orders_status_check', `status IN (${legacyOrderStates})`, transaction)
      await queryInterface.removeConstraint('order_status_history', 'order_status_history_from_check', { transaction })
      await queryInterface.removeConstraint('order_status_history', 'order_status_history_to_check', { transaction })
      await addCheck(
        queryInterface,
        'order_status_history',
        'order_status_history_from_check',
        `from_status IS NULL OR from_status IN (${legacyOrderStates})`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'order_status_history',
        'order_status_history_to_check',
        `to_status IN (${legacyOrderStates})`,
        transaction,
      )
      await queryInterface.removeIndex('payments', 'payments_manual_confirmation_queue', { transaction })
      await queryInterface.removeColumn('payments', 'admin_confirmed_by_user_id', { transaction })
      await queryInterface.removeColumn('payments', 'admin_confirmed_at', { transaction })
      await queryInterface.removeColumn('payments', 'requires_manual_confirmation', { transaction })
    })
  },
}
