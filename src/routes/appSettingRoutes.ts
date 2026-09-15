import { Router } from 'express'
import { listAppSettings, updateAppSettings } from '../controllers/appSettingController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { validateBody } from '../middleware/validateRequest.js'
import { appSettingsUpdateSchema } from '../validators/appSettingSchemas.js'

export const appSettingRouter = Router()

appSettingRouter.use(authenticate, authorizeRoles('admin'))
appSettingRouter.get('/', listAppSettings)
appSettingRouter.patch('/', validateBody(appSettingsUpdateSchema), updateAppSettings)
