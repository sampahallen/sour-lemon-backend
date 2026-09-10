import { EventEmitter } from 'node:events'

export type OrderChangeReason =
  | 'created'
  | 'payment_updated'
  | 'payment_confirmed'
  | 'cash_collected'
  | 'status_updated'

export interface OrderChangedEvent {
  orderId: string
  reason: OrderChangeReason
}

const emitter = new EventEmitter()

export const publishOrderChanged = (event: OrderChangedEvent) => {
  emitter.emit('changed', event)
}

export const onOrderChanged = (listener: (event: OrderChangedEvent) => void) => {
  emitter.on('changed', listener)
  return () => emitter.off('changed', listener)
}
