import { createHmac, timingSafeEqual } from 'node:crypto'
import { AppSetting } from '../models/AppSetting.js'
import { PaymentProof } from '../models/PaymentProof.js'
import { CustomCakeRequest } from '../models/CustomCakeRequest.js'
import { getAppOrigin, getJwtSecret } from '../config/auth.js'
import { HttpError } from '../utils/HttpError.js'

export const getMomoDetails = async () => {
  const settings = await AppSetting.findAll({ where: { key: ['momo_payment_number', 'momo_recipient_name', 'momo_network'] } })
  const values = new Map(settings.map((setting) => [setting.key, setting.value]))
  const number = values.get('momo_payment_number')
  const recipientName = values.get('momo_recipient_name')
  const network = values.get('momo_network')
  if (typeof number !== 'string' || typeof recipientName !== 'string' || typeof network !== 'string' ||
    !number.trim() || !recipientName.trim() || !network.trim()) throw new HttpError(503, 'Mobile Money payment is not configured')
  return { number, recipientName, network }
}

export interface ProofResponse {
  id: string
  reference: string | null
  hasImage: boolean
  status: 'submitted' | 'rejected' | 'confirmed'
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string
}

export const proofResponse = (proof: PaymentProof): ProofResponse => ({
  id: proof.id,
  reference: proof.reference,
  hasImage: !!proof.storageKey,
  status: proof.status,
  rejectionReason: proof.rejectionReason,
  reviewedAt: proof.reviewedAt?.toISOString() ?? null,
  createdAt: proof.createdAt.toISOString(),
})

const cakeSignature = (request: CustomCakeRequest) => createHmac('sha256', getJwtSecret())
  .update(`cake-payment:${request.id}:${request.paymentLinkNonce}`)
  .digest('hex')

export const cakePaymentUrl = (request: CustomCakeRequest) => request.paymentLinkNonce
  ? `${getAppOrigin('customer')}/custom-cake/payment/${request.id}/${cakeSignature(request)}`
  : null

export const requireCakePaymentLink = (request: CustomCakeRequest, token: string) => {
  if (!request.paymentLinkNonce || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, 'Payment link not found')
  const expected = Buffer.from(cakeSignature(request), 'hex')
  if (!timingSafeEqual(expected, Buffer.from(token, 'hex'))) throw new HttpError(404, 'Payment link not found')
}
