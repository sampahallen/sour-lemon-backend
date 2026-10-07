import { Router } from 'express'
import { getCakePayment, submitCakeProof, getCakePaymentLink, revokeCakePaymentLink } from '../controllers/manualPaymentController.js'
import { paymentProofRateLimit, paymentProofUpload, validatePaymentProof } from '../middleware/paymentProofUpload.js'
import {
  cancelCustomCakeRequest,
  createCustomCakeRequest,
  getCustomCakeRequest,
  listCustomCakeRequests,
  quoteCustomCakeRequest,
  rejectCustomCakeRequest,
  getCustomCakeWhatsAppOptions,
  uploadCustomCakeRequestImage,
} from '../controllers/customCakeController.js'
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/authMiddleware.js'
import {
  customCakeImageUpload,
  validateCustomCakeImageFile,
} from '../middleware/customCakeImageUpload.js'
import { validateBody, validateQuery } from '../middleware/validateRequest.js'
import {
  customCakeQuerySchema,
  customCakeQuoteSchema,
  customCakeRejectSchema,
  customCakeRequestCreateSchema,
} from '../validators/customCakeSchemas.js'

export const customCakeRouter = Router()

customCakeRouter.get('/:id/payment/:token', getCakePayment)
customCakeRouter.post('/:id/payment/:token/proofs', paymentProofRateLimit, paymentProofUpload.single('file'), validatePaymentProof, submitCakeProof)

customCakeRouter.post(
  '/',
  optionalAuthenticate,
  validateBody(customCakeRequestCreateSchema),
  createCustomCakeRequest,
)
customCakeRouter.post(
  '/:id/images',
  optionalAuthenticate,
  customCakeImageUpload.single('file'),
  validateCustomCakeImageFile,
  uploadCustomCakeRequestImage,
)
customCakeRouter.get(
  '/',
  authenticate,
  authorizeRoles('admin'),
  validateQuery(customCakeQuerySchema),
  listCustomCakeRequests,
)
customCakeRouter.get('/:id', authenticate, authorizeRoles('admin'), getCustomCakeRequest)
customCakeRouter.get('/:id/payment-link', authenticate, authorizeRoles('admin'), getCakePaymentLink)
customCakeRouter.post('/:id/payment-link/rotate', authenticate, authorizeRoles('admin'), revokeCakePaymentLink)
customCakeRouter.get(
  '/:id/whatsapp-options',
  authenticate,
  authorizeRoles('admin'),
  getCustomCakeWhatsAppOptions,
)
customCakeRouter.post(
  '/:id/quote',
  authenticate,
  authorizeRoles('admin'),
  validateBody(customCakeQuoteSchema),
  quoteCustomCakeRequest,
)
customCakeRouter.post(
  '/:id/reject',
  authenticate,
  authorizeRoles('admin'),
  validateBody(customCakeRejectSchema),
  rejectCustomCakeRequest,
)
customCakeRouter.post(
  '/:id/cancel',
  authenticate,
  authorizeRoles('admin'),
  cancelCustomCakeRequest,
)
