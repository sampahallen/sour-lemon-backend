'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'received'`,
    )
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending_payment'`,
    )
  },
}
