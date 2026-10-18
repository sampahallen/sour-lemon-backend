import { Router } from 'express'
import { getPublicSettings } from '../controllers/publicSettingsController.js'
import { noStore } from '../middleware/cacheControl.js'

export const publicSettingsRouter = Router()

publicSettingsRouter.get('/', noStore, getPublicSettings)
