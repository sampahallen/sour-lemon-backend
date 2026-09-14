'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'payment_name', {
      type: Sequelize.STRING(120),
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payments', 'payment_name')
  },
}
