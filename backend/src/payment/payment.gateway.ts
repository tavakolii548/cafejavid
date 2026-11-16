export interface PaymentStartResult {
  redirectUrl: string | null;
}

export interface PaymentGateway {
  start(orderId: string, amountToman: number): Promise<PaymentStartResult>;
}

export class CashPaymentGateway implements PaymentGateway {
  async start(_orderId: string, _amountToman: number): Promise<PaymentStartResult> {
    return { redirectUrl: null };
  }
}

/** Stub. Real request is not sent while PAYMENT_ONLINE_ENABLED is false. */
export class ZarinpalPaymentGateway implements PaymentGateway {
  async start(orderId: string, amountToman: number): Promise<PaymentStartResult> {
    if (process.env.PAYMENT_ONLINE_ENABLED !== 'true') {
      return { redirectUrl: null };
    }
    const merchant = process.env.ZARINPAL_MERCHANT_ID || '';
    if (!merchant) {
      throw new Error('ZARINPAL_MERCHANT_ID is empty');
    }
    void orderId;
    void amountToman;
    throw new Error('Zarinpal adapter is stubbed');
  }
}
