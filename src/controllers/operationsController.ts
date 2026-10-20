import { Op } from 'sequelize'
import { CustomCakeRequest } from '../models/CustomCakeRequest.js'
import { Order } from '../models/Order.js'
import { Payment } from '../models/Payment.js'
import { PaymentProof } from '../models/PaymentProof.js'
import { countActionableOrders } from '../services/operationsSummary.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const getOperationsSummary = asyncHandler(async (_request, response) => {
  const [orders, proofs, cakes] = await Promise.all([
    Order.findAll({
      where: { status: { [Op.notIn]: ['completed', 'cancelled'] } },
      attributes: ['id', 'status', 'fulfillmentType'],
    }),
    PaymentProof.count({ where: { status: 'submitted' } }),
    CustomCakeRequest.count({ where: { status: 'submitted' } }),
  ])
  const payments = orders.length ? await Payment.findAll({
    where: { orderId: { [Op.in]: orders.map((order) => order.id) } },
    attributes: ['orderId', 'provider', 'status', 'requiresManualConfirmation', 'adminConfirmedAt', 'createdAt'],
    order: [['createdAt', 'DESC']],
  }) : []
  response.json({ orders: countActionableOrders(orders, payments), proofs, cakes })
})
