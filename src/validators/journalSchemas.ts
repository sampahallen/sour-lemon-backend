import { z } from 'zod'

const optionalNullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional()
const slug = z.string().trim().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const uuid = z.string().uuid()

const journalBody = z
  .object({
    version: z.literal(1),
    blocks: z.array(z.record(z.string(), z.unknown())).max(500),
  })
  .strict()

export const journalCategoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: slug.max(120).optional(),
    description: optionalNullableText(2_000),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()

export const journalCategoryUpdateSchema = journalCategoryCreateSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update')

export const journalPostCreateSchema = z
  .object({
    categoryId: uuid,
    title: z.string().trim().min(1).max(200),
    slug: slug.optional(),
    excerpt: optionalNullableText(2_000),
    body: journalBody.optional(),
  })
  .strict()

export const journalPostUpdateSchema = journalPostCreateSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update')

export const journalPublicPostQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    category: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

export const journalAdminPostQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    categoryId: uuid.optional(),
    status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  })
  .strict()

export const journalScheduleSchema = z
  .object({ scheduledFor: z.coerce.date().refine((date) => date > new Date(), 'Choose a future date') })
  .strict()

export const journalImageSchema = z
  .object({
    role: z.enum(['cover', 'body']),
    altText: z.string().trim().min(1).max(255),
    caption: optionalNullableText(2_000),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict()

export const journalImageReorderSchema = z
  .object({ imageIds: z.array(uuid).min(1).max(100).refine((ids) => new Set(ids).size === ids.length) })
  .strict()

export type JournalCategoryCreateInput = z.infer<typeof journalCategoryCreateSchema>
export type JournalCategoryUpdateInput = z.infer<typeof journalCategoryUpdateSchema>
export type JournalPostCreateInput = z.infer<typeof journalPostCreateSchema>
export type JournalPostUpdateInput = z.infer<typeof journalPostUpdateSchema>
export type JournalPublicPostQuery = z.infer<typeof journalPublicPostQuerySchema>
export type JournalAdminPostQuery = z.infer<typeof journalAdminPostQuerySchema>
export type JournalScheduleInput = z.infer<typeof journalScheduleSchema>
export type JournalImageInput = z.infer<typeof journalImageSchema>
export type JournalImageReorderInput = z.infer<typeof journalImageReorderSchema>
