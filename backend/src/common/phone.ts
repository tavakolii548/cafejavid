const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const p = PERSIAN.indexOf(ch);
    if (p >= 0) return String(p);
    const a = ARABIC.indexOf(ch);
    return a >= 0 ? String(a) : ch;
  });
}

/** Iranian mobile in local form 09xxxxxxxxx, or null. */
export function normalizePhone(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/\D/g, '');
  let n = digits;
  if (n.startsWith('0098')) n = '0' + n.slice(4);
  else if (n.startsWith('98') && n.length === 12) n = '0' + n.slice(2);
  else if (n.startsWith('9') && n.length === 10) n = '0' + n;
  if (!/^09\d{9}$/.test(n)) return null;
  return n;
}

export function otpAttemptResult(attemptsBefore: number, matches: boolean): 'ok' | 'invalid' | 'locked' {
  if (attemptsBefore >= 5) return 'locked';
  if (!matches) return 'invalid';
  return 'ok';
}
