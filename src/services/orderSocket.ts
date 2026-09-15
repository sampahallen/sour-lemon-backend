import type { Server as HttpServer } from 'node:http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { verifyAccessToken } from '../middleware/authMiddleware.js'
import { onOrderChanged } from './orderEvents.js'

export const attachOrderSocket = (server: HttpServer, allowedOrigins: string[]) => {
  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  })

  io.use(async (socket, next) => {
    const token = typeof socket.handshake.auth.token === 'string'
      ? socket.handshake.auth.token
      : ''
    try {
      const auth = await verifyAccessToken(token)
      if (auth.role !== 'admin') {
        throw new Error('Admin authentication required')
      }
      socket.data.userId = auth.userId
      const payload = jwt.decode(token)
      const expiresAt = payload && typeof payload !== 'string' ? payload.exp : null
      if (typeof expiresAt !== 'number') throw new Error('Admin authentication required')
      const timeout = setTimeout(() => socket.disconnect(true), Math.max(0, expiresAt * 1000 - Date.now()))
      socket.on('disconnect', () => clearTimeout(timeout))
      next()
    } catch {
      next(new Error('Admin authentication required'))
    }
  })

  io.on('connection', (socket) => {
    void socket.join('admins')
  })

  const unsubscribe = onOrderChanged((event) => {
    io.to('admins').emit('orders:changed', event)
  })
  io.engine.on('close', unsubscribe)
  return io
}
