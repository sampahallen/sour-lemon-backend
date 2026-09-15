import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { JournalImageRole } from '../models/types.js'
import { HttpError } from '../utils/HttpError.js'

const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const requiredSetting = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new HttpError(503, `${name} is not configured`)
  return value
}

const normalizePublicBaseUrl = (value: string) => {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return new URL(withProtocol).toString().replace(/\/$/, '')
  } catch {
    throw new HttpError(503, 'AWS_S3_PUBLIC_BASE_URL must be a valid HTTP or HTTPS URL')
  }
}

const storageSettings = () => ({
  bucket: requiredSetting('AWS_S3_BUCKET'),
  region: requiredSetting('AWS_REGION'),
  publicBaseUrl: normalizePublicBaseUrl(requiredSetting('AWS_S3_PUBLIC_BASE_URL')),
})

let s3Client: S3Client | undefined

const getS3Client = (region: string) => {
  s3Client ??= new S3Client({ region })
  return s3Client
}

const publicObjectUrl = (baseUrl: string, key: string) =>
  `${baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`

export const uploadJournalImage = async (
  postId: string,
  role: JournalImageRole,
  file: Express.Multer.File,
) => {
  const settings = storageSettings()
  const extension = imageExtensions[file.mimetype]
  if (!extension) throw new HttpError(400, 'Unsupported image type')

  const storageKey = `journal/${postId}/${role}/${randomUUID()}.${extension}`
  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: storageKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return {
    storageKey,
    url: publicObjectUrl(settings.publicBaseUrl, storageKey),
  }
}

export const uploadProductImage = async (productId: string, file: Express.Multer.File) => {
  const settings = storageSettings()
  const extension = imageExtensions[file.mimetype]
  if (!extension) throw new HttpError(400, 'Unsupported image type')

  const storageKey = `products/${productId}/${randomUUID()}.${extension}`
  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: storageKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return {
    storageKey,
    url: publicObjectUrl(settings.publicBaseUrl, storageKey),
  }
}

export const uploadCustomCakeImage = async (
  customCakeRequestId: string,
  file: Express.Multer.File,
) => {
  const settings = storageSettings()
  const extension = imageExtensions[file.mimetype]
  if (!extension) throw new HttpError(400, 'Unsupported image type')

  const storageKey = `custom-cake-requests/${customCakeRequestId}/${randomUUID()}.${extension}`
  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: storageKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return {
    storageKey,
    url: publicObjectUrl(settings.publicBaseUrl, storageKey),
  }
}

export const deleteJournalImageObject = async (storageKey: string) => {
  const settings = storageSettings()
  await getS3Client(settings.region).send(
    new DeleteObjectCommand({ Bucket: settings.bucket, Key: storageKey }),
  )
}

export const deleteProductImageObject = deleteJournalImageObject
export const deleteCustomCakeImageObject = deleteJournalImageObject
