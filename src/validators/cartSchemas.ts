import { z } from 'zod'

export const cartAddItemSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(99),
  })
  .strict()

export const cartUpdateItemSchema = z
  .object({
    quantity: z.coerce.number().int().min(1).max(99),
  })
  .strict()

export type CartAddItemInput = z.infer<typeof cartAddItemSchema>
export type CartUpdateItemInput = z.infer<typeof cartUpdateItemSchema>
