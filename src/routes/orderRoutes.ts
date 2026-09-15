import { Router } from 'express'
import {
  collectOrderCash,
  confirmOrderPayment,
  getAdminOrder,
  getOrderReceiptController,
  groupedOrders,
  listOrders,
  listCustomerOrders,
  orderWorkspace,
  getOrderWhatsAppOptions,
  updateOrderStatus,
} from '../controllers/orderController.js'
import { resumeOrRetryPayment } from '../controllers/paymentController.js'
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/authMiddleware.js'
import { validateBody, validateQuery } from '../middleware/validateRequest.js'
import {
  groupedOrdersQuerySchema,
  customerOrderListQuerySchema,
  orderListQuerySchema,
  orderStatusUpdateSchema,
} from '../validators/checkoutSchemas.js'

export const orderRouter = Router()

orderRouter.get(
  '/mine',
  authenticate,
  authorizeRoles('customer'),
  validateQuery(customerOrderListQuerySchema),
  listCustomerOrders,
)
orderRouter.get('/:id/receipt', optionalAuthenticate, getOrderReceiptController)
orderRouter.post('/:orderId/payments', optionalAuthenticate, resumeOrRetryPayment)

orderRouter.use(authenticate, authorizeRoles('admin'))
orderRouter.get('/grouped-by-delivery-area', validateQuery(groupedOrdersQuerySchema), groupedOrders)
orderRouter.get('/workspace', orderWorkspace)
orderRouter.get('/', validateQuery(orderListQuerySchema), listOrders)
orderRouter.get('/:id', getAdminOrder)
orderRouter.get('/:id/whatsapp-options', getOrderWhatsAppOptions)
orderRouter.patch('/:id/status', validateBody(orderStatusUpdateSchema), updateOrderStatus)
orderRouter.post('/:id/confirm-payment', confirmOrderPayment)
orderRouter.post('/:id/collect-cash', collectOrderCash)
