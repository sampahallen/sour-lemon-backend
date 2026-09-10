import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCustomCakeWhatsAppOptions,
  buildOrderWhatsAppOptions,
} from './whatsappComposerService.js'

const order = {
  customerName: 'Ama',
  phoneNumber: '+233201234567',
  whatsappNumber: '+233501234567',
  orderNumber: 'A10001',
  status: 'pending_payment' as const,
  fulfillmentType: 'pickup' as const,
  pickupLocation: '12 Volta Street, Osu',
  payment: { status: 'pending' as const, checkoutUrl: 'https://checkout.paystack.com/example' },
}

test('uses WhatsApp contact and recommends a real pending payment link', () => {
  const options = buildOrderWhatsAppOptions(order)
  assert.deepEqual(options.recipient, { number: '+233501234567', source: 'whatsapp' })
  assert.equal(options.recommendedTemplateId, 'payment_reminder')
  assert.match(options.templates.find((item) => item.id === 'payment_reminder')!.message, /checkout\.paystack\.com/)
})

test('falls back to phone and includes configured collection location', () => {
  const options = buildOrderWhatsAppOptions({
    ...order,
    whatsappNumber: null,
    payment: null,
    status: 'ready_for_pickup',
  })
  assert.equal(options.recipient.source, 'phone')
  assert.match(options.templates.find((item) => item.id === 'ready')!.message, /12 Volta Street/)
})

test('omits payment reminders without a genuine checkout URL', () => {
  const options = buildOrderWhatsAppOptions({
    ...order,
    payment: { status: 'pending', checkoutUrl: null },
  })
  assert.equal(options.templates.some((item) => item.id === 'payment_reminder'), false)
})

test('custom cake quotes never include a placeholder payment link', () => {
  const options = buildCustomCakeWhatsAppOptions({
    customerName: 'Ama',
    phoneNumber: '+233201234567',
    whatsappNumber: null,
    status: 'quoted',
    occasion: 'Birthday',
    quotedAmount: '450.00',
    currency: 'GHS',
  })
  const quote = options.templates.find((item) => item.id === 'quote_ready')!
  assert.equal(options.recommendedTemplateId, 'quote_ready')
  assert.doesNotMatch(quote.message, /https?:\/\//)
})

test('rejects unusable recipients', () => {
  assert.throws(() => buildOrderWhatsAppOptions({
    ...order,
    whatsappNumber: null,
    phoneNumber: 'not-a-phone',
  }), /usable WhatsApp number/)
})
