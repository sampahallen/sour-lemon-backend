import { Router } from 'express'
import {
  addCartItem,
  deleteCartItem,
  getCart,
  updateCartItem,
} from '../controllers/cartController.js'
import { optionalAuthenticate } from '../middleware/authMiddleware.js'
import { identifyCart } from '../middleware/cartMiddleware.js'
import { validateBody } from '../middleware/validateRequest.js'
import { cartAddItemSchema, cartUpdateItemSchema } from '../validators/cartSchemas.js'

export const cartRouter = Router()

cartRouter.use(optionalAuthenticate, identifyCart)
cartRouter.get('/', getCart)
cartRouter.post('/items', validateBody(cartAddItemSchema), addCartItem)
cartRouter.patch('/items/:productId', validateBody(cartUpdateItemSchema), updateCartItem)
cartRouter.delete('/items/:productId', deleteCartItem)
