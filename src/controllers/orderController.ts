import { literal, Op, Transaction, where as sequelizeWhere } from 'sequelize'
import { sequelize } from '../config/database.js'
import { DeliveryArea } from '../models/DeliveryArea.js'
import { Order } from '../models/Order.js'
import { OrderItem } from '../models/OrderItem.js'
import { OrderStatusHistory } from '../models/OrderStatusHistory.js'
import { Payment } from '../models/Payment.js'
import { AppSetting } from '../models/AppSetting.js'
import { getOrderReceipt, requireOrderAccess } from '../services/orderService.js'
import { publishOrderChanged } from '../services/orderEvents.js'
import {
  getAllowedOrderTransitions,
  getAvailableOrderActions,
  paymentGroup,
  paymentDisplayStatus,
} from '../services/orderWorkflow.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { buildOrderWhatsAppOptions } from '../services/whatsappComposerService.js'
import type {
  CustomerOrderListQuery,
  GroupedOrdersQuery,
  OrderListQuery,
  OrderStatusUpdateInput,
} from '../validators/checkoutSchemas.js'

const deliveryAreaInclude = {
  model: DeliveryArea,
  as: 'deliveryArea',
  required: false,
  attributes: ['id', 'name'],
}

const latestPaymentGroupSql = literal(`COALESCE((
  SELECT CASE
    WHEN latest_payment.status IN ('pending', 'cash_due') THEN 'pending'
    WHEN latest_payment.status = 'failed' THEN 'needs_attention'
    WHEN latest_payment.status = 'paid'
      AND latest_payment.requires_manual_confirmation = TRUE
      AND latest_payment.admin_confirmed_at IS NULL THEN 'needs_attention'
    WHEN latest_payment.status IN ('paid', 'cash_collected') THEN 'paid'
    WHEN latest_payment.status = 'refunded' THEN 'refunded'
    ELSE 'pending'
  END
  FROM payments AS latest_payment
  WHERE latest_payment.order_id = "Order"."id"
    AND latest_payment.is_deleted = FALSE
  ORDER BY latest_payment.created_at DESC
  LIMIT 1
), 'pending')`)

const latestPayment = (orderId: string, transaction?: Transaction, lock = false) =>
  Payment.findOne({
    where: { orderId },
    order: [['createdAt', 'DESC']],
    transaction,
    ...(transaction && lock ? { lock: transaction.LOCK.UPDATE } : {}),
  })

const paymentSummary = (payment: Payment | null) => payment ? {
  id: payment.id,
  provider: payment.provider,
  method: payment.method,
  paymentName: payment.paymentName,
  status: payment.status,
  displayStatus: paymentDisplayStatus(payment),
  checkoutUrl: payment.checkoutUrl,
  amount: payment.amount,
  requiresManualConfirmation: payment.requiresManualConfirmation,
  adminConfirmedAt: payment.adminConfirmedAt,
  adminConfirmedByUserId: payment.adminConfirmedByUserId,
  paidAt: payment.paidAt,
} : null

const orderSummary = (order: Order, payment: Payment | null = null) => {
  const raw = order.toJSON() as unknown as Record<string, unknown>
  const area = raw.deliveryArea as Record<string, unknown> | null | undefined
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentDisplayStatus: paymentDisplayStatus(payment),
    paymentGroup: paymentGroup(payment),
    fulfillmentType: order.fulfillmentType,
    customerName: order.customerName,
    phoneNumber: order.phoneNumber,
    whatsappNumber: order.whatsappNumber,
    deliveryAreaId: order.deliveryAreaId,
    deliveryAreaName: area ? String(area.name) : null,
    total: order.total,
    currency: order.currency,
    placedAt: order.placedAt,
    createdAt: order.createdAt,
    availableActions: getAvailableOrderActions(order, payment),
  }
}

const adminOrderDetail = async (order: Order) => {
  const [receipt, history, payment] = await Promise.all([
    getOrderReceipt(order),
    OrderStatusHistory.findAll({ where: { orderId: order.id }, order: [['createdAt', 'ASC']] }),
    latestPayment(order.id),
  ])
  return {
    ...orderSummary(order, payment),
    ...receipt,
    paymentStatus: order.paymentStatus,
    paymentDisplayStatus: paymentDisplayStatus(payment),
    allowedTransitions: getAllowedOrderTransitions(order, payment),
    availableActions: getAvailableOrderActions(order, payment),
    statusHistory: history.map((entry) => ({
      toStatus: entry.toStatus,
      fromStatus: entry.fromStatus,
      note: entry.note,
      createdAt: entry.createdAt,
    })),
    payment: paymentSummary(payment),
  }
}

const loadSummaries = async (orders: Order[]) => {
  if (orders.length === 0) return []
  const payments = await Payment.findAll({
    where: { orderId: { [Op.in]: orders.map((order) => order.id) } },
    order: [['createdAt', 'DESC']],
  })
  const byOrder = new Map<string, Payment>()
  for (const payment of payments) if (!byOrder.has(payment.orderId)) byOrder.set(payment.orderId, payment)
  return orders.map((order) => orderSummary(order, byOrder.get(order.id) ?? null))
}

const loadCustomerSummaries = async (orders: Order[]) => {
  if (orders.length === 0) return []
  const [summaries, items] = await Promise.all([
    loadSummaries(orders),
    OrderItem.findAll({
      where: { orderId: { [Op.in]: orders.map((order) => order.id) } },
      attributes: ['id', 'orderId', 'productName', 'productImageUrl', 'quantity'],
      order: [['createdAt', 'ASC']],
    }),
  ])
  const itemsByOrder = new Map<string, OrderItem[]>()
  for (const item of items) {
    const current = itemsByOrder.get(item.orderId) ?? []
    current.push(item)
    itemsByOrder.set(item.orderId, current)
  }

  return summaries.map((summary) => {
    const orderItems = itemsByOrder.get(String(summary.id)) ?? []
    return {
      ...summary,
      itemCount: orderItems.reduce((total, item) => total + item.quantity, 0),
      itemPreview: orderItems.slice(0, 3).map((item) => ({
        id: item.id,
        productName: item.productName,
        productImageUrl: item.productImageUrl,
        quantity: item.quantity,
      })),
    }
  })
}

export const listCustomerOrders = asyncHandler(async (request, response) => {
  const { scope, page, limit } = request.validatedQuery as CustomerOrderListQuery
  const { count, rows } = await Order.findAndCountAll({
    where: {
      userId: request.auth!.userId,
      ...(scope === 'active' ? { status: { [Op.notIn]: ['completed', 'cancelled'] } } : {}),
      ...(scope === 'history' ? { status: { [Op.in]: ['completed', 'cancelled'] } } : {}),
    },
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  })

  response.json({
    orders: await loadCustomerSummaries(rows),
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  })
})

export const listOrders = asyncHandler(async (request, response) => {
  const {
    scope,
    status,
    paymentStatus,
    paymentGroup: requestedPaymentGroup,
    fulfillmentType,
    deliveryAreaId,
    search,
    dateFrom,
    dateTo,
    page,
    limit,
  } = request.validatedQuery as OrderListQuery
  const where = {
    ...(scope === 'active' ? { status: { [Op.notIn]: ['completed', 'cancelled'] } } : {}),
    ...(scope === 'history' ? { status: { [Op.in]: ['completed', 'cancelled'] } } : {}),
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(requestedPaymentGroup ? {
      [Op.and]: sequelizeWhere(latestPaymentGroupSql, requestedPaymentGroup),
    } : {}),
    ...(fulfillmentType ? { fulfillmentType } : {}),
    ...(deliveryAreaId ? { deliveryAreaId } : {}),
    ...(search ? {
      [Op.or]: [
        { orderNumber: { [Op.iLike]: `%${search}%` } },
        { customerName: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } },
      ],
    } : {}),
    ...((dateFrom || dateTo) ? {
      createdAt: {
        ...(dateFrom ? { [Op.gte]: dateFrom } : {}),
        ...(dateTo ? { [Op.lte]: dateTo } : {}),
      },
    } : {}),
  }
  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [deliveryAreaInclude],
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  })
  response.json({
    orders: await loadSummaries(rows),
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  })
})

export const orderWorkspace = asyncHandler(async (_request, response) => {
  const orders = await Order.findAll({
    where: { status: { [Op.notIn]: ['completed', 'cancelled'] } },
    include: [deliveryAreaInclude],
    order: [['createdAt', 'ASC']],
  })
  const summaries = await loadSummaries(orders)
  const items = await OrderItem.findAll({
    where: { orderId: { [Op.in]: orders.map((order) => order.id) } },
    order: [['createdAt', 'ASC']],
  })
  const itemsByOrder = new Map<string, { productName: string; quantity: number }[]>()
  for (const item of items) {
    const current = itemsByOrder.get(item.orderId) ?? []
    current.push({ productName: item.productName, quantity: item.quantity })
    itemsByOrder.set(item.orderId, current)
  }

  const queues = {
    payment: [] as object[],
    received: [] as object[],
    preparing: [] as object[],
    ready: [] as object[],
    delivery: [] as object[],
  }
  for (const summary of summaries) {
    const card = { ...summary, items: itemsByOrder.get(summary.id) ?? [] }
    if (
      ['received', 'pending_payment', 'confirmed'].includes(summary.status) &&
      ['waiting_for_payment', 'needs_review', 'cash_due', 'failed'].includes(summary.paymentDisplayStatus)
    ) queues.payment.push(card)
    if (['received', 'pending_payment', 'confirmed'].includes(summary.status)) queues.received.push(card)
    else if (summary.status === 'preparing') queues.preparing.push(card)
    else if (summary.status === 'ready_for_pickup') queues.ready.push(card)
    else if (summary.status === 'out_for_delivery') queues.delivery.push(card)
  }
  response.json({
    queues,
    counts: Object.fromEntries(Object.entries(queues).map(([key, value]) => [key, value.length])),
    generatedAt: new Date(),
  })
})

export const groupedOrders = asyncHandler(async (request, response) => {
  const { status } = request.validatedQuery as GroupedOrdersQuery
  const orders = await Order.findAll({
    where: status ? { status } : {},
    include: [deliveryAreaInclude],
    order: [['createdAt', 'DESC']],
  })
  const summaries = await loadSummaries(orders)
  const groups = new Map<string, { deliveryArea: { id: string; name: string } | null; orders: typeof summaries }>()
  for (const summary of summaries) {
    const key = summary.deliveryAreaId ?? 'unassigned'
    if (!groups.has(key)) groups.set(key, {
      deliveryArea: summary.deliveryAreaId
        ? { id: summary.deliveryAreaId, name: summary.deliveryAreaName ?? 'Delivery area' }
        : null,
      orders: [],
    })
    groups.get(key)!.orders.push(summary)
  }
  response.json({ groups: [...groups.values()] })
})

export const getAdminOrder = asyncHandler(async (request, response) => {
  const order = await Order.findByPk(request.params.id, { include: [deliveryAreaInclude] })
  if (!order) throw new HttpError(404, 'Order not found')
  response.json({ order: await adminOrderDetail(order) })
})

export const updateOrderStatus = asyncHandler(async (request, response) => {
  const input = request.validatedBody as OrderStatusUpdateInput
  const order = await sequelize.transaction(async (transaction) => {
    const locked = await Order.findByPk(request.params.id, { transaction, lock: transaction.LOCK.UPDATE })
    if (!locked) throw new HttpError(404, 'Order not found')
    const payment = await latestPayment(locked.id, transaction, true)
    if (!getAllowedOrderTransitions(locked, payment).includes(input.toStatus)) {
      throw new HttpError(409, `Order cannot move from ${locked.status} to ${input.toStatus}`)
    }
    if (input.toStatus === 'cancelled' && !input.note?.trim()) {
      throw new HttpError(400, 'Add a cancellation reason')
    }
    const fromStatus = locked.status
    await locked.update({ status: input.toStatus }, { transaction })
    await OrderStatusHistory.create({
      orderId: locked.id,
      fromStatus,
      toStatus: input.toStatus,
      changedByUserId: request.auth!.userId,
      note: input.note ?? null,
    }, { transaction })
    transaction.afterCommit(() => publishOrderChanged({ orderId: locked.id, reason: 'status_updated' }))
    return locked
  })
  response.json({ order: await adminOrderDetail(order) })
})

export const confirmOrderPayment = asyncHandler(async (request, response) => {
  const order = await sequelize.transaction(async (transaction) => {
    const locked = await Order.findByPk(request.params.id, { transaction, lock: transaction.LOCK.UPDATE })
    if (!locked) throw new HttpError(404, 'Order not found')
    const payment = await latestPayment(locked.id, transaction, true)
    if (!payment || payment.provider !== 'paystack') throw new HttpError(409, 'This order has no online payment')
    if (payment.status !== 'paid') throw new HttpError(409, 'Paystack must verify this payment first')
    if (!payment.adminConfirmedAt) await payment.update({
      adminConfirmedAt: new Date(),
      adminConfirmedByUserId: request.auth!.userId,
    }, { transaction })
    transaction.afterCommit(() => publishOrderChanged({ orderId: locked.id, reason: 'payment_confirmed' }))
    return locked
  })
  response.json({ order: await adminOrderDetail(order) })
})

export const collectOrderCash = asyncHandler(async (request, response) => {
  const order = await sequelize.transaction(async (transaction) => {
    const locked = await Order.findByPk(request.params.id, { transaction, lock: transaction.LOCK.UPDATE })
    if (!locked) throw new HttpError(404, 'Order not found')
    const payment = await latestPayment(locked.id, transaction, true)
    if (!payment || payment.provider !== 'cash') throw new HttpError(409, 'This is not a cash order')
    if (payment.status !== 'cash_due' && payment.status !== 'cash_collected') {
      throw new HttpError(409, 'Cash cannot be collected for this payment')
    }
    if (payment.status === 'cash_due') {
      const collectedAt = new Date()
      await payment.update({
        status: 'cash_collected',
        paidAt: collectedAt,
        adminConfirmedAt: collectedAt,
        adminConfirmedByUserId: request.auth!.userId,
      }, { transaction })
      await locked.update({ paymentStatus: 'cash_collected' }, { transaction })
    }
    transaction.afterCommit(() => publishOrderChanged({ orderId: locked.id, reason: 'cash_collected' }))
    return locked
  })
  response.json({ order: await adminOrderDetail(order) })
})

export const getOrderReceiptController = asyncHandler(async (request, response) => {
  const order = await Order.findByPk(request.params.id)
  if (!order) throw new HttpError(404, 'Order not found')
  requireOrderAccess(request, order)
  response.json({ order: await getOrderReceipt(order) })
})

export const getOrderWhatsAppOptions = asyncHandler(async (request, response) => {
  const order = await Order.findByPk(request.params.id)
  if (!order) throw new HttpError(404, 'Order not found')
  const [payment, pickupSetting] = await Promise.all([
    latestPayment(order.id),
    AppSetting.findByPk('pickup_location'),
  ])
  const pickupLocation = typeof pickupSetting?.value === 'string' ? pickupSetting.value : null
  response.json(buildOrderWhatsAppOptions({
    customerName: order.customerName,
    phoneNumber: order.phoneNumber,
    whatsappNumber: order.whatsappNumber,
    orderNumber: order.orderNumber,
    status: order.status,
    fulfillmentType: order.fulfillmentType,
    pickupLocation,
    payment: payment ? { status: payment.status, checkoutUrl: payment.checkoutUrl } : null,
  }))
})
