'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'sort_order', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'sort_order')
  },
}
