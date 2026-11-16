import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type OrderEventName = 'order.created' | 'order.updated';

export interface OrderStreamEvent {
  event: OrderEventName;
  data: unknown;
}

@Injectable()
export class OrderEventsService {
  readonly admin = new Subject<OrderStreamEvent>();
  private readonly customers = new Map<string, Subject<OrderStreamEvent>>();

  customer(orderId: string): Subject<OrderStreamEvent> {
    let subject = this.customers.get(orderId);
    if (!subject) {
      subject = new Subject<OrderStreamEvent>();
      this.customers.set(orderId, subject);
    }
    return subject;
  }

  created(data: unknown) {
    this.admin.next({ event: 'order.created', data });
  }

  updated(orderId: string, data: unknown) {
    const payload: OrderStreamEvent = { event: 'order.updated', data };
    this.admin.next(payload);
    this.customers.get(orderId)?.next(payload);
  }
}
