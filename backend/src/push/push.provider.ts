export interface PushProvider {
  notify(event: string, orderId: string): Promise<void>;
}

export class LogPushProvider implements PushProvider {
  async notify(event: string, orderId: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[push stub] ${event} ${orderId}`);
    }
  }
}
