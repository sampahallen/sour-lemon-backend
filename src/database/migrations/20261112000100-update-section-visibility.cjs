module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('UPDATE site_sections SET is_enabled = true, updated_at = NOW() WHERE is_deleted = false AND is_enabled = false AND show_coming_soon = true')
  },
  async down() { /* Administrator choices cannot be safely reversed. */ },
}
