'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`INSERT INTO app_settings (key, value, description, is_deleted, created_at, updated_at) VALUES
        ('momo_payment_number', 'null'::jsonb, 'Mobile Money number shown to customers', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('momo_recipient_name', 'null'::jsonb, 'Mobile Money recipient name', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('momo_network', 'null'::jsonb, 'Mobile Money network', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO NOTHING`, { transaction })
      await queryInterface.sequelize.query('ALTER TABLE payments DROP CONSTRAINT payments_provider_check', { transaction })
      await queryInterface.sequelize.query(`ALTER TABLE payments ADD CONSTRAINT payments_provider_check CHECK (provider IN ('paystack', 'cash', 'manual_momo'))`, { transaction })
      await queryInterface.sequelize.query('ALTER TABLE payments DROP CONSTRAINT payments_provider_method_check', { transaction })
      await queryInterface.sequelize.query(`ALTER TABLE payments ADD CONSTRAINT payments_provider_method_check CHECK ((provider = 'cash' AND method = 'cash') OR (provider = 'paystack' AND method IN ('card', 'momo')) OR (provider = 'manual_momo' AND method = 'momo'))`, { transaction })
      await queryInterface.createTable('payment_proofs', {
        id: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
        payment_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'payments', key: 'id' } },
        custom_cake_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'custom_cake_requests', key: 'id' } },
        reference: { type: Sequelize.STRING(160), allowNull: true },
        storage_key: { type: Sequelize.TEXT, allowNull: true },
        image_type: { type: Sequelize.STRING(32), allowNull: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'submitted' },
        rejection_reason: { type: Sequelize.TEXT, allowNull: true },
        reviewed_by_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
        reviewed_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction })
      await queryInterface.sequelize.query(`ALTER TABLE payment_proofs ADD CONSTRAINT payment_proofs_target_check CHECK ((payment_id IS NOT NULL) <> (custom_cake_request_id IS NOT NULL))`, { transaction })
      await queryInterface.sequelize.query(`ALTER TABLE payment_proofs ADD CONSTRAINT payment_proofs_evidence_check CHECK (reference IS NOT NULL OR storage_key IS NOT NULL)`, { transaction })
      await queryInterface.sequelize.query(`ALTER TABLE payment_proofs ADD CONSTRAINT payment_proofs_status_check CHECK (status IN ('submitted', 'rejected', 'confirmed'))`, { transaction })
      await queryInterface.addIndex('payment_proofs', ['payment_id', 'created_at'], { transaction })
      await queryInterface.addIndex('payment_proofs', ['custom_cake_request_id', 'created_at'], { transaction })
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX payment_proofs_confirmed_reference_unique ON payment_proofs (lower(reference)) WHERE status = 'confirmed' AND reference IS NOT NULL`, { transaction })
      await queryInterface.addColumn('custom_cake_requests', 'payment_link_nonce', { type: Sequelize.STRING(64), allowNull: true }, { transaction })
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('custom_cake_requests', 'payment_link_nonce', { transaction })
      await queryInterface.dropTable('payment_proofs', { transaction })
      await queryInterface.sequelize.query('ALTER TABLE payments DROP CONSTRAINT payments_provider_method_check', { transaction })
      await queryInterface.sequelize.query(`ALTER TABLE payments ADD CONSTRAINT payments_provider_method_check CHECK ((provider = 'cash' AND method = 'cash') OR (provider = 'paystack' AND method IN ('card', 'momo')))`, { transaction })
      await queryInterface.sequelize.query('ALTER TABLE payments DROP CONSTRAINT payments_provider_check', { transaction })
      await queryInterface.sequelize.query(`ALTER TABLE payments ADD CONSTRAINT payments_provider_check CHECK (provider IN ('paystack', 'cash'))`, { transaction })
      await queryInterface.bulkDelete('app_settings', { key: { [Sequelize.Op.in]: ['momo_payment_number', 'momo_recipient_name', 'momo_network'] } }, { transaction })
    })
  },
}
