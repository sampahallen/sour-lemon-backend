import { Sequelize } from 'sequelize'
import { initializeModels } from '../models/index.js'

const isEnabled = (value: string | undefined) => value?.toLowerCase() === 'true'

const pool = {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  min: Number(process.env.DB_POOL_MIN ?? 0),
  acquire: Number(process.env.DB_POOL_ACQUIRE ?? 30_000),
  idle: Number(process.env.DB_POOL_IDLE ?? 10_000),
}

const commonOptions = {
  dialect: 'postgres' as const,
  logging: isEnabled(process.env.DB_LOGGING) ? console.log : false,
  pool,
  dialectOptions: isEnabled(process.env.DB_SSL)
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      }
    : undefined,
}

export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize(
      process.env.DB_NAME ?? 'sour_lemon',
      process.env.DB_USER ?? 'postgres',
      process.env.DB_PASSWORD ?? 'postgres',
      {
        ...commonOptions,
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
      },
    )

initializeModels(sequelize)

export const connectDatabase = async () => {
  await sequelize.authenticate()
  console.log('PostgreSQL connection established')
}

export const disconnectDatabase = async () => {
  await sequelize.close()
  console.log('PostgreSQL connection closed')
}
