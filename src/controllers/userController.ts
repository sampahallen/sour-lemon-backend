import bcrypt from 'bcrypt'
import { getBcryptRounds } from '../config/auth.js'
import { sequelize } from '../config/database.js'
import { Address } from '../models/Address.js'
import { AuthSession } from '../models/AuthSession.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { toUserResponse } from '../utils/userResponse.js'
import {
  DeleteUserInput,
  UpdateUserInput,
  UserListQuery,
} from '../validators/authSchemas.js'

const authenticatedUser = async (userId: string) => {
  const user = await User.findOne({
    where: { id: userId, isActive: true, isDeleted: false },
  })
  if (!user) throw new HttpError(401, 'Authentication required')
  return user
}

export const updateCurrentUser = asyncHandler(async (request, response) => {
  const input = request.validatedBody as UpdateUserInput
  const user = await authenticatedUser(request.auth!.userId)

  if (input.newPassword) {
    const passwordMatches = await bcrypt.compare(input.currentPassword!, user.passwordHash)
    if (!passwordMatches) throw new HttpError(400, 'Current password is incorrect')
    user.passwordHash = await bcrypt.hash(input.newPassword, getBcryptRounds())
  }

  if (input.name !== undefined) user.name = input.name
  if (input.phoneNumber !== undefined) user.phoneNumber = input.phoneNumber
  if (input.whatsappNumber !== undefined) user.whatsappNumber = input.whatsappNumber

  await user.save()
  response.json({ user: toUserResponse(user) })
})

export const deleteCurrentUser = asyncHandler(async (request, response) => {
  const input = request.validatedBody as DeleteUserInput
  const user = await authenticatedUser(request.auth!.userId)

  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(400, 'Password is incorrect')
  }

  await sequelize.transaction(async (transaction) => {
    await Address.update({ isDeleted: true }, { where: { userId: user.id }, transaction })
    await AuthSession.update({ isDeleted: true }, { where: { userId: user.id }, transaction })
    await user.update({ isDeleted: true }, { transaction })
  })

  response.status(204).send()
})

export const getAllUsers = asyncHandler(async (request, response) => {
  const { page, limit } = request.validatedQuery as UserListQuery
  const { count, rows } = await User.findAndCountAll({
    attributes: { exclude: ['passwordHash'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  })

  response.json({
    users: rows.map(toUserResponse),
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  })
})
