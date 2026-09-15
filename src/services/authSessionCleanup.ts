import { Op } from 'sequelize'
import { getSessionAbsoluteMs } from '../config/auth.js'
import { AuthRefreshUse } from '../models/AuthRefreshUse.js'

const dayMs = 24 * 60 * 60 * 1000

export const startAuthSessionCleanup = () => {
  const retentionMs = Math.max(getSessionAbsoluteMs('admin'), getSessionAbsoluteMs('customer')) + dayMs
  const run = () => {
    void AuthRefreshUse.destroy({ where: { usedAt: { [Op.lt]: new Date(Date.now() - retentionMs) } } })
      .catch((error: unknown) => console.error('Could not clean expired refresh-token history', error))
  }
  run()
  const timer = setInterval(run, 24 * 60 * 60 * 1000)
  timer.unref()
  return () => clearInterval(timer)
}
