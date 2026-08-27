import { Router } from 'express'
import { refresh, signIn, signOut, signUp } from '../controllers/authController.js'
import { validateBody } from '../middleware/validateRequest.js'
import { signInSchema, signUpSchema } from '../validators/authSchemas.js'

export const authRouter = Router()

authRouter.post('/signup', validateBody(signUpSchema), signUp)
authRouter.post('/signin', validateBody(signInSchema), signIn)
authRouter.post('/refresh', refresh)
authRouter.post('/signout', signOut)
