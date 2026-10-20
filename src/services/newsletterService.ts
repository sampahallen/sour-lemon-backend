import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { QueryTypes } from 'sequelize'
import { sequelize } from '../config/database.js'
import { getCustomerAppUrl, getEmailTransport } from '../config/email.js'
import { getDropEmailFrom, getDropTokenSecret } from '../config/dropEmail.js'
import { HttpError } from '../utils/HttpError.js'

export const consentVersion = 'newsletter-v1'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const publicUrl = () => getCustomerAppUrl()
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)

export interface SubscriberRow {
  id: string
  email: string
  status: 'pending' | 'confirmed' | 'unsubscribed' | 'suppressed'
  confirmed_at: Date | null
  consented_at: Date
  confirmation_sent_at: Date | null
  created_at: Date
}

const tokenSubscriberId = (token: string) => {
  const match = /^([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(token)
  if (!match) return null
  const expected = createHmac('sha256', getDropTokenSecret()).update(match[1]).digest()
  const supplied = Buffer.from(match[2], 'hex')
  return timingSafeEqual(expected, supplied) ? match[1] : null
}

export async function subscribe(email: string) {
  let transport: ReturnType<typeof getEmailTransport>
  let from: string
  try {
    transport = getEmailTransport()
    from = getDropEmailFrom()
    getCustomerAppUrl()
  } catch {
    throw new HttpError(503, 'Email signup is temporarily unavailable')
  }
  const normalized = email.trim().toLowerCase()
  const token = randomBytes(32).toString('hex')
  const rows = await sequelize.query<SubscriberRow>(`
    INSERT INTO newsletter_subscribers (id, email, status, consent_version, consented_at, confirmation_hash, confirmation_expires_at, confirmation_sent_at, created_at, updated_at)
    VALUES (gen_random_uuid(), :email, 'pending', :version, NOW(), :hash, NOW() + INTERVAL '7 days', NOW(), NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      status = 'pending', consent_version = :version, consented_at = NOW(), confirmed_at = NULL,
      unsubscribed_at = NULL, confirmation_hash = :hash, confirmation_expires_at = NOW() + INTERVAL '7 days',
      confirmation_sent_at = NOW(), updated_at = NOW()
    WHERE newsletter_subscribers.status IN ('pending', 'unsubscribed')
      AND (newsletter_subscribers.confirmation_sent_at IS NULL OR newsletter_subscribers.confirmation_sent_at < NOW() - INTERVAL '15 minutes')
    RETURNING id, email, status, confirmed_at, consented_at, confirmation_sent_at, created_at
  `, { replacements: { email: normalized, version: consentVersion, hash: digest(token) }, type: QueryTypes.SELECT })
  if (!rows.length) return
  const link = `${publicUrl()}/newsletter/confirm?token=${token}`
  try {
    await transport.sendMail({
      from, to: normalized, subject: 'Confirm your Sour Lemon drop alerts',
      text: `Confirm your signup within 7 days: ${link}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Confirm that you want Sour Lemon emails when new bakery treats and Journal stories drop.</p><p><a href="${escapeHtml(link)}">Confirm my email</a></p><p>This link expires in 7 days. If you did not request this, ignore this email.</p>`,
    })
  } catch (error) {
    // Retain the pending record for a later request; do not reveal account state publicly.
    console.error('Drop alert confirmation email failed', error)
    await sequelize.query(`UPDATE newsletter_subscribers SET confirmation_sent_at = NULL
      WHERE email = :email AND confirmation_hash = :hash AND status = 'pending'`, {
      replacements: { email: normalized, hash: digest(token) },
    })
    throw new HttpError(503, 'Email signup is temporarily unavailable. Please try again later.')
  }
}

export async function confirmSubscription(token: string) {
  const rows = await sequelize.query<SubscriberRow>(`
    UPDATE newsletter_subscribers SET status = 'confirmed', confirmed_at = NOW(), confirmation_hash = NULL,
      confirmation_expires_at = NULL, updated_at = NOW()
    WHERE status = 'pending' AND confirmation_hash = :hash AND confirmation_expires_at > NOW()
    RETURNING id, email, status, confirmed_at, consented_at, confirmation_sent_at, created_at
  `, { replacements: { hash: digest(token) }, type: QueryTypes.SELECT })
  return rows.length > 0
}

export async function unsubscribe(token: string) {
  const id = tokenSubscriberId(token)
  if (!id) return false
  const rows = await sequelize.query<{ id: string }>(`
    UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = NOW(), confirmation_hash = NULL,
      confirmation_expires_at = NULL, updated_at = NOW()
    WHERE id = :id AND status IN ('confirmed', 'unsubscribed') RETURNING id
  `, { replacements: { id }, type: QueryTypes.SELECT })
  return rows.length > 0
}

export async function listSubscribers(search: string, limit: number, offset: number) {
  const rows = await sequelize.query<SubscriberRow>(`
    SELECT id, email, status, confirmed_at, consented_at, confirmation_sent_at, created_at
    FROM newsletter_subscribers WHERE email ILIKE :search ORDER BY created_at DESC LIMIT :limit OFFSET :offset
  `, { replacements: { search: `%${search}%`, limit, offset }, type: QueryTypes.SELECT })
  const counts = await sequelize.query<{ status: string; count: string }>(`
    SELECT status, COUNT(*)::text AS count FROM newsletter_subscribers GROUP BY status
  `, { type: QueryTypes.SELECT })
  return { subscribers: rows, counts: Object.fromEntries(counts.map((row) => [row.status, Number(row.count)])) }
}

export async function suppressSubscriber(id: string) {
  const rows = await sequelize.query<{ id: string }>(`
    UPDATE newsletter_subscribers SET status = 'suppressed', confirmation_hash = NULL,
      confirmation_expires_at = NULL, updated_at = NOW() WHERE id = :id RETURNING id
  `, { replacements: { id }, type: QueryTypes.SELECT })
  if (!rows.length) throw new HttpError(404, 'Subscriber not found')
}

