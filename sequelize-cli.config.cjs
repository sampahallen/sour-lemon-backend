require('dotenv').config({ quiet: true })

const enabled = (value) => value?.toLowerCase() === 'true'

const connection = () => {
  const shared = {
    dialect: 'postgres',
    logging: enabled(process.env.DB_LOGGING) ? console.log : false,
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
    seederStorage: 'sequelize',
    seederStorageTableName: 'SequelizeData',
    dialectOptions: enabled(process.env.DB_SSL)
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          },
        }
      : undefined,
  }

  if (process.env.DATABASE_URL) {
    return { ...shared, use_env_variable: 'DATABASE_URL' }
  }

  return {
    ...shared,
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'sour_lemon',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
  }
}

module.exports = {
  development: connection(),
  test: connection(),
  production: connection(),
}
