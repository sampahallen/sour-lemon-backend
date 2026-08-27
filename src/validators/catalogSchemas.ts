import { z } from 'zod'

const uuid = z.string().uuid()
const slug = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional()
const optionalDate = z.union([z.coerce.date(), z.null()]).optional()

export const categoryQuerySchema = z
  .object({ siteSectionId: uuid.optional(), sectionKey: z.string().trim().min(1).max(60).optional() })
  .strict()

export const categoryCreateSchema = z
  .object({
    siteSectionId: uuid,
    name: z.string().trim().min(1).max(100),
    slug: slug.max(120).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update')

const productFields = z.object({
  categoryId: uuid,
  name: z.string().trim().min(1).max(160),
  slug: slug.optional(),
  description: nullableText(5_000),
  price: z.coerce.number().finite().min(0).max(999_999_999.99),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  isActive: z.boolean().optional(),
  availableFrom: optionalDate,
  availableUntil: optionalDate,
})

const validAvailability = (input: { availableFrom?: Date | null; availableUntil?: Date | null }) =>
  !input.availableFrom || !input.availableUntil || input.availableUntil > input.availableFrom

export const productCreateSchema = productFields
  .strict()
  .refine(validAvailability, 'Available until must be later than available from')

export const productUpdateSchema = productFields
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update')
  .refine(validAvailability, 'Available until must be later than available from')

export const adminProductQuerySchema = z
  .object({ categoryId: uuid.optional(), includeInactive: z.coerce.boolean().default(false) })
  .strict()

export const publicProductQuerySchema = z
  .object({
    category: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

export const productImageSchema = z
  .object({ altText: z.string().trim().min(1).max(255) })
  .strict()

export const productImageReorderSchema = z
  .object({ imageIds: z.array(uuid).min(1).max(20).refine((ids) => new Set(ids).size === ids.length) })
  .strict()

export type CategoryQuery = z.infer<typeof categoryQuerySchema>
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>
export type ProductCreateInput = z.infer<typeof productCreateSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>
export type PublicProductQuery = z.infer<typeof publicProductQuerySchema>
export type ProductImageInput = z.infer<typeof productImageSchema>
export type ProductImageReorderInput = z.infer<typeof productImageReorderSchema>
