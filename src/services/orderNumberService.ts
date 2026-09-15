import { randomBytes } from 'node:crypto'
import { Op, Transaction } from 'sequelize'
import { sequelize } from '../config/database.js'
import { Order } from '../models/Order.js'
import { HttpError } from '../utils/HttpError.js'

const ORDER_NUMBER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const ORDER_NUMBER_LENGTH = 6
const MAX_ALLOCATION_ATTEMPTS = 100

export const orderNumberFromBytes = (bytes: Uint8Array) =>
  Array.from(bytes.slice(0, ORDER_NUMBER_LENGTH), (byte) =>
    ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length],
  ).join('')

export const generateOrderNumber = () =>
  orderNumberFromBytes(randomBytes(ORDER_NUMBER_LENGTH))

export const allocateOrderNumber = async (transaction: Transaction) => {
  // All application instances share this transaction-scoped PostgreSQL lock,
  // so the availability check and subsequent Order insert cannot race.
  await sequelize.query('SELECT pg_advisory_xact_lock(1936420910)', { transaction })

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const candidate = generateOrderNumber()
    const inUse = await Order.count({
      where: { orderNumber: candidate, status: { [Op.ne]: 'completed' } },
      transaction,
    })
    if (inUse === 0) return candidate
  }

  throw new HttpError(503, 'An order number could not be reserved. Please try again.')
}
