import cors from 'cors'
import express from 'express'
import { errorHandler, notFound } from './middleware/errorMiddleware.js'
import { authRouter } from './routes/authRoutes.js'
import { appSettingRouter } from './routes/appSettingRoutes.js'
import { cartRouter } from './routes/cartRoutes.js'
import { checkoutRouter } from './routes/checkoutRoutes.js'
import { catalogRouter, categoryRouter, productRouter } from './routes/catalogRoutes.js'
import { customCakeRouter } from './routes/customCakeRoutes.js'
import { deliveryAreaRouter } from './routes/deliveryAreaRoutes.js'
import { journalRouter } from './routes/journalRoutes.js'
import { orderRouter } from './routes/orderRoutes.js'
import { paymentRouter } from './routes/paymentRoutes.js'
import { paystackWebhook } from './controllers/paymentController.js'
import { publicSettingsRouter } from './routes/publicSettingsRoutes.js'
import { siteSectionRouter } from './routes/siteSectionRoutes.js'
import { userRouter } from './routes/userRoutes.js'
import { noStore } from './middleware/cacheControl.js'

export const app = express()

export const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(null, false)
  },
}))
app.post('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }), paystackWebhook)
app.use(express.json())
app.use(noStore)

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', database: 'connected' })
})

app.use('/api/auth', authRouter)
app.use('/api/app-settings', appSettingRouter)
app.use('/api/cart', cartRouter)
app.use('/api/checkout', checkoutRouter)
app.use('/api/catalog', catalogRouter)
app.use('/api/categories', categoryRouter)
app.use('/api/custom-cake-requests', customCakeRouter)
app.use('/api/delivery-areas', deliveryAreaRouter)
app.use('/api/journal', journalRouter)
app.use('/api/orders', orderRouter)
app.use('/api/payments', paymentRouter)
app.use('/api/products', productRouter)
app.use('/api/settings/public', publicSettingsRouter)
app.use('/api/site-sections', siteSectionRouter)
app.use('/api/users', userRouter)
app.use(notFound)
app.use(errorHandler)
