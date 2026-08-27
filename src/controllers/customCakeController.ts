import { deleteCustomCakeImageObject, uploadCustomCakeImage } from '../config/storage.js'
import { CustomCakeImage } from '../models/CustomCakeImage.js'
import { CustomCakeRequest } from '../models/CustomCakeRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import type {
  CustomCakeQuery,
  CustomCakeQuoteInput,
  CustomCakeRejectInput,
  CustomCakeRequestCreateInput,
} from '../validators/customCakeSchemas.js'

const toCustomCakeRequestSummary = (customCakeRequest: CustomCakeRequest) => ({
  id: customCakeRequest.id,
  customerName: customCakeRequest.customerName,
  phoneNumber: customCakeRequest.phoneNumber,
  whatsappNumber: customCakeRequest.whatsappNumber,
  occasion: customCakeRequest.occasion,
  requestedSize: customCakeRequest.requestedSize,
  status: customCakeRequest.status,
  quotedAmount: customCakeRequest.quotedAmount,
  currency: customCakeRequest.currency,
  quotedAt: customCakeRequest.quotedAt?.toISOString() ?? null,
  quoteExpiresAt: customCakeRequest.quoteExpiresAt?.toISOString() ?? null,
  createdAt: customCakeRequest.createdAt.toISOString(),
})

const toCustomCakeImageResponse = (image: CustomCakeImage) => ({
  id: image.id,
  url: image.url,
  storageKey: image.storageKey,
  createdAt: image.createdAt.toISOString(),
})

const toCustomCakeRequestDetail = (
  customCakeRequest: CustomCakeRequest,
  images: CustomCakeImage[],
) => ({
  ...toCustomCakeRequestSummary(customCakeRequest),
  notes: customCakeRequest.notes,
  images: images.map(toCustomCakeImageResponse),
  orderId: customCakeRequest.orderId,
})

const requireCustomCakeRequest = async (id: string) => {
  const customCakeRequest = await CustomCakeRequest.findByPk(id)
  if (!customCakeRequest) throw new HttpError(404, 'Custom cake request not found')
  return customCakeRequest
}

const customCakeRequestDetail = async (customCakeRequest: CustomCakeRequest) => {
  const images = await CustomCakeImage.findAll({
    where: { customCakeRequestId: customCakeRequest.id },
    order: [['createdAt', 'ASC']],
  })
  return toCustomCakeRequestDetail(customCakeRequest, images)
}

export const createCustomCakeRequest = asyncHandler(async (request, response) => {
  const input = request.validatedBody as CustomCakeRequestCreateInput
  const customCakeRequest = await CustomCakeRequest.create({
    userId: request.auth?.userId ?? null,
    orderId: null,
    customerName: input.customerName,
    phoneNumber: input.phoneNumber,
    whatsappNumber: input.whatsappNumber ?? null,
    occasion: input.occasion,
    requestedSize: input.requestedSize,
    notes: input.notes ?? null,
    status: 'submitted',
    quotedAmount: null,
    quotedByUserId: null,
    quotedAt: null,
    quoteExpiresAt: null,
  })
  response.status(201).json({ request: toCustomCakeRequestDetail(customCakeRequest, []) })
})

export const uploadCustomCakeRequestImage = asyncHandler(async (request, response) => {
  const customCakeRequest = await requireCustomCakeRequest(request.params.id)
  const uploaded = await uploadCustomCakeImage(customCakeRequest.id, request.file!)
  try {
    const image = await CustomCakeImage.create({
      customCakeRequestId: customCakeRequest.id,
      url: uploaded.url,
      storageKey: uploaded.storageKey,
    })
    response.status(201).json({ image: toCustomCakeImageResponse(image) })
  } catch (error) {
    await deleteCustomCakeImageObject(uploaded.storageKey).catch(() => undefined)
    throw error
  }
})

export const listCustomCakeRequests = asyncHandler(async (request, response) => {
  const { status, page, limit } = request.validatedQuery as CustomCakeQuery
  const { count, rows } = await CustomCakeRequest.findAndCountAll({
    where: { ...(status ? { status } : {}) },
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  })

  response.json({
    requests: rows.map(toCustomCakeRequestSummary),
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  })
})

export const getCustomCakeRequest = asyncHandler(async (request, response) => {
  const customCakeRequest = await requireCustomCakeRequest(request.params.id)
  response.json({ request: await customCakeRequestDetail(customCakeRequest) })
})

export const quoteCustomCakeRequest = asyncHandler(async (request, response) => {
  const input = request.validatedBody as CustomCakeQuoteInput
  const customCakeRequest = await requireCustomCakeRequest(request.params.id)
  customCakeRequest.status = 'quoted'
  customCakeRequest.quotedAmount = input.quotedAmount.toFixed(2)
  customCakeRequest.quotedAt = new Date()
  customCakeRequest.quotedByUserId = request.auth!.userId
  customCakeRequest.quoteExpiresAt = input.quoteExpiresAt ?? null
  await customCakeRequest.save()
  response.json({ request: await customCakeRequestDetail(customCakeRequest) })
})

export const rejectCustomCakeRequest = asyncHandler(async (request, response) => {
  const { note } = request.validatedBody as CustomCakeRejectInput
  const customCakeRequest = await requireCustomCakeRequest(request.params.id)
  customCakeRequest.status = 'rejected'
  if (note) customCakeRequest.notes = `${customCakeRequest.notes ?? ''}\n\n[Rejected] ${note}`
  await customCakeRequest.save()
  response.json({ request: await customCakeRequestDetail(customCakeRequest) })
})

export const cancelCustomCakeRequest = asyncHandler(async (request, response) => {
  const customCakeRequest = await requireCustomCakeRequest(request.params.id)
  customCakeRequest.status = 'cancelled'
  await customCakeRequest.save()
  response.json({ request: await customCakeRequestDetail(customCakeRequest) })
})

export const sendCustomCakePaymentLink = asyncHandler(async (request, response) => {
  const customCakeRequest = await requireCustomCakeRequest(request.params.id)
  const paymentLink = `https://pay.sourlemon.example/checkout/${customCakeRequest.id}`
  const message = `Hi ${customCakeRequest.customerName}! Your custom cake quote is ${customCakeRequest.currency} ${customCakeRequest.quotedAmount}. Pay here to confirm: ${paymentLink}`
  const whatsappPhone = (customCakeRequest.whatsappNumber ?? customCakeRequest.phoneNumber).replace(
    /\D/g,
    '',
  )
  const whatsappLink = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
  response.json({ whatsappLink, message, paymentLink })
})
