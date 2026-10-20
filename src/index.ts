import 'dotenv/config'
import { createServer } from 'node:http'
import { allowedOrigins, app } from './app.js'
import { validateAuthConfig } from './config/auth.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { dropMaxPerMinute, dropWorkerEnabled } from './config/dropEmail.js'
import { attachOrderSocket } from './services/orderSocket.js'
import { startAuthSessionCleanup } from './services/authSessionCleanup.js'
import { markInterruptedDropDeliveries, processNextDropDelivery, scanNewDrops } from './services/dropNotificationService.js'

const port = process.env.PORT ? Number(process.env.PORT) : 4000

const startServer = async () => {
  try {
    validateAuthConfig()
    await connectDatabase()
    const stopAuthSessionCleanup = startAuthSessionCleanup()
    let deliveryRunning = false
    let scanRunning = false
    const dropRate = dropMaxPerMinute()
    const scan = () => {
      if (!dropWorkerEnabled() || scanRunning) return
      scanRunning = true
      void scanNewDrops().catch((error: unknown) => console.error('Drop scan failed', error))
        .finally(() => { scanRunning = false })
    }
    scan()
    const scanTimer = setInterval(scan, 60_000)
    const deliveryTimer = setInterval(() => {
      if (!dropWorkerEnabled() || deliveryRunning) return
      deliveryRunning = true
      void markInterruptedDropDeliveries()
        .then(() => processNextDropDelivery())
        .catch((error: unknown) => console.error('Drop delivery worker failed', error))
        .finally(() => { deliveryRunning = false })
    }, 60_000 / dropRate)

    const server = createServer(app)
    attachOrderSocket(server, allowedOrigins)
    server.listen(port, () => {
      console.log(`sour-lemon-backend listening on http://localhost:${port}`)
    })

    const shutdown = (signal: string) => {
      console.log(`${signal} received; shutting down`)
      stopAuthSessionCleanup()
      clearInterval(deliveryTimer)
      clearInterval(scanTimer)
      server.close(() => {
        void disconnectDatabase()
          .then(() => process.exit(0))
          .catch((error: unknown) => {
            console.error('Failed to close the database connection', error)
            process.exit(1)
          })
      })
    }

    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))
  } catch (error) {
    console.error('Unable to connect to PostgreSQL', error)
    process.exit(1)
  }
}

void startServer()
