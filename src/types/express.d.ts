import { UserRole } from '../models/types.js'
import type { Cart } from '../models/Cart.js'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        role: UserRole
      }
      cartContext?: {
        cart: Cart | null
        isGuest: boolean
        guestTokenHash?: string
        guestExpiresAt?: Date
      }
      validatedBody?: unknown
      validatedQuery?: unknown
    }
  }
}

export {}
