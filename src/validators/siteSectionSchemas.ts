import { z } from 'zod'

export const siteSectionUpdateSchema = z
  .object({
    isEnabled: z.boolean(),
    showComingSoon: z.boolean(),
  })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update')

export type SiteSectionUpdateInput = z.infer<typeof siteSectionUpdateSchema>
