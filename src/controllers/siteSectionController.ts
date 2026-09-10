import { SiteSection } from '../models/SiteSection.js'
import type { SiteSectionUpdateInput } from '../validators/siteSectionSchemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'

const siteSectionAttributes = [
  'id',
  'key',
  'name',
  'isEnabled',
  'showComingSoon',
  'sortOrder',
]

const toSiteSectionResponse = (section: SiteSection) => ({
  id: section.id,
  key: section.key,
  name: section.name,
  isEnabled: section.isEnabled,
  showComingSoon: section.showComingSoon,
  sortOrder: section.sortOrder,
})

export const listPublicSiteSections = asyncHandler(async (_request, response) => {
  const sections = await SiteSection.findAll({
    attributes: siteSectionAttributes,
    order: [['sortOrder', 'ASC']],
  })
  response.json({ sections: sections.map(toSiteSectionResponse) })
})

export const updateSiteSection = asyncHandler(async (request, response) => {
  const input = request.validatedBody as SiteSectionUpdateInput
  const section = await SiteSection.findByPk(request.params.id, {
    attributes: siteSectionAttributes,
  })
  if (!section) throw new HttpError(404, 'Site section not found')
  if (input.isEnabled !== undefined) section.isEnabled = input.isEnabled
  if (input.showComingSoon !== undefined) section.showComingSoon = input.showComingSoon
  await section.save()
  response.json({ section: toSiteSectionResponse(section) })
})
