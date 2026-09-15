'use strict'

const { addCheck } = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('users', 'email', {
        type: Sequelize.STRING(254),
        allowNull: true,
      }, { transaction })
      await queryInterface.addColumn('orders', 'customer_email', {
        type: Sequelize.STRING(254),
        allowNull: true,
      }, { transaction })
      await queryInterface.addColumn('orders', 'guest_access_token_hash', {
        type: Sequelize.STRING(64),
        allowNull: true,
      }, { transaction })
      await queryInterface.addColumn('payments', 'provider_access_code', {
        type: Sequelize.STRING(255),
        allowNull: true,
      }, { transaction })

      await queryInterface.addIndex('orders', ['guest_access_token_hash'], {
        name: 'orders_guest_access_token_hash',
        transaction,
      })

      await queryInterface.removeConstraint('orders', 'orders_delivery_address_check', { transaction })
      await addCheck(
        queryInterface,
        'orders',
        'orders_delivery_address_check',
        `(fulfillment_type IN ('pickup', 'customer_rider') AND delivery_address IS NULL) OR (fulfillment_type = 'sour_lemon_delivery' AND delivery_address IS NOT NULL)`,
        transaction,
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('orders', 'orders_delivery_address_check', { transaction })
      await addCheck(
        queryInterface,
        'orders',
        'orders_delivery_address_check',
        `(fulfillment_type = 'pickup' AND delivery_address IS NULL) OR (fulfillment_type <> 'pickup' AND delivery_address IS NOT NULL)`,
        transaction,
      )
      await queryInterface.removeIndex('orders', 'orders_guest_access_token_hash', { transaction })
      await queryInterface.removeColumn('payments', 'provider_access_code', { transaction })
      await queryInterface.removeColumn('orders', 'guest_access_token_hash', { transaction })
      await queryInterface.removeColumn('orders', 'customer_email', { transaction })
      await queryInterface.removeColumn('users', 'email', { transaction })
    })
  },
}
