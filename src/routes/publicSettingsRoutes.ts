import { Router } from 'express'
import { getPublicSettings } from '../controllers/publicSettingsController.js'

export const publicSettingsRouter = Router()

publicSettingsRouter.get('/', getPublicSettings)
