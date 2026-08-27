import { User } from '../models/User.js'
import { UserRole } from '../models/types.js'

export interface UserResponse {
  id: string
  name: string
  phoneNumber: string
  whatsappNumber: string | null
  role: UserRole
  isActive: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

export const toUserResponse = (user: User): UserResponse => ({
  id: user.id,
  name: user.name,
  phoneNumber: user.phoneNumber,
  whatsappNumber: user.whatsappNumber,
  role: user.role,
  isActive: user.isActive,
  isDeleted: user.isDeleted,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})
