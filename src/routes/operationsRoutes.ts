import { Router } from 'express'
import { getOperationsSummary } from '../controllers/operationsController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'

export const operationsRouter = Router()

operationsRouter.use(authenticate, authorizeRoles('admin'))
operationsRouter.get('/summary', getOperationsSummary)
