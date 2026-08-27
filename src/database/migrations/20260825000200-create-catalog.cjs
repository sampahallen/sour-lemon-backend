'use strict'

const {
  addCheck,
  dropTables,
  idColumn,
  softDeleteColumn,
  timestampColumns,
} = require('../migration-utils.cjs')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'site_sections',
        {
          id: idColumn(Sequelize),
          key: { type: Sequelize.STRING(60), allowNull: false, unique: true },
          name: { type: Sequelize.STRING(100), allowNull: false },
          is_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          show_coming_soon: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )

      await queryInterface.createTable(
        'categories',
        {
          id: idColumn(Sequelize),
          site_section_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'site_sections', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          name: { type: Sequelize.STRING(100), allowNull: false },
          slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await queryInterface.addIndex('categories', ['site_section_id', 'is_active', 'sort_order'], {
        transaction,
      })

      await queryInterface.createTable(
        'products',
        {
          id: idColumn(Sequelize),
          category_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'categories', key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          name: { type: Sequelize.STRING(160), allowNull: false },
          slug: { type: Sequelize.STRING(180), allowNull: false, unique: true },
          description: { type: Sequelize.TEXT, allowNull: true },
          price: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'GHS' },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          available_from: { type: Sequelize.DATE, allowNull: true },
          available_until: { type: Sequelize.DATE, allowNull: true },
          archived_at: { type: Sequelize.DATE, allowNull: true },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize),
        },
        { transaction },
      )
      await addCheck(queryInterface, 'products', 'products_price_check', 'price >= 0', transaction)
      await addCheck(
        queryInterface,
        'products',
        'products_availability_check',
        'available_from IS NULL OR available_until IS NULL OR available_until > available_from',
        transaction,
      )
      await queryInterface.addIndex(
        'products',
        ['category_id', 'is_active', 'available_from', 'available_until'],
        { transaction },
      )

      await queryInterface.createTable(
        'product_images',
        {
          id: idColumn(Sequelize),
          product_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'products', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          url: { type: Sequelize.TEXT, allowNull: false },
          storage_key: { type: Sequelize.TEXT, allowNull: false, unique: true },
          alt_text: { type: Sequelize.STRING(255), allowNull: true },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          is_deleted: softDeleteColumn(Sequelize),
          ...timestampColumns(Sequelize, false),
        },
        { transaction },
      )
      await queryInterface.addIndex('product_images', ['product_id', 'sort_order'], { transaction })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      dropTables(queryInterface, ['product_images', 'products', 'categories', 'site_sections'], transaction),
    )
  },
}
