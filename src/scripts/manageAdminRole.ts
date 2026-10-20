import 'dotenv/config'
import { QueryTypes } from 'sequelize'
import { connectDatabase, disconnectDatabase, sequelize } from '../config/database.js'
import { AuthSession } from '../models/AuthSession.js'
import { User } from '../models/User.js'
import { canRevokeAdmin } from '../services/roleAccess.js'

const action = process.argv[2]
const userId = process.argv[3] === '--user-id' ? process.argv[4] : undefined
if (!['grant', 'revoke'].includes(action ?? '') || !userId ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) || process.argv.length !== 5) {
  console.error('Usage: npm run admin:grant -- --user-id <uuid> (or admin:revoke)')
  process.exit(2)
}

try {
  await connectDatabase()
  const changed = await sequelize.transaction(async (transaction) => {
    await sequelize.query('SELECT pg_advisory_xact_lock(20261020, 3)', { type: QueryTypes.SELECT, transaction })
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!user || user.isDeleted) throw new Error('User not found')
    if (action === 'grant') {
      if (!user.isActive) throw new Error('Cannot grant admin to an inactive account')
      if (!user.roles.includes('admin')) {
        await user.update({ roles: ['customer', 'admin'], role: 'admin' }, { transaction })
      } else {
        return false
      }
    } else if (user.roles.includes('admin')) {
      const activeAdmins = await sequelize.query<{ count: number }>(`
        SELECT COUNT(*)::int AS count FROM users
        WHERE roles @> ARRAY['admin']::varchar(20)[] AND is_active = true AND is_deleted = false
      `, { type: QueryTypes.SELECT, transaction })
      if (!canRevokeAdmin(user.isActive, activeAdmins[0].count)) throw new Error('Cannot remove the last active admin')
      await user.update({ roles: ['customer'], role: 'customer' }, { transaction })
      await AuthSession.update({ revokedAt: new Date() }, {
        where: { userId: user.id, role: 'admin', revokedAt: null }, transaction,
      })
    } else {
      return false
    }
    return true
  })
  console.log(`${changed ? (action === 'grant' ? 'Granted' : 'Revoked') : 'No change to'} admin role for ${userId}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not update admin role')
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}
