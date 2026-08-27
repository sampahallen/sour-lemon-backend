const safeIdentifier = (identifier) => {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`)
  }
  return `"${identifier}"`
}

const idColumn = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
})

const timestampColumns = (Sequelize, includeUpdatedAt = true) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
  },
  ...(includeUpdatedAt
    ? {
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      }
    : {}),
})

const softDeleteColumn = (Sequelize) => ({
  type: Sequelize.BOOLEAN,
  allowNull: false,
  defaultValue: false,
})

const addCheck = async (queryInterface, table, name, expression, transaction) => {
  await queryInterface.sequelize.query(
    `ALTER TABLE ${safeIdentifier(table)} ADD CONSTRAINT ${safeIdentifier(name)} CHECK (${expression})`,
    { transaction },
  )
}

const dropTables = async (queryInterface, tables, transaction) => {
  for (const table of tables) await queryInterface.dropTable(table, { transaction })
}

module.exports = {
  addCheck,
  dropTables,
  idColumn,
  softDeleteColumn,
  timestampColumns,
}
