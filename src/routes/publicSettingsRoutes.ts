import { Router } from 'express'
import { getPublicSettings } from '../controllers/publicSettingsController.js'
import { publicCache } from '../middleware/cacheControl.js'

export const publicSettingsRouter = Router()

publicSettingsRouter.get('/', publicCache('standard'), getPublicSettings)
