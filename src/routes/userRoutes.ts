import { Router } from 'express'
import {
  deleteCurrentUser,
  getCurrentUser,
  getAllUsers,
  updateCurrentUser,
} from '../controllers/userController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { validateBody, validateQuery } from '../middleware/validateRequest.js'
import {
  deleteUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from '../validators/authSchemas.js'

export const userRouter = Router()

userRouter.use(authenticate)
userRouter.get('/me', getCurrentUser)
userRouter.patch('/me', validateBody(updateUserSchema), updateCurrentUser)
userRouter.delete('/me', validateBody(deleteUserSchema), deleteCurrentUser)
userRouter.get('/', authorizeRoles('admin'), validateQuery(userListQuerySchema), getAllUsers)
