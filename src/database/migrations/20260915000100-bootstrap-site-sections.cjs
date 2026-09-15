'use strict'

const sections = [
  ['cakes', 'Cakes', true, false, 0],
  ['shop', 'Shop', false, true, 5],
  ['jams', 'Jams and syrups', false, true, 10],
  ['collaborations', 'Artist collaborations', false, true, 20],
  ['merch', 'Merch', false, true, 30],
  ['games', 'Games', false, true, 40],
  ['journal', 'Journal', true, false, 50],
  ['about', 'About', false, true, 60],
  ['contact', 'Contact', false, true, 70],
]

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [key, name, isEnabled, showComingSoon, sortOrder] of sections) {
        await queryInterface.sequelize.query(
          `INSERT INTO site_sections
            (id, key, name, is_enabled, show_coming_soon, sort_order, is_deleted, created_at, updated_at)
           VALUES
            (gen_random_uuid(), :key, :name, :isEnabled, :showComingSoon, :sortOrder, false,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO NOTHING`,
          {
            replacements: { key, name, isEnabled, showComingSoon, sortOrder },
            transaction,
          },
        )
      }
    })
  },

  async down() {
    // These rows become administrator-owned configuration after creation.
    // A rollback must not delete or reset choices made in production.
  },
}
