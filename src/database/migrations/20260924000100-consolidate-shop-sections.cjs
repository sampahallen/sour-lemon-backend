'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [shopSections] = await queryInterface.sequelize.query(
        `SELECT id
         FROM site_sections
         WHERE key = 'shop' AND is_deleted = false`,
        { transaction },
      )

      if (shopSections.length !== 1) {
        throw new Error('The active Shop section is required before catalog sections can be consolidated')
      }

      const shopSectionId = shopSections[0].id

      await queryInterface.sequelize.query(
        `UPDATE categories
         SET site_section_id = :shopSectionId,
             updated_at = CURRENT_TIMESTAMP
         WHERE site_section_id IN (
           SELECT id
           FROM site_sections
           WHERE key IN ('jams', 'merch')
         )`,
        { replacements: { shopSectionId }, transaction },
      )

      await queryInterface.sequelize.query(
        `UPDATE site_sections
         SET is_enabled = false,
             show_coming_soon = false,
             is_deleted = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE key IN ('jams', 'merch')`,
        { transaction },
      )
    })
  },

  async down() {
    // Intentionally irreversible: administrator-created categories cannot be
    // assigned reliably to their former Jams or Merch sections.
  },
}
