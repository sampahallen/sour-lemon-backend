import { DeliveryArea } from '../models/DeliveryArea.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const toDeliveryAreaResponse = (deliveryArea: DeliveryArea) => ({
  id: deliveryArea.id,
  name: deliveryArea.name,
  slug: deliveryArea.slug,
  deliveryFee: deliveryArea.deliveryFee,
})

export const listDeliveryAreas = asyncHandler(async (_request, response) => {
  const deliveryAreas = await DeliveryArea.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC']],
  })
  response.json({ deliveryAreas: deliveryAreas.map(toDeliveryAreaResponse) })
})
