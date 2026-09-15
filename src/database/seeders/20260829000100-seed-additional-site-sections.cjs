'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `INSERT INTO site_sections
        (id, key, name, is_enabled, show_coming_soon, sort_order, is_deleted, created_at, updated_at)
       VALUES
        (gen_random_uuid(), 'shop', 'Shop', false, true, 5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'journal', 'Journal', true, false, 50, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'about', 'About', false, true, 60, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'contact', 'Contact', false, true, 70, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO NOTHING`,
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('site_sections', {
      key: { [Sequelize.Op.in]: ['shop', 'journal', 'about', 'contact'] },
    })
  },
}
