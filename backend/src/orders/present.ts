import { Order, OrderItem, Prisma, User } from '@prisma/client';

export const orderInclude = {
  items: true,
  user: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Order & { items: OrderItem[]; user: User };

export function presentOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    tableNumber: order.tableNumber,
    addressSnapshot: order.addressSnapshot,
    customerNote: order.customerNote,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    packagingFee: order.packagingFee,
    discountAmount: order.discountAmount ?? 0,
    discountCode: order.discountCode ?? null,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    cancelReason: order.cancelReason,
    estimatedMinutes: order.estimatedMinutes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    user: { id: order.user.id, phone: order.user.phone, name: order.user.name },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      options: item.optionsSnapshot,
      note: item.note,
      lineTotal: item.lineTotal,
    })),
  };
}

export type PresentedOrder = ReturnType<typeof presentOrder>;
