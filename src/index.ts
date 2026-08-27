import 'dotenv/config'
import { app } from './app.js'
import { validateAuthConfig } from './config/auth.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'

const port = process.env.PORT ? Number(process.env.PORT) : 4000

const startServer = async () => {
  try {
    validateAuthConfig()
    await connectDatabase()

    const server = app.listen(port, () => {
      console.log(`sour-lemon-backend listening on http://localhost:${port}`)
    })

    const shutdown = (signal: string) => {
      console.log(`${signal} received; shutting down`)
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
