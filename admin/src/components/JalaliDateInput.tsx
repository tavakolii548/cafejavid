import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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

function FieldSelect({
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      <select
        className="h-10 w-full min-w-0 appearance-none rounded-btn border border-line bg-white px-3 text-sm outline-none transition-colors hover:border-primary/40 focus:border-primary disabled:opacity-50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236B7A72' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'left 0.7rem center',
          backgroundSize: '12px 12px',
          paddingInlineStart: '0.75rem',
          paddingInlineEnd: '1.75rem',
        }}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {children}
      </select>
    </label>
  );
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const fields = (
    <div
      className={`grid gap-2.5 ${
        compact
          ? 'grid-cols-[minmax(4.75rem,1fr)_minmax(8.25rem,1.55fr)_minmax(3.75rem,0.85fr)]'
          : 'grid-cols-1 sm:grid-cols-3'
      }`}
      dir="rtl"
    >
      <FieldSelect
        label="سال"
        value={emptyOptional ? '' : String(jy)}
        onChange={(v) => {
          if (!v) {
            emit({ clear: true });
            return;
          }
          emit({ jy: Number(v) });
        }}
      >
        {optional ? <option value="">—</option> : null}
        {years.map((y) => (
          <option key={y} value={y}>
            {toPersianDigits(y)}
          </option>
        ))}
      </FieldSelect>
      <FieldSelect
        label="ماه"
        value={emptyOptional ? '' : String(jm)}
        disabled={emptyOptional}
        onChange={(v) => {
          if (!v) {
            emit({ clear: true });
            return;
          }
          emit({ jm: Number(v) });
        }}
      >
        {optional ? <option value="">ماه</option> : null}
        {JALAALI_MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </FieldSelect>
      <FieldSelect
        label="روز"
        value={emptyOptional ? '' : String(Math.min(jd, maxDay))}
        disabled={emptyOptional}
        onChange={(v) => {
          if (!v) {
            emit({ clear: true });
            return;
          }
          emit({ jd: Number(v) });
        }}
      >
        {optional ? <option value="">روز</option> : null}
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {toPersianDigits(d)}
          </option>
        ))}
      </FieldSelect>
    </div>
  );

  if (!compact) {
    return <div className={className}>{fields}</div>;
  }

  const summary = emptyOptional
    ? 'انتخاب تاریخ'
    : `${toPersianDigits(Math.min(jd, maxDay))} ${JALAALI_MONTH_NAMES[jm - 1]} ${toPersianDigits(jy)}`;

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        className="toolbar-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-primary shrink-0">
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 1.75v2.5M11 1.75v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="font-medium tabular-nums">{summary}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="انتخاب تاریخ شمسی"
          className="absolute left-0 top-[calc(100%+0.4rem)] z-40 w-[22.5rem] max-w-[calc(100vw-1.5rem)] rounded-card border border-line bg-white p-3 shadow-[0_12px_32px_rgba(23,37,30,0.12)]"
        >
          {fields}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            {optional ? (
              <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => emit({ clear: true })}>
                پاک کردن
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="h-9 rounded-full bg-primary px-4 text-sm text-white"
              onClick={() => setOpen(false)}
            >
              تأیید
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
