import type { RequestHandler } from 'express'
import multer from 'multer'
import { rateLimit } from 'express-rate-limit'
import { HttpError } from '../utils/HttpError.js'

const types = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const paymentProofRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many payment proof submissions. Please try again later.' } })
export const paymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!types.has(file.mimetype)) return callback(new HttpError(400, 'Use a JPEG, PNG, or WebP image'))
    callback(null, true)
  },
})

export const validatePaymentProof: RequestHandler = (request, _response, next) => {
  const file = request.file
  if (!file) return next()
  const bytes = file.buffer
  const valid = file.mimetype === 'image/jpeg'
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.mimetype === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  next(valid ? undefined : new HttpError(400, 'The image content does not match its file type'))
}
