import { RequestHandler } from 'express'
import multer from 'multer'
import { HttpError } from '../utils/HttpError.js'

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = Number(process.env.PRODUCT_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024)

if (!Number.isSafeInteger(maxImageBytes) || maxImageBytes <= 0) {
  throw new Error('PRODUCT_IMAGE_MAX_BYTES must be a positive integer')
}

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: maxImageBytes },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new HttpError(400, 'Only JPEG, PNG, and WebP images are supported'))
      return
    }
    callback(null, true)
  },
})

const hasExpectedSignature = (file: Express.Multer.File) => {
  const bytes = file.buffer
  if (file.mimetype === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (file.mimetype === 'image/png') {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (file.mimetype === 'image/webp') {
    return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  }
  return false
}

export const validateProductImageFile: RequestHandler = (request, _response, next) => {
  if (!request.file) {
    next(new HttpError(400, 'Choose an image to upload'))
    return
  }
  if (!hasExpectedSignature(request.file)) {
    next(new HttpError(400, 'The uploaded file content does not match its image type'))
    return
  }
  next()
}
