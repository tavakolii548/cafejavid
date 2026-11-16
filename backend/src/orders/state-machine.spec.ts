import { canTransition, customerCanCancel } from './state-machine';

describe('order state machine', () => {
  it('allows the delivery path and blocks skips', () => {
    expect(canTransition('NEW', 'PREPARING', 'DELIVERY')).toBe(true);
    expect(canTransition('PREPARING', 'READY', 'DELIVERY')).toBe(true);
    expect(canTransition('READY', 'OUT_FOR_DELIVERY', 'DELIVERY')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY')).toBe(true);
    expect(canTransition('NEW', 'READY', 'DELIVERY')).toBe(false);
    expect(canTransition('READY', 'DELIVERED', 'DELIVERY')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED', 'DELIVERY')).toBe(false);
  });

  it('delivers pickup and dine-in from READY and allows cancel before delivery', () => {
    expect(canTransition('READY', 'DELIVERED', 'PICKUP')).toBe(true);
    expect(canTransition('READY', 'DELIVERED', 'DINE_IN')).toBe(true);
    expect(canTransition('READY', 'OUT_FOR_DELIVERY', 'PICKUP')).toBe(false);
    expect(canTransition('NEW', 'CANCELLED', 'PICKUP')).toBe(true);
    expect(canTransition('READY', 'CANCELLED', 'DINE_IN')).toBe(true);
    expect(customerCanCancel('NEW')).toBe(true);
    expect(customerCanCancel('PREPARING')).toBe(false);
  });
});
