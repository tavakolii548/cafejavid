export type OrderStatus =
  | 'NEW'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type Fulfillment = 'DELIVERY' | 'PICKUP' | 'DINE_IN';

export function canTransition(from: OrderStatus, to: OrderStatus, fulfillment: Fulfillment): boolean {
  if (to === from) return false;
  if (from === 'NEW' && (to === 'PREPARING' || to === 'CANCELLED')) return true;
  if (from === 'PREPARING' && (to === 'READY' || to === 'CANCELLED')) return true;
  if (from === 'READY' && to === 'CANCELLED') return true;
  if (from === 'READY' && fulfillment === 'DELIVERY' && to === 'OUT_FOR_DELIVERY') return true;
  if (from === 'READY' && fulfillment !== 'DELIVERY' && to === 'DELIVERED') return true;
  if (from === 'OUT_FOR_DELIVERY' && to === 'DELIVERED') return true;
  return false;
}

export function customerCanCancel(status: OrderStatus): boolean {
  return status === 'NEW';
}
