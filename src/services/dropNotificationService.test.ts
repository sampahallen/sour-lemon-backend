import assert from 'node:assert/strict'
import test from 'node:test'
import { renderDropEmail, takeReadyProductGroup } from './dropNotificationService.js'

test('bakery releases within ten minutes share one batch', () => {
  const start = new Date('2026-10-20T12:00:00Z').getTime()
  const releases = [0, 9, 11].map((minutes) => ({ first_seen_at: new Date(start + minutes * 60_000) }))
  assert.equal(takeReadyProductGroup(releases, start + 9 * 60_000).length, 0)
  assert.equal(takeReadyProductGroup(releases, start + 10 * 60_000).length, 2)
  assert.equal(releases.length, 1)
})

test('product alert escapes catalog text and contains an unsubscribe link', () => {
  process.env.CUSTOMER_APP_URL = 'https://sourlemon.example'
  const rendered = renderDropEmail({ kind: 'product', items: [{
    name: '<script>alert(1)</script>', slug: 'new-cake', description: '<img src=x onerror=alert(1)>',
    image: 'https://images.example/cake.jpg?x=1&y=2', price: '35.00',
  }] }, 'https://sourlemon.example/newsletter/unsubscribe?token=abc&source=email')
  assert.doesNotMatch(rendered.html, /<script>|<img src=x/)
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(rendered.html, /cake.jpg\?x=1&amp;y=2/)
  assert.match(rendered.html, /token=abc&amp;source=email/)
  assert.match(rendered.text, /Unsubscribe: https:\/\/sourlemon.example/)
})

test('journal alert links to its story without a product price', () => {
  process.env.CUSTOMER_APP_URL = 'https://sourlemon.example'
  const rendered = renderDropEmail({ kind: 'journal', items: [{
    name: 'A little zest', slug: 'a-little-zest', description: 'Our kitchen notes', image: null,
  }] }, 'https://sourlemon.example/newsletter/unsubscribe?token=abc')
  assert.match(rendered.html, /\/journal\/a-little-zest/)
  assert.match(rendered.subject, /Fresh from the Journal/)
  assert.doesNotMatch(rendered.html, /GHS/)
})
