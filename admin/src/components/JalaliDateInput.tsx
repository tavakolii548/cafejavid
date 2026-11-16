import {
  JALAALI_MONTH_NAMES,
  formatJalaliParts,
  jalaaliMonthLength,
  parseJalaliInput,
  tehranJalaliToday,
  toPersianDigits,
  type JalaliParts,
} from '../lib/format';

type Props = {
  value: string;
  onChange: (jalaliText: string) => void;
  optional?: boolean;
  className?: string;
  compact?: boolean;
  /** Inclusive year range around today (default ±80 / +5). */
  yearFrom?: number;
  yearTo?: number;
};

function yearsAround(from?: number, to?: number) {
  const today = tehranJalaliToday();
  const start = from ?? today.jy - 80;
  const end = to ?? today.jy + 5;
  const list: number[] = [];
  for (let y = end; y >= start; y -= 1) list.push(y);
  return list;
}

export function JalaliDateInput({ value, onChange, optional, className, compact, yearFrom, yearTo }: Props) {
  const parsed = parseJalaliInput(value);
  const today = tehranJalaliToday();
  const emptyOptional = Boolean(optional && !parsed);
  const jy = parsed?.jy ?? today.jy;
  const jm = parsed?.jm ?? today.jm;
  const jd = parsed?.jd ?? today.jd;
  const maxDay = jalaaliMonthLength(jy, Math.min(12, Math.max(1, jm)));
  const years = yearsAround(yearFrom, yearTo);
  const selectClass = compact
    ? 'h-9 min-w-[4.5rem] rounded-btn border-0 bg-transparent px-1 text-sm outline-none'
    : 'h-12 min-w-[5.5rem] flex-1 rounded-btn border border-line bg-white px-2 text-sm';

  function emit(next: Partial<JalaliParts> & { clear?: boolean }) {
    if (next.clear) {
      onChange('');
      return;
    }
    const parts: JalaliParts = {
      jy: next.jy ?? jy,
      jm: next.jm ?? jm,
      jd: next.jd ?? jd,
    };
    const capped = Math.min(parts.jd, jalaaliMonthLength(parts.jy, parts.jm));
    onChange(formatJalaliParts({ ...parts, jd: capped }));
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ''}`} dir="rtl">
      <select
        className={selectClass}
        value={emptyOptional ? '' : String(jy)}
        onChange={(e) => {
          if (!e.target.value) {
            emit({ clear: true });
            return;
          }
          emit({ jy: Number(e.target.value) });
        }}
        aria-label="سال شمسی"
      >
        {optional ? <option value="">—</option> : null}
        {years.map((y) => (
          <option key={y} value={y}>
            {toPersianDigits(y)}
          </option>
        ))}
      </select>
      <select
        className={compact ? selectClass : `${selectClass} min-w-[7rem]`}
        value={emptyOptional ? '' : String(jm)}
        onChange={(e) => {
          if (!e.target.value) {
            emit({ clear: true });
            return;
          }
          emit({ jm: Number(e.target.value) });
        }}
        aria-label="ماه شمسی"
        disabled={emptyOptional}
      >
        {optional ? <option value="">ماه</option> : null}
        {JALAALI_MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        className={compact ? selectClass : `${selectClass} min-w-[4.5rem]`}
        value={emptyOptional ? '' : String(Math.min(jd, maxDay))}
        onChange={(e) => {
          if (!e.target.value) {
            emit({ clear: true });
            return;
          }
          emit({ jd: Number(e.target.value) });
        }}
        aria-label="روز شمسی"
        disabled={emptyOptional}
      >
        {optional ? <option value="">روز</option> : null}
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {toPersianDigits(d)}
          </option>
        ))}
      </select>
    </div>
  );
}
