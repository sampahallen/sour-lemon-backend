import type {
  FulfillmentType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '../models/types.js'

export const ORDER_ACTIONS = [
  'confirm_payment',
  'collect_cash',
  'start_preparing',
  'mark_ready',
  'dispatch',
  'complete',
  'cancel',
] as const
export type OrderAction = (typeof ORDER_ACTIONS)[number]

interface WorkflowOrder {
  status: OrderStatus
  fulfillmentType: FulfillmentType
}

interface WorkflowPayment {
  provider: PaymentProvider
  status: PaymentStatus
  requiresManualConfirmation: boolean
  adminConfirmedAt: Date | null
}

export type PaymentDisplayStatus =
  | 'waiting_for_payment'
  | 'needs_review'
  | 'confirmed'
  | 'cash_due'
  | 'cash_collected'
  | 'failed'
  | 'refunded'

export type PaymentGroup = 'pending' | 'needs_attention' | 'paid' | 'refunded'

export const paymentDisplayStatus = (payment: WorkflowPayment | null): PaymentDisplayStatus => {
  if (!payment || payment.status === 'pending') return 'waiting_for_payment'
  if (payment.status === 'failed') return 'failed'
  if (payment.status === 'refunded') return 'refunded'
  if (payment.status === 'cash_due') return 'cash_due'
  if (payment.status === 'cash_collected') return 'cash_collected'
  if (payment.requiresManualConfirmation && !payment.adminConfirmedAt) return 'needs_review'
  return 'confirmed'
}

export const paymentGroup = (payment: WorkflowPayment | null): PaymentGroup => {
  const displayStatus = paymentDisplayStatus(payment)
  if (displayStatus === 'waiting_for_payment' || displayStatus === 'cash_due') return 'pending'
  if (displayStatus === 'needs_review' || displayStatus === 'failed') return 'needs_attention'
  if (displayStatus === 'refunded') return 'refunded'
  return 'paid'
}

const paymentAllowsPreparation = (payment: WorkflowPayment | null) => {
  if (!payment) return false
  if (payment.provider === 'cash') return ['cash_due', 'cash_collected'].includes(payment.status)
  return payment.status === 'paid' && (
    !payment.requiresManualConfirmation || payment.adminConfirmedAt !== null
  )
}

const paymentAllowsCompletion = (payment: WorkflowPayment | null) => {
  if (!payment) return false
  if (payment.provider === 'cash') return payment.status === 'cash_collected'
  return paymentAllowsPreparation(payment)
}

export const getAllowedOrderTransitions = (
  order: WorkflowOrder,
  payment: WorkflowPayment | null,
): OrderStatus[] => {
  switch (order.status) {
    case 'received':
    case 'pending_payment':
    case 'confirmed':
      return [
        ...(paymentAllowsPreparation(payment) ? ['preparing' as const] : []),
        'cancelled',
      ]
    case 'preparing':
      return [
        order.fulfillmentType === 'sour_lemon_delivery'
          ? 'out_for_delivery'
          : 'ready_for_pickup',
        'cancelled',
      ]
    case 'ready_for_pickup':
    case 'out_for_delivery':
      return [...(paymentAllowsCompletion(payment) ? ['completed' as const] : []), 'cancelled']
    case 'completed':
    case 'cancelled':
      return []
  }
}

export const getAvailableOrderActions = (
  order: WorkflowOrder,
  payment: WorkflowPayment | null,
): OrderAction[] => {
  if (['completed', 'cancelled'].includes(order.status)) return []

  const actions: OrderAction[] = []
  if (
    payment?.provider === 'paystack' &&
    payment.status === 'paid' &&
    payment.requiresManualConfirmation &&
    !payment.adminConfirmedAt
  ) actions.push('confirm_payment')
  if (payment?.provider === 'cash' && payment.status === 'cash_due') actions.push('collect_cash')

  const transitions = getAllowedOrderTransitions(order, payment)
  if (transitions.includes('preparing')) actions.push('start_preparing')
  if (transitions.includes('ready_for_pickup')) actions.push('mark_ready')
  if (transitions.includes('out_for_delivery')) actions.push('dispatch')
  if (transitions.includes('completed')) actions.push('complete')
  if (transitions.includes('cancelled')) actions.push('cancel')
  return actions
}
