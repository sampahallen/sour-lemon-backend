import type { CustomCakeStatus, FulfillmentType, OrderStatus, PaymentStatus } from '../models/types.js'
import { HttpError } from '../utils/HttpError.js'

export interface WhatsAppTemplate {
  id: string
  label: string
  message: string
}

export interface WhatsAppOptions {
  recipient: {
    number: string
    source: 'whatsapp' | 'phone'
  }
  recommendedTemplateId: string
  templates: WhatsAppTemplate[]
}

interface Contact {
  customerName: string
  phoneNumber: string
  whatsappNumber: string | null
}

const recipientFor = (contact: Contact): WhatsAppOptions['recipient'] => {
  const source = contact.whatsappNumber ? 'whatsapp' : 'phone'
  const number = contact.whatsappNumber ?? contact.phoneNumber
  if (!/^\+[1-9]\d{7,14}$/.test(number)) {
    throw new HttpError(409, 'This customer does not have a usable WhatsApp number')
  }
  return { number, source }
}

const template = (id: string, label: string, message: string): WhatsAppTemplate => ({
  id,
  label,
  message,
})

export const buildOrderWhatsAppOptions = (input: Contact & {
  orderNumber: string
  status: OrderStatus
  fulfillmentType: FulfillmentType
  pickupLocation: string | null
  payment: { status: PaymentStatus; checkoutUrl: string | null } | null
}): WhatsAppOptions => {
  const greeting = `Hi ${input.customerName}!`
  const reference = `order #${input.orderNumber}`
  const templates = [
    template('received', 'Order received', `${greeting} We’ve received your Sour Lemon ${reference}. We’ll let you know as it moves along. Thank you!`),
    ...(input.payment?.status === 'pending' && input.payment.checkoutUrl
      ? [template('payment_reminder', 'Payment reminder', `${greeting} A quick reminder to complete payment for your Sour Lemon ${reference}: ${input.payment.checkoutUrl}`)]
      : []),
    template('preparing', 'Preparing your order', `${greeting} We’re now preparing your Sour Lemon ${reference}. We’ll message you again when it’s ready.`),
    ...(input.fulfillmentType !== 'sour_lemon_delivery'
      ? [template(
          'ready',
          input.fulfillmentType === 'pickup' ? 'Ready for pickup' : 'Ready for your rider',
          `${greeting} Your Sour Lemon ${reference} is ready ${input.fulfillmentType === 'pickup' ? 'for pickup' : 'for your rider to collect'}${input.pickupLocation ? ` at ${input.pickupLocation}` : ''}.`,
        )]
      : []),
    ...(input.fulfillmentType === 'sour_lemon_delivery'
      ? [template('delivery', 'Out for delivery / ETA', `${greeting} Your Sour Lemon ${reference} is out for delivery and on its way. We’ll keep you updated.`)]
      : []),
    template('completed', 'Thank you', `${greeting} Your Sour Lemon ${reference} is complete. Thank you for ordering with us—we hope you enjoy every bite!`),
    template('custom', 'Custom update', `${greeting} `),
  ]

  const statusTemplate: Partial<Record<OrderStatus, string>> = {
    received: 'received',
    pending_payment: input.payment?.status === 'pending' && input.payment.checkoutUrl ? 'payment_reminder' : 'received',
    confirmed: 'received',
    preparing: 'preparing',
    ready_for_pickup: 'ready',
    out_for_delivery: 'delivery',
    completed: 'completed',
    cancelled: 'custom',
  }
  const recommended = statusTemplate[input.status] ?? 'custom'

  return {
    recipient: recipientFor(input),
    recommendedTemplateId: templates.some((item) => item.id === recommended) ? recommended : 'custom',
    templates,
  }
}

export const buildCustomCakeWhatsAppOptions = (input: Contact & {
  status: CustomCakeStatus
  occasion: string
  quotedAmount: string | null
  currency: string
}): WhatsAppOptions => {
  const greeting = `Hi ${input.customerName}!`
  const templates = [
    template('received', 'Request received', `${greeting} We’ve received your Sour Lemon custom cake request for ${input.occasion}. We’ll review the details and get back to you soon.`),
    template('details_needed', 'Ask for details', `${greeting} We’re reviewing your custom cake request for ${input.occasion} and need a little more information before we can confirm the design. `),
    ...(input.quotedAmount
      ? [template('quote_ready', 'Quote ready', `${greeting} Your custom cake quote is ${input.currency} ${input.quotedAmount}. Reply here if you’d like to confirm or discuss any details.`)]
      : []),
    template('confirmed', 'Cake confirmed', `${greeting} Your Sour Lemon custom cake for ${input.occasion} is confirmed. We’re excited to make it for you!`),
    template('unable_to_fulfil', 'Unable to fulfil', `${greeting} Thank you for your custom cake request. Unfortunately, we’re unable to take it on this time. We’re sorry we can’t make this one for you.`),
    template('custom', 'Custom update', `${greeting} `),
  ]
  const statusTemplate: Partial<Record<CustomCakeStatus, string>> = {
    submitted: 'received',
    quoted: 'quote_ready',
    awaiting_payment: 'quote_ready',
    confirmed: 'confirmed',
    rejected: 'unable_to_fulfil',
    cancelled: 'custom',
  }
  const recommended = statusTemplate[input.status] ?? 'custom'

  return {
    recipient: recipientFor(input),
    recommendedTemplateId: templates.some((item) => item.id === recommended) ? recommended : 'custom',
    templates,
  }
}
