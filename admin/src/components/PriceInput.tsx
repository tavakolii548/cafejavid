import { useEffect, useState } from 'react';
import { formatPriceGrouped, parsePriceInput, toPersianDigits } from '../lib/format';

type Props = {
  value: number | string;
  onChange: (numericString: string) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  /** When true, empty is allowed and emits ''. */
  allowEmpty?: boolean;
};

/**
 * Price field with thousands separators (Persian digits).
 * Emits plain English-digit numeric string (no commas) for form state / API.
 */
export function PriceInput({
  value,
  onChange,
  className,
  placeholder,
  min,
  max,
  required,
  allowEmpty,
}: Props) {
  const numeric =
    typeof value === 'number'
      ? value
      : value.trim() === ''
        ? NaN
        : parsePriceInput(value);

  const [text, setText] = useState(() =>
    Number.isFinite(numeric) ? formatPriceGrouped(numeric) : typeof value === 'string' ? value : '',
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    if (typeof value === 'string' && value.trim() === '') {
      setText('');
      return;
    }
    const n = typeof value === 'number' ? value : parsePriceInput(value);
    setText(Number.isFinite(n) ? formatPriceGrouped(n) : '');
  }, [value, focused]);

  function emitFromRaw(raw: string) {
    const cleaned = raw.replace(/[^\d۰-۹٠-٩,٬]/g, '');
    setText(cleaned);
    if (!cleaned.trim()) {
      if (allowEmpty) onChange('');
      else onChange('0');
      return;
    }
    const n = parsePriceInput(cleaned);
    if (!Number.isFinite(n)) return;
    let next = n;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    onChange(String(Math.round(next)));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      dir="ltr"
      className={
        className ??
        'h-12 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
      }
      value={focused ? text : Number.isFinite(numeric) ? formatPriceGrouped(numeric) : text}
      placeholder={placeholder ? toPersianDigits(placeholder) : undefined}
      required={required}
      onFocus={() => {
        setFocused(true);
        setText(Number.isFinite(numeric) ? formatPriceGrouped(numeric) : '');
      }}
      onBlur={() => {
        setFocused(false);
        if (!text.trim()) {
          if (allowEmpty) {
            onChange('');
            setText('');
            return;
          }
          onChange('0');
          setText(formatPriceGrouped(0));
          return;
        }
        const n = parsePriceInput(text);
        if (!Number.isFinite(n)) return;
        let next = Math.round(n);
        if (typeof min === 'number' && next < min) next = min;
        if (typeof max === 'number' && next > max) next = max;
        onChange(String(next));
        setText(formatPriceGrouped(next));
      }}
      onChange={(e) => emitFromRaw(e.target.value)}
    />
  );
}
