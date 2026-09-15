import { Router } from 'express'
import {
  listPublicSiteSections,
  updateSiteSection,
} from '../controllers/siteSectionController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { validateBody } from '../middleware/validateRequest.js'
import { siteSectionUpdateSchema } from '../validators/siteSectionSchemas.js'

export const siteSectionRouter = Router()

siteSectionRouter.get('/', listPublicSiteSections)
siteSectionRouter.patch(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  validateBody(siteSectionUpdateSchema),
  updateSiteSection,
)
