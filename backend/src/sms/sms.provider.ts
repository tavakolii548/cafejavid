export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

export class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SMS dev] phone=${phone} code=${code}`);
    }
  }
}

/** Kavenegar verify/lookup. Set SMS_API_KEY and a template named "verify" with token. */
export class KavenegarSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    const key = process.env.SMS_API_KEY;
    if (!key) {
      throw new Error('SMS_API_KEY is empty');
    }
    const receptor = phone.startsWith('0') ? `98${phone.slice(1)}` : phone;
    const url =
      `https://api.kavenegar.com/v1/${key}/verify/lookup.json` +
      `?receptor=${encodeURIComponent(receptor)}&token=${encodeURIComponent(code)}&template=verify`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Kavenegar HTTP ${res.status}`);
    }
  }
}

export function createSmsProvider(): SmsProvider {
  if ((process.env.SMS_PROVIDER || 'console') === 'kavenegar') {
    return new KavenegarSmsProvider();
  }
  return new ConsoleSmsProvider();
}
