'use strict'

const { idColumn, timestampColumns, dropTables } = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        INSERT INTO app_settings (key, value, description, is_deleted, created_at, updated_at)
        VALUES ('drop_notifications_enabled', 'false'::jsonb, 'Automatically email subscribers about new bakery and Journal drops', false, NOW(), NOW())
        ON CONFLICT (key) DO NOTHING
      `, { transaction })
      await queryInterface.createTable('drop_batches', {
        id: idColumn(Sequelize),
        kind: { type: Sequelize.STRING(20), allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'queued' },
        payload: { type: Sequelize.JSONB, allowNull: false },
        ...timestampColumns(Sequelize),
      }, { transaction })
      await queryInterface.createTable('drop_sources', {
        id: idColumn(Sequelize),
        kind: { type: Sequelize.STRING(20), allowNull: false },
        source_id: { type: Sequelize.UUID, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false },
        batch_id: { type: Sequelize.UUID, references: { model: 'drop_batches', key: 'id' }, onDelete: 'SET NULL' },
        first_seen_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      }, { transaction })
      await queryInterface.addIndex('drop_sources', ['kind', 'source_id'], { unique: true, transaction })
      await queryInterface.addIndex('drop_sources', ['status', 'first_seen_at'], { transaction })
      await queryInterface.createTable('drop_deliveries', {
        id: idColumn(Sequelize),
        batch_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'drop_batches', key: 'id' }, onDelete: 'CASCADE' },
        subscriber_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'newsletter_subscribers', key: 'id' }, onDelete: 'RESTRICT' },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'queued' },
        attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        next_attempt_at: { type: Sequelize.DATE },
        smtp_message_id: { type: Sequelize.TEXT },
        last_error: { type: Sequelize.TEXT },
        ...timestampColumns(Sequelize),
      }, { transaction })
      await queryInterface.addIndex('drop_deliveries', ['batch_id', 'subscriber_id'], { unique: true, transaction })
      await queryInterface.addIndex('drop_deliveries', ['status', 'next_attempt_at'], { transaction })

      // Baseline only content already public. Existing drafts and inactive products can still launch later.
      await queryInterface.sequelize.query(`
        INSERT INTO drop_sources (id, kind, source_id, status, first_seen_at)
        SELECT gen_random_uuid(), 'product', p.id, 'skipped', NOW()
        FROM products p JOIN categories c ON c.id = p.category_id
        JOIN site_sections s ON s.id = c.site_section_id
        WHERE p.is_deleted = false AND p.archived_at IS NULL AND p.is_active = true
          AND c.is_deleted = false AND c.is_active = true
          AND s.is_deleted = false AND s.is_enabled = true AND s.key = 'cakes'
          AND (COALESCE((SELECT value FROM app_settings WHERE key = 'menu_scheduling_enabled'), 'false'::jsonb) <> 'true'::jsonb
            OR ((p.available_from IS NULL OR p.available_from <= NOW()) AND (p.available_until IS NULL OR p.available_until > NOW())))
        ON CONFLICT (kind, source_id) DO NOTHING
      `, { transaction })
      await queryInterface.sequelize.query(`
        INSERT INTO drop_sources (id, kind, source_id, status, first_seen_at)
        SELECT gen_random_uuid(), 'journal', id, 'skipped', NOW()
        FROM journal_posts WHERE is_deleted = false AND status = 'published' AND published_at <= NOW()
        ON CONFLICT (kind, source_id) DO NOTHING
      `, { transaction })
      // Keep historical campaigns for audit, but stop unsent legacy mail.
      await queryInterface.sequelize.query(`
        UPDATE newsletter_deliveries SET status = 'suppressed', updated_at = NOW()
        WHERE status = 'queued'
      `, { transaction })
    })
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await dropTables(queryInterface, ['drop_deliveries', 'drop_sources', 'drop_batches'], transaction)
      await queryInterface.sequelize.query("DELETE FROM app_settings WHERE key = 'drop_notifications_enabled'", { transaction })
    })
  },
}
