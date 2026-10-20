import { EventEmitter } from 'node:events'

export interface OperationChangedEvent {
  area: 'proofs' | 'cakes'
  id: string
  reason: 'created' | 'updated' | 'reviewed'
}

const emitter = new EventEmitter()

export const publishOperationChanged = (event: OperationChangedEvent) => {
  emitter.emit('changed', event)
}

export const onOperationChanged = (listener: (event: OperationChangedEvent) => void) => {
  emitter.on('changed', listener)
  return () => emitter.off('changed', listener)
}
