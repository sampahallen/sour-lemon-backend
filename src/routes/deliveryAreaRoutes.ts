import { Router } from 'express'
import { listDeliveryAreas } from '../controllers/deliveryAreaController.js'

export const deliveryAreaRouter = Router()

deliveryAreaRouter.get('/', listDeliveryAreas)
