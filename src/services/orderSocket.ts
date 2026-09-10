import type { Server as HttpServer } from 'node:http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { getJwtSecret } from '../config/auth.js'
import { User } from '../models/User.js'
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
      const payload = jwt.verify(token, getJwtSecret())
      if (typeof payload === 'string' || !payload.sub || payload.role !== 'admin') {
        throw new Error('Admin authentication required')
      }
      const user = await User.findOne({
        where: { id: payload.sub, role: 'admin', isActive: true, isDeleted: false },
        attributes: ['id'],
      })
      if (!user) throw new Error('Admin authentication required')
      socket.data.userId = user.id
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
