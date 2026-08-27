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
        'carts',
        {
          id: idColumn(Sequelize),
          user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          guest_token_hash: { type: Sequelize.STRING(255), allowNull: true, unique: true },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
          expires_at: { type: Sequelize.DATE, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(
        queryInterface,
        'carts',
        'carts_status_check',
        `status IN ('active', 'converted', 'abandoned')`,
        transaction,
      )
      await addCheck(
        queryInterface,
        'carts',
        'carts_owner_check',
        '((user_id IS NOT NULL)::integer + (guest_token_hash IS NOT NULL)::integer) = 1',
        transaction,
      )
      await addCheck(
        queryInterface,
        'carts',
        'carts_guest_expiry_check',
        'guest_token_hash IS NULL OR expires_at IS NOT NULL',
        transaction,
      )
      await queryInterface.addIndex('carts', ['user_id'], {
        name: 'carts_one_active_per_user',
        unique: true,
        where: { status: 'active', is_deleted: false, user_id: { [Sequelize.Op.ne]: null } },
        transaction,
      })
      await queryInterface.addIndex('carts', ['guest_token_hash'], {
        name: 'carts_one_active_per_guest',
        unique: true,
        where: {
          status: 'active',
          is_deleted: false,
          guest_token_hash: { [Sequelize.Op.ne]: null },
        },
        transaction,
      })

      await queryInterface.createTable(
        'cart_items',
        {
          id: idColumn(Sequelize),
          cart_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'carts', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          product_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'products', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          quantity: { type: Sequelize.INTEGER, allowNull: false },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(queryInterface, 'cart_items', 'cart_items_quantity_check', 'quantity > 0', transaction)
      await queryInterface.addIndex('cart_items', ['cart_id', 'product_id'], {
        name: 'cart_items_active_product_unique',
        unique: true,
        where: { is_deleted: false },
        transaction,
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(queryInterface, ['cart_items', 'carts'], transaction),
    )
  },
}
