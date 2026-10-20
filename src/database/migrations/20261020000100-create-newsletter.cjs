'use strict'

const { idColumn, timestampColumns, dropTables } = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('newsletter_subscribers', {
        id: idColumn(Sequelize),
        email: { type: Sequelize.STRING(254), allowNull: false, unique: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
        consent_version: { type: Sequelize.STRING(30), allowNull: false },
        consented_at: { type: Sequelize.DATE, allowNull: false },
        confirmed_at: { type: Sequelize.DATE },
        unsubscribed_at: { type: Sequelize.DATE },
        confirmation_hash: { type: Sequelize.STRING(64), unique: true },
        confirmation_expires_at: { type: Sequelize.DATE },
        confirmation_sent_at: { type: Sequelize.DATE },
        ...timestampColumns(Sequelize),
      }, { transaction })
      await queryInterface.createTable('newsletter_campaigns', {
        id: idColumn(Sequelize),
        subject: { type: Sequelize.STRING(180), allowNull: false },
        preview_text: { type: Sequelize.STRING(180), allowNull: false, defaultValue: '' },
        headline: { type: Sequelize.STRING(180), allowNull: false },
        message: { type: Sequelize.TEXT, allowNull: false },
        image_url: { type: Sequelize.TEXT },
        button_label: { type: Sequelize.STRING(80) },
        button_url: { type: Sequelize.TEXT },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
        sent_at: { type: Sequelize.DATE },
        ...timestampColumns(Sequelize),
      }, { transaction })
      await queryInterface.createTable('newsletter_deliveries', {
        id: idColumn(Sequelize),
        campaign_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'newsletter_campaigns', key: 'id' }, onDelete: 'CASCADE' },
        subscriber_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'newsletter_subscribers', key: 'id' }, onDelete: 'RESTRICT' },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'queued' },
        attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        next_attempt_at: { type: Sequelize.DATE },
        smtp_message_id: { type: Sequelize.TEXT },
        last_error: { type: Sequelize.TEXT },
        ...timestampColumns(Sequelize),
      }, { transaction })
      await queryInterface.addIndex('newsletter_deliveries', ['campaign_id', 'subscriber_id'], { unique: true, transaction })
      await queryInterface.addIndex('newsletter_deliveries', ['status', 'next_attempt_at'], { transaction })
      await queryInterface.addIndex('newsletter_subscribers', ['status'], { transaction })
    })
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => dropTables(queryInterface, [
      'newsletter_deliveries', 'newsletter_campaigns', 'newsletter_subscribers',
    ], transaction))
  },
}
