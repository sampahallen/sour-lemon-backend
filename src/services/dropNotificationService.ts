import { createHmac } from 'node:crypto'
import { QueryTypes, type Transaction } from 'sequelize'
import { sequelize } from '../config/database.js'
import { getCustomerAppUrl, getEmailTransport } from '../config/email.js'
import { getDropApiOrigin, getDropContactEmail, getDropEmailFrom, getDropTokenSecret } from '../config/dropEmail.js'

type Kind = 'product' | 'journal'
type DropItem = { name: string; slug: string; description: string | null; image: string | null; price?: string }
type Payload = { kind: Kind; items: DropItem[] }
type Source = { id: string; source_id: string; first_seen_at: Date; name: string; slug: string; description: string | null; image: string | null; price?: string }
type Delivery = { id: string; subscriber_id: string; email: string; subscriber_status: string; payload: Payload }

export function takeReadyProductGroup<T extends { first_seen_at: Date }>(remaining: T[], now = Date.now()) {
  if (!remaining.length) return []
  const firstSeen = new Date(remaining[0].first_seen_at).getTime()
  if (firstSeen > now - 600_000) return []
  const end = remaining.findIndex((item) => new Date(item.first_seen_at).getTime() > firstSeen + 600_000)
  return remaining.splice(0, end < 0 ? remaining.length : end)
}

export function assertDropSendingReady() {
  getDropEmailFrom()
  tokenFor('00000000-0000-0000-0000-000000000000')
  baseUrl()
  getDropApiOrigin()
  getEmailTransport()
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)
const baseUrl = () => getCustomerAppUrl()
const sender = () => getDropEmailFrom()
const contact = () => getDropContactEmail()
const tokenFor = (id: string) => {
  return `${id}.${createHmac('sha256', getDropTokenSecret()).update(id).digest('hex')}`
}
const publicProductCondition = `p.is_deleted = false AND p.archived_at IS NULL AND p.is_active = true
  AND c.is_deleted = false AND c.is_active = true AND s.is_deleted = false AND s.is_enabled = true AND s.key = 'cakes'
  AND (COALESCE((SELECT value FROM app_settings WHERE key = 'menu_scheduling_enabled'), 'false'::jsonb) <> 'true'::jsonb
    OR ((p.available_from IS NULL OR p.available_from <= NOW()) AND (p.available_until IS NULL OR p.available_until > NOW())))`

export async function skipVisibleDrops(transaction: Transaction) {
  await sequelize.query(`
    INSERT INTO drop_sources (id, kind, source_id, status, first_seen_at)
    SELECT gen_random_uuid(), 'product', p.id, 'skipped', NOW()
    FROM products p JOIN categories c ON c.id = p.category_id
    JOIN site_sections s ON s.id = c.site_section_id
    WHERE ${publicProductCondition}
    ON CONFLICT (kind, source_id) DO NOTHING
  `, { transaction })
  await sequelize.query(`
    INSERT INTO drop_sources (id, kind, source_id, status, first_seen_at)
    SELECT gen_random_uuid(), 'journal', id, 'skipped', NOW() FROM journal_posts
    WHERE is_deleted = false AND status = 'published' AND published_at <= NOW()
    ON CONFLICT (kind, source_id) DO NOTHING
  `, { transaction })
}

async function enabled(transaction?: Transaction) {
  const rows = await sequelize.query<{ value: boolean }>(
    "SELECT value = 'true'::jsonb AS value FROM app_settings WHERE key = 'drop_notifications_enabled'",
    { type: QueryTypes.SELECT, transaction },
  )
  return rows[0]?.value === true
}

async function createBatch(kind: Kind, sources: Source[], transaction: Transaction) {
  if (!sources.length) return
  const payload: Payload = { kind, items: sources.map(({ name, slug, description, image, price }) =>
    ({ name, slug, description, image, ...(price ? { price } : {}) })) }
  const rows = await sequelize.query<{ id: string }>(`
    INSERT INTO drop_batches (id, kind, status, payload, created_at, updated_at)
    VALUES (gen_random_uuid(), :kind, 'queued', CAST(:payload AS jsonb), NOW(), NOW()) RETURNING id
  `, { replacements: { kind, payload: JSON.stringify(payload) }, type: QueryTypes.SELECT, transaction })
  const id = rows[0].id
  await sequelize.query(`UPDATE drop_sources SET status = 'batched', batch_id = :id WHERE id IN (:ids)`, {
    replacements: { id, ids: sources.map((source) => source.id) }, transaction,
  })
  await sequelize.query(`
    INSERT INTO drop_deliveries (id, batch_id, subscriber_id, status, attempts, created_at, updated_at)
    SELECT gen_random_uuid(), :id, id, 'queued', 0, NOW(), NOW()
    FROM newsletter_subscribers WHERE status = 'confirmed'
    ON CONFLICT (batch_id, subscriber_id) DO NOTHING
  `, { replacements: { id }, transaction })
}

export async function scanNewDrops() {
  await sequelize.transaction(async (transaction) => {
    const lock = await sequelize.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(20261020, 2) AS acquired', { type: QueryTypes.SELECT, transaction },
    )
    if (!lock[0]?.acquired) return
    const canSend = await enabled(transaction)
    if (!canSend) {
      await sequelize.query("UPDATE drop_sources SET status = 'skipped' WHERE status = 'pending'", { transaction })
      await sequelize.query("UPDATE drop_deliveries SET status = 'suppressed', updated_at = NOW() WHERE status = 'queued'", { transaction })
    }
    await sequelize.query(`
      INSERT INTO drop_sources (id, kind, source_id, status, first_seen_at)
      SELECT gen_random_uuid(), 'product', p.id, :status, NOW()
      FROM products p JOIN categories c ON c.id = p.category_id
      JOIN site_sections s ON s.id = c.site_section_id
      WHERE ${publicProductCondition}
      ON CONFLICT (kind, source_id) DO NOTHING
    `, { replacements: { status: canSend ? 'pending' : 'skipped' }, transaction })
    await sequelize.query(`
      INSERT INTO drop_sources (id, kind, source_id, status, first_seen_at)
      SELECT gen_random_uuid(), 'journal', id, :status, NOW() FROM journal_posts
      WHERE is_deleted = false AND status = 'published' AND published_at <= NOW()
      ON CONFLICT (kind, source_id) DO NOTHING
    `, { replacements: { status: canSend ? 'pending' : 'skipped' }, transaction })
    if (!canSend) return

    const journals = await sequelize.query<Source>(`
      SELECT ds.id, ds.source_id, ds.first_seen_at, j.title AS name, j.slug, j.excerpt AS description,
        (SELECT i.url FROM journal_post_images i WHERE i.journal_post_id = j.id AND i.role = 'cover' AND i.is_deleted = false LIMIT 1) AS image
      FROM drop_sources ds JOIN journal_posts j ON j.id = ds.source_id
      JOIN journal_categories c ON c.id = j.category_id
      WHERE ds.kind = 'journal' AND ds.status = 'pending' AND j.is_deleted = false
        AND j.status = 'published' AND j.published_at <= NOW()
        AND c.is_deleted = false AND c.is_active = true
      ORDER BY ds.first_seen_at, ds.id
    `, { type: QueryTypes.SELECT, transaction })
    for (const journal of journals) await createBatch('journal', [journal], transaction)
    await sequelize.query(`UPDATE drop_sources ds SET status = 'skipped' WHERE ds.kind = 'journal' AND ds.status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM journal_posts j JOIN journal_categories c ON c.id = j.category_id
        WHERE j.id = ds.source_id AND j.is_deleted = false AND j.status = 'published' AND j.published_at <= NOW()
          AND c.is_deleted = false AND c.is_active = true)`, { transaction })

    const products = await sequelize.query<Source>(`
      SELECT ds.id, ds.source_id, ds.first_seen_at, p.name, p.slug, p.description,
        p.price::text AS price,
        (SELECT i.url FROM product_images i WHERE i.product_id = p.id AND i.is_deleted = false ORDER BY i.sort_order, i.created_at LIMIT 1) AS image
      FROM drop_sources ds JOIN products p ON p.id = ds.source_id
      JOIN categories c ON c.id = p.category_id JOIN site_sections s ON s.id = c.site_section_id
      WHERE ds.kind = 'product' AND ds.status = 'pending' AND ${publicProductCondition}
      ORDER BY ds.first_seen_at, ds.id
    `, { type: QueryTypes.SELECT, transaction })
    const visibleIds = new Set(products.map((product) => product.id))
    await sequelize.query("UPDATE drop_sources SET status = 'skipped' WHERE kind = 'product' AND status = 'pending' AND id NOT IN (:ids)", {
      replacements: { ids: [...visibleIds, '00000000-0000-0000-0000-000000000000'] }, transaction,
    })
    const remaining = [...products]
    for (let group = takeReadyProductGroup(remaining); group.length; group = takeReadyProductGroup(remaining)) {
      await createBatch('product', group, transaction)
    }
  })
}

export function renderDropEmail(payload: Payload, unsubscribeUrl: string) {
  const isJournal = payload.kind === 'journal'
  const subject = isJournal ? `Fresh from the Journal: ${payload.items[0].name}` :
    payload.items.length === 1 ? `Fresh from Sour Lemon: ${payload.items[0].name}` : `Fresh from Sour Lemon: ${payload.items.length} new bakery treats`
  const preview = isJournal ? 'A new story is ready for you.' : 'The latest bakery drop is here.'
  const heading = isJournal ? 'A fresh story, just for you.' : 'Something sweet just dropped.'
  const root = baseUrl()
  const href = (item: DropItem) => `${root}/${isJournal ? 'journal' : 'bakery'}/${encodeURIComponent(item.slug)}`
  const cards = payload.items.map((item) => {
    const link = href(item)
    const image = item.image && /^https?:\/\//i.test(item.image) ? `<tr><td><a href="${escapeHtml(link)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" width="520" style="display:block;width:100%;height:auto;border:0;border-radius:18px"></a></td></tr>` : ''
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px">${image}<tr><td style="padding:18px 0 0;font-family:Arial,sans-serif;color:#4a2c1d"><h2 style="margin:0 0 8px;font-size:25px;line-height:1.2">${escapeHtml(item.name)}</h2>${item.description ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">${escapeHtml(item.description.slice(0, 180))}</p>` : ''}${item.price ? `<p style="margin:0 0 18px;font-weight:bold">GHS ${escapeHtml(item.price)}</p>` : ''}<a href="${escapeHtml(link)}" style="display:inline-block;background:#f66a38;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 22px;border-radius:26px">${isJournal ? 'Read the story' : 'See the treat'}</a></td></tr></table>`
  }).join('')
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f8f0c9;color:#4a2c1d"><div style="display:none;max-height:0;overflow:hidden">${preview}</div><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px"><tr><td style="padding:16px 20px 24px;font-family:Arial,sans-serif;font-size:25px;font-weight:900">Sour <span style="color:#f66a38">Lemon</span><span style="color:#f3d98b"> ✳</span></td></tr><tr><td style="padding:28px 24px;background:#fffaf0;border-radius:22px;font-family:Arial,sans-serif"><p style="margin:0 0 8px;color:#f66a38;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">${isJournal ? 'The Journal' : 'New bakery drop'}</p><h1 style="margin:0 0 24px;font-size:34px;line-height:1.1">${heading}</h1>${cards}</td></tr><tr><td style="padding:24px 18px;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#654d42">You asked us to let you know when something new drops.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#4a2c1d">Unsubscribe</a>${contact() ? ` · ${escapeHtml(contact())}` : ''}</td></tr></table></td></tr></table></body></html>`
  const text = `${heading}\n\n${payload.items.map((item) => `${item.name}${item.description ? `\n${item.description.slice(0, 180)}` : ''}${item.price ? `\nGHS ${item.price}` : ''}\n${href(item)}`).join('\n\n')}\n\nUnsubscribe: ${unsubscribeUrl}`
  return { subject, html, text }
}

export async function markInterruptedDropDeliveries() {
  await sequelize.query("UPDATE drop_deliveries SET status = 'review', last_error = 'Interrupted during SMTP send', updated_at = NOW() WHERE status = 'sending' AND updated_at < NOW() - INTERVAL '30 minutes'")
}

async function finishSettledDropBatches() {
  await sequelize.query(`UPDATE drop_batches b SET status = 'settled', updated_at = NOW()
    WHERE status = 'queued' AND NOT EXISTS (
      SELECT 1 FROM drop_deliveries d WHERE d.batch_id = b.id AND d.status IN ('queued', 'sending')
    )`)
}

export async function processNextDropDelivery() {
  const rows = await sequelize.query<Delivery>(`
    UPDATE drop_deliveries d SET status = 'sending', attempts = attempts + 1, updated_at = NOW()
    FROM (SELECT id FROM drop_deliveries WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) claim,
      newsletter_subscribers s, drop_batches b
    WHERE d.id = claim.id AND s.id = d.subscriber_id AND b.id = d.batch_id
    RETURNING d.id, d.subscriber_id, s.email, s.status AS subscriber_status, b.payload
  `, { type: QueryTypes.SELECT })
  const delivery = rows[0]
  if (!delivery) {
    await finishSettledDropBatches()
    return false
  }
  if (delivery.subscriber_status !== 'confirmed' || !await enabled()) {
    await sequelize.query("UPDATE drop_deliveries SET status = 'suppressed', updated_at = NOW() WHERE id = :id", { replacements: { id: delivery.id } })
    await finishSettledDropBatches()
    return true
  }
  try {
    const token = tokenFor(delivery.subscriber_id)
    const unsubscribeUrl = `${baseUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
    const apiOrigin = getDropApiOrigin()
    const eligible = await sequelize.query<{ id: string }>("SELECT id FROM newsletter_subscribers WHERE id = :id AND status = 'confirmed'", {
      replacements: { id: delivery.subscriber_id }, type: QueryTypes.SELECT,
    })
    if (!eligible.length || !await enabled()) {
      await sequelize.query("UPDATE drop_deliveries SET status = 'suppressed', updated_at = NOW() WHERE id = :id", { replacements: { id: delivery.id } })
      await finishSettledDropBatches()
      return true
    }
    const { subject, html, text } = renderDropEmail(delivery.payload, unsubscribeUrl)
    const info = await getEmailTransport().sendMail({ from: sender(), to: delivery.email, subject, html, text,
      headers: {
        'List-Unsubscribe': `<${apiOrigin}/api/newsletter/one-click/${encodeURIComponent(token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    await sequelize.query("UPDATE drop_deliveries SET status = 'accepted', smtp_message_id = :messageId, updated_at = NOW() WHERE id = :id", {
      replacements: { id: delivery.id, messageId: info.messageId ?? null },
    })
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'responseCode' in error ? Number(error.responseCode) : 0
    const retry = code >= 400 && code < 500
    await sequelize.query(`UPDATE drop_deliveries SET
      status = CASE WHEN :retry AND attempts < 3 THEN 'queued' WHEN :retry THEN 'failed' ELSE 'review' END,
      next_attempt_at = CASE WHEN :retry AND attempts < 3 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
      last_error = :message, updated_at = NOW() WHERE id = :id`, {
      replacements: { id: delivery.id, retry, message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown SMTP error' },
    })
  }
  await finishSettledDropBatches()
  return true
}
