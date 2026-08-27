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
        'orders',
        {
          id: idColumn(Sequelize),
          order_number: { type: Sequelize.STRING(32), allowNull: false, unique: true },
          user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          delivery_area_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'delivery_areas', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'pending_payment' },
          payment_status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'pending' },
          fulfillment_type: { type: Sequelize.STRING(32), allowNull: false },
          customer_name: { type: Sequelize.STRING(120), allowNull: false },
          phone_number: { type: Sequelize.STRING(32), allowNull: false },
          whatsapp_number: { type: Sequelize.STRING(32), allowNull: true },
          delivery_address: { type: Sequelize.JSONB, allowNull: true },
          subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          delivery_fee: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
          total: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'GHS' },
          customer_notes: { type: Sequelize.TEXT, allowNull: true },
          placed_at: { type: Sequelize.DATE, allowNull: true },
          confirmed_at: { type: Sequelize.DATE, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'orders',
        'orders_status_check',
        `status IN ('pending_payment', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'orders',
        'orders_payment_status_check',
        `payment_status IN ('pending', 'paid', 'failed', 'cash_due', 'cash_collected', 'refunded')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'orders',
        'orders_fulfillment_type_check',
        `fulfillment_type IN ('pickup', 'customer_rider', 'sour_lemon_delivery')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'orders',
        'orders_amounts_check',
        'subtotal >= 0 AND delivery_fee >= 0 AND total = subtotal + delivery_fee',
        transaction,
      )
      await addCheck(
        queryInterface,
        'orders',
        'orders_delivery_address_check',
        `(fulfillment_type = 'pickup' AND delivery_address IS NULL) OR (fulfillment_type <> 'pickup' AND delivery_address IS NOT NULL)`,
        transaction,
      )
      await queryInterface.addIndex('orders', ['status', 'created_at'], { transaction })
      await queryInterface.addIndex('orders', ['delivery_area_id', 'status', 'created_at'], {
        transaction,
      })
      await queryInterface.addIndex('orders', ['user_id', 'created_at'], { transaction })

      await queryInterface.createTable(
        'order_items',
        {
          id: idColumn(Sequelize),
          order_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'orders', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          product_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'products', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          product_name: { type: Sequelize.STRING(160), allowNull: false },
          product_description: { type: Sequelize.TEXT, allowNull: true },
          quantity: { type: Sequelize.INTEGER, allowNull: false },
          unit_price: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          line_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'order_items',
        'order_items_values_check',
        'quantity > 0 AND unit_price >= 0 AND line_total = unit_price * quantity',
        transaction,
      )
      await queryInterface.addIndex('order_items', ['order_id'], { transaction })
      await queryInterface.addIndex('order_items', ['product_id'], { transaction })

      await queryInterface.createTable(
        'order_status_history',
        {
          id: idColumn(Sequelize),
          order_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'orders', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          from_status: { type: Sequelize.STRING(32), allowNull: true },
          to_status: { type: Sequelize.STRING(32), allowNull: false },
          changed_by_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          note: { type: Sequelize.TEXT, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      const orderStates = `'pending_payment', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'`
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
      await queryInterface.addIndex('order_status_history', ['order_id', 'created_at'], {
        transaction,
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(queryInterface, ['order_status_history', 'order_items', 'orders'], transaction),
    )
  },
}
