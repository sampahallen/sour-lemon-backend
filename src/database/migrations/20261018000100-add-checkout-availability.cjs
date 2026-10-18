'use strict'

const keys = [
  ['checkout_pickup_enabled', 'Accept pickup orders'],
  ['checkout_customer_rider_enabled', 'Accept customer-arranged rider orders'],
  ['checkout_delivery_enabled', 'Accept Sour Lemon delivery orders'],
  ['checkout_momo_enabled', 'Accept manual Mobile Money for regular orders'],
  ['checkout_cash_enabled', 'Accept cash on pickup for regular orders'],
]

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [key, description] of keys) {
        await queryInterface.sequelize.query(
          `INSERT INTO app_settings (key, value, description, is_deleted, created_at, updated_at)
           VALUES (:key, 'true'::jsonb, :description, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO NOTHING`,
          { replacements: { key, description }, transaction },
        )
      }
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('app_settings', {
        key: { [Sequelize.Op.in]: keys.map(([key]) => key) },
      }, { transaction })
    })
  },
}
