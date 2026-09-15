import { Router } from 'express'
import { createCheckout, quoteCheckout } from '../controllers/checkoutController.js'
import { optionalAuthenticate } from '../middleware/authMiddleware.js'
import { identifyCart } from '../middleware/cartMiddleware.js'
import { validateBody } from '../middleware/validateRequest.js'
import { checkoutQuoteSchema, checkoutSchema } from '../validators/checkoutSchemas.js'

export const checkoutRouter = Router()

checkoutRouter.use(optionalAuthenticate, identifyCart)
checkoutRouter.post('/quote', validateBody(checkoutQuoteSchema), quoteCheckout)
checkoutRouter.post('/', validateBody(checkoutSchema), createCheckout)
