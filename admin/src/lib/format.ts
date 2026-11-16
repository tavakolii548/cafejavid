function div(a: number, b: number) {
  return Math.trunc(a / b);
}
function mod(a: number, b: number) {
  return a - Math.trunc(a / b) * b;
}

/** Port of jalaali-js (MIT) gregorian-to-jalali conversion. */
export function toJalaali(gy: number, gm: number, gd: number) {
  const jdn = g2d(gy, gm, gd);
  const gy2 = d2g(jdn).gy;
  let jy = gy2 - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy2, 3, r.march);
  let k = jdn - jdn1f;
  let jm: number;
  let jd: number;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/** Port of jalaali-js (MIT) jalali-to-gregorian conversion. */
export function toGregorian(jy: number, jm: number, jd: number) {
  return d2g(j2d(jy, jm, jd));
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function g2d(gy: number, gm: number, gd: number) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error(`Invalid Jalaali year ${jy}`);
  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

export function isLeapJalaaliYear(jy: number) {
  return jalCal(jy).leap === 0;
}

export function jalaaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}

const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

export function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => PERSIAN[Number(d)]);
}

export function toEnglishDigits(value: string) {
  return String(value)
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function formatPrice(amount: number) {
  const grouped = Math.round(amount).toLocaleString('en-US');
  return `${toPersianDigits(grouped)} تومان`;
}

/** Grouped number for display/inputs (Persian digits + commas), without تومان. */
export function formatPriceGrouped(amount: number | null | undefined) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  return toPersianDigits(Math.round(amount).toLocaleString('en-US'));
}

/** Strip separators / Persian digits → number (NaN if empty/invalid). */
export function parsePriceInput(raw: string): number {
  const cleaned = toEnglishDigits(raw).replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return NaN;
  return Number(cleaned);
}

export function formatJalali(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const j = toJalaali(get('year'), get('month'), get('day'));
  return toPersianDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)} ${pad2(get('hour'))}:${pad2(get('minute'))}`);
}

/** Jalali date only (no time), Persian digits. */
export function formatJalaliDate(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const j = toJalaali(get('year'), get('month'), get('day'));
  return toPersianDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`);
}

export function tehranTime(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const h = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const m = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return toPersianDigits(`${h}:${m}`);
}

/** Gregorian YYYY-MM-DD in Asia/Tehran. */
export function tehranToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export type JalaliParts = { jy: number; jm: number; jd: number };

export function tehranJalaliToday(): JalaliParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return toJalaali(get('year'), get('month'), get('day'));
}

/** ISO/Gregorian date → Jalali parts in Tehran. */
export function gregorianToJalaliParts(isoOrYmd: string): JalaliParts | null {
  if (!isoOrYmd?.trim()) return null;
  const raw = isoOrYmd.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !raw.includes('T') && raw.length <= 10) {
    const [gy, gm, gd] = raw.split('-').map(Number);
    if (!gy || !gm || !gd) return null;
    return toJalaali(gy, gm, gd);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return toJalaali(get('year'), get('month'), get('day'));
}

/** Form display value: `۱۴۰۴/۰۹/۱۵` from ISO or Gregorian YMD. */
export function gregorianToJalaliInput(isoOrYmd: string): string {
  const j = gregorianToJalaliParts(isoOrYmd);
  if (!j) return '';
  return toPersianDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`);
}

/** Parse Jalali `yyyy/mm/dd` (Persian or English digits) → parts. */
export function parseJalaliInput(raw: string): JalaliParts | null {
  if (!raw?.trim()) return null;
  const normalized = toEnglishDigits(raw.trim()).replace(/[-.]/g, '/');
  const parts = normalized.split('/').map((p) => Number(p.replace(/\D/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length < 3) return null;
  const [jy, jm, jd] = parts;
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
}

/** Format Jalali parts for form fields (Persian digits). */
export function formatJalaliParts(j: JalaliParts): string {
  return toPersianDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`);
}

/** Format Jalali parts with English digits (API / DB payloads). */
export function formatJalaliPartsLatin(j: JalaliParts): string {
  return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;
}

/**
 * Jalali date → Gregorian `YYYY-MM-DD` (calendar day, not timezone-shifted).
 * Use for API `?date=` filters.
 */
export function jalaaliToGregorianYmd(j: JalaliParts): string {
  const g = toGregorian(j.jy, j.jm, j.jd);
  return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
}

/**
 * Jalali date → ISO datetime at end of that calendar day in Tehran (for endsAt).
 * hour/minute optional (defaults 23:59 Tehran).
 */
export function jalaaliToGregorianISO(j: JalaliParts, hour = 23, minute = 59): string {
  const ymd = jalaaliToGregorianYmd(j);
  const h = pad2(Math.min(23, Math.max(0, hour)));
  const m = pad2(Math.min(59, Math.max(0, minute)));
  return new Date(`${ymd}T${h}:${m}:59+03:30`).toISOString();
}

/** Parse free-text Jalali and convert to Gregorian YMD, or null. */
export function jalaliInputToGregorianYmd(raw: string): string | null {
  const j = parseJalaliInput(raw);
  if (!j) return null;
  return jalaaliToGregorianYmd(j);
}

/** Parse free-text Jalali and convert to ISO endsAt (end of day Tehran), or null. */
export function jalaliInputToEndsAtISO(raw: string): string | null {
  const j = parseJalaliInput(raw);
  if (!j) return null;
  return jalaaliToGregorianISO(j);
}

export const JALAALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;
