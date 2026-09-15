import { createHmac, timingSafeEqual } from 'node:crypto'
import { HttpError } from '../utils/HttpError.js'

const PAYSTACK_API_URL = 'https://api.paystack.co'

const secretKey = () => {
  const value = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!value) throw new HttpError(503, 'Online payment is not configured')
  return value
}

const paystackRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${PAYSTACK_API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    throw new HttpError(502, 'Could not reach the payment provider')
  }

  const body = await response.json().catch(() => null) as T | null
  if (!response.ok || !body) {
    throw new HttpError(502, 'The payment provider could not process this request')
  }
  return body
}

interface InitializeResponse {
  status: boolean
  message: string
  data?: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export interface VerifiedTransaction {
  status: string
  reference: string
  amount: number
  currency: string
  channel: string
  paid_at: string | null
  gateway_response?: string | null
  id?: number
}

interface VerifyResponse {
  status: boolean
  message: string
  data?: VerifiedTransaction
}

export const initializePaystackTransaction = async (input: {
  email: string
  amountCents: number
  currency: string
  reference: string
  method: 'card' | 'momo'
  paymentName: string
  orderId: string
  orderNumber: string
}) => {
  const result = await paystackRequest<InitializeResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountCents),
      currency: input.currency,
      reference: input.reference,
      channels: [input.method === 'momo' ? 'mobile_money' : 'card'],
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        paymentName: input.paymentName,
      },
    }),
  })
  if (!result.status || !result.data) {
    throw new HttpError(502, result.message || 'Could not initialize payment')
  }
  return {
    checkoutUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    reference: result.data.reference,
  }
}

export const verifyPaystackTransaction = async (reference: string) => {
  const result = await paystackRequest<VerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  )
  if (!result.status || !result.data) {
    throw new HttpError(502, result.message || 'Could not verify payment')
  }
  return result.data
}

export const hasValidPaystackSignature = (rawBody: Buffer, signature: string | undefined) => {
  if (!signature) return false
  const expected = createHmac('sha512', secretKey()).update(rawBody).digest('hex')
  const actualBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}
