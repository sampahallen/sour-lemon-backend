import { Router } from 'express'
import { verifyPayment } from '../controllers/paymentController.js'
import { optionalAuthenticate } from '../middleware/authMiddleware.js'
import { getAdminProofs, getProofImage, reviewProof } from '../controllers/manualPaymentController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'

export const paymentRouter = Router()

paymentRouter.post('/:paymentId/verify', optionalAuthenticate, verifyPayment)
paymentRouter.get('/manual/proofs', authenticate, authorizeRoles('admin'), getAdminProofs)
paymentRouter.get('/manual/proofs/:id/image', authenticate, authorizeRoles('admin'), getProofImage)
paymentRouter.post('/manual/proofs/:id/review', authenticate, authorizeRoles('admin'), reviewProof)
