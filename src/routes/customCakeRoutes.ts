import { Router } from 'express'
import {
  cancelCustomCakeRequest,
  createCustomCakeRequest,
  getCustomCakeRequest,
  listCustomCakeRequests,
  quoteCustomCakeRequest,
  rejectCustomCakeRequest,
  sendCustomCakePaymentLink,
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
customCakeRouter.post(
  '/:id/send-payment-link',
  authenticate,
  authorizeRoles('admin'),
  sendCustomCakePaymentLink,
)
