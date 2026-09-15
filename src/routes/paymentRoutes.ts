import { Router } from 'express'
import { verifyPayment } from '../controllers/paymentController.js'
import { optionalAuthenticate } from '../middleware/authMiddleware.js'

export const paymentRouter = Router()

paymentRouter.post('/:paymentId/verify', optionalAuthenticate, verifyPayment)
