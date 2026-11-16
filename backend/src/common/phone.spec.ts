import { normalizePhone, otpAttemptResult, toEnglishDigits } from './phone';

describe('phone', () => {
  it('normalizes persian and arabic digits', () => {
    expect(toEnglishDigits('۰۹۱۲')).toBe('0912');
    expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizePhone('٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
    expect(normalizePhone('+989123456789')).toBe('09123456789');
    expect(normalizePhone('9123456789')).toBe('09123456789');
  });

  it('rejects invalid numbers', () => {
    expect(normalizePhone('08123456789')).toBeNull();
    expect(normalizePhone('09123')).toBeNull();
  });

  it('locks OTP after 5 failed attempts', () => {
    expect(otpAttemptResult(0, false)).toBe('invalid');
    expect(otpAttemptResult(4, false)).toBe('invalid');
    expect(otpAttemptResult(5, true)).toBe('locked');
    expect(otpAttemptResult(0, true)).toBe('ok');
  });
});
