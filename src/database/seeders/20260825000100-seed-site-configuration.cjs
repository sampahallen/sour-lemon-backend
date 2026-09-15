'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `INSERT INTO site_sections
          (id, key, name, is_enabled, show_coming_soon, sort_order, is_deleted, created_at, updated_at)
         VALUES
          (gen_random_uuid(), 'cakes', 'Cakes', true, false, 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'jams', 'Jams and syrups', false, true, 10, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'collaborations', 'Artist collaborations', false, true, 20, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'merch', 'Merch', false, true, 30, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'games', 'Games', false, true, 40, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO NOTHING`,
        { transaction },
      )

      await queryInterface.sequelize.query(
        `INSERT INTO categories
          (id, site_section_id, name, slug, is_active, sort_order, is_deleted, created_at, updated_at)
         SELECT gen_random_uuid(), id, 'Mini cakes', 'mini-cakes', true, 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         FROM site_sections WHERE key = 'cakes' AND is_deleted = false
         ON CONFLICT (slug) DO NOTHING`,
        { transaction },
      )
      await queryInterface.sequelize.query(
        `INSERT INTO categories
          (id, site_section_id, name, slug, is_active, sort_order, is_deleted, created_at, updated_at)
         SELECT gen_random_uuid(), id, 'Big cakes', 'big-cakes', true, 10, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         FROM site_sections WHERE key = 'cakes' AND is_deleted = false
         ON CONFLICT (slug) DO NOTHING`,
        { transaction },
      )

      await queryInterface.sequelize.query(
        `INSERT INTO app_settings
          (key, value, description, is_deleted, created_at, updated_at)
         VALUES
          ('business_whatsapp_number', 'null'::jsonb, 'WhatsApp number used for customer handoffs', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          ('pickup_location', 'null'::jsonb, 'Customer-facing pickup location', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          ('manual_payment_review', 'true'::jsonb, 'Require owner review after verified payment', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          ('delivery_fee_mode', '"rider"'::jsonb, 'Whether delivery fees come from areas or riders', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          ('menu_scheduling_enabled', 'false'::jsonb, 'Allow scheduled catalog availability', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO NOTHING`,
        { transaction },
      )
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        'app_settings',
        {
          key: {
            [Sequelize.Op.in]: [
              'business_whatsapp_number',
              'pickup_location',
              'manual_payment_review',
              'delivery_fee_mode',
              'menu_scheduling_enabled',
            ],
          },
        },
        { transaction },
      )
      await queryInterface.bulkDelete(
        'categories',
        { slug: { [Sequelize.Op.in]: ['mini-cakes', 'big-cakes'] } },
        { transaction },
      )
      await queryInterface.bulkDelete(
        'site_sections',
        {
          key: { [Sequelize.Op.in]: ['cakes', 'jams', 'collaborations', 'merch', 'games'] },
        },
        { transaction },
      )
    })
  },
}
