import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { HttpError } from '../utils/HttpError.js'

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const client = new S3Client({ region: process.env.AWS_REGION })
const bucket = () => {
  const value = process.env.AWS_S3_PAYMENT_PROOF_BUCKET?.trim()
  if (!value) throw new HttpError(503, 'Private payment proof storage is not configured')
  return value
}

export const savePaymentProofImage = async (file: Express.Multer.File) => {
  const storageKey = `payment-proofs/${randomUUID()}.${extensions[file.mimetype]}`
  await client.send(new PutObjectCommand({
    Bucket: bucket(), Key: storageKey, Body: file.buffer, ContentType: file.mimetype,
    ContentLength: file.size, CacheControl: 'private, no-store',
  }))
  return storageKey
}

export const deletePaymentProofImage = async (storageKey: string) => {
  await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }))
}

export const readPaymentProofImage = async (storageKey: string) => {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: storageKey }))
  if (!(result.Body instanceof Readable)) throw new HttpError(404, 'Proof image not found')
  return result.Body
}
