'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('orders', 'orders_order_number_key', { transaction })
      await queryInterface.addIndex('orders', ['order_number'], {
        name: 'orders_unfinished_order_number_unique',
        unique: true,
        where: {
          status: { [Sequelize.Op.ne]: 'completed' },
          is_deleted: false,
        },
        transaction,
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('orders', 'orders_unfinished_order_number_unique', { transaction })
      await queryInterface.sequelize.query(
        `UPDATE orders AS completed
         SET order_number = LEFT(REPLACE(completed.id::text, '-', ''), 32)
         WHERE completed.status = 'completed'
           AND EXISTS (
             SELECT 1
             FROM orders AS duplicate
             WHERE duplicate.id <> completed.id
               AND duplicate.order_number = completed.order_number
           )`,
        { transaction },
      )
      await queryInterface.addConstraint('orders', {
        fields: ['order_number'],
        type: 'unique',
        name: 'orders_order_number_key',
        transaction,
      })
    })
  },
}
