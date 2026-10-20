import { getEmailFrom } from './email.js'

export const getDropEmailFrom = () =>
  process.env.DROP_ALERT_FROM?.trim() || process.env.NEWSLETTER_FROM?.trim() || getEmailFrom()

export const getDropContactEmail = () =>
  process.env.DROP_ALERT_CONTACT_EMAIL?.trim() || process.env.NEWSLETTER_CONTACT_EMAIL?.trim() || ''

export const getDropTokenSecret = () => {
  const value = process.env.DROP_ALERT_TOKEN_SECRET?.trim() || process.env.NEWSLETTER_TOKEN_SECRET?.trim()
  if (!value || value.length < 32) throw new Error('DROP_ALERT_TOKEN_SECRET must have at least 32 characters')
  return value
}

export const getDropApiOrigin = () => {
  const value = process.env.DROP_ALERT_API_URL?.trim() || process.env.NEWSLETTER_API_URL?.trim()
  if (!value) throw new Error('DROP_ALERT_API_URL must be configured')
  const url = new URL(value)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
    throw new Error('DROP_ALERT_API_URL must use HTTPS')
  }
  return value.replace(/\/$/, '')
}

export const dropWorkerEnabled = () =>
  (process.env.DROP_ALERT_WORKER_ENABLED ?? process.env.NEWSLETTER_WORKER_ENABLED) !== 'false'

export const dropMaxPerMinute = () => Math.max(1, Math.min(60,
  Number(process.env.DROP_ALERT_MAX_PER_MINUTE ?? process.env.NEWSLETTER_MAX_PER_MINUTE ?? 10) || 10,
))
