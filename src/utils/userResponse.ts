import { User } from '../models/User.js'
import { UserRole } from '../models/types.js'

export interface UserResponse {
  id: string
  name: string
  email: string | null
  phoneNumber: string
  whatsappNumber: string | null
  role: UserRole
  roles: UserRole[]
  isActive: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

export const toUserResponse = (user: User, activeRole: UserRole = user.role): UserResponse => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  whatsappNumber: user.whatsappNumber,
  role: activeRole,
  roles: user.roles,
  isActive: user.isActive,
  isDeleted: user.isDeleted,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})
