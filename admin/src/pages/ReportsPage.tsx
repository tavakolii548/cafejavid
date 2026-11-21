import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Stat } from '../components/Stat';
import { formatPrice, gregorianToJalaliInput, tehranToday, toPersianDigits } from '../lib/format';

interface Report {
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  topProducts: { name: string; quantity: number; amount: number }[];
  hourly: { hour: number; count: number }[];
}

function shift(days: number) {
  const date = new Date(`${tehranToday()}T12:00:00+03:30`);
  date.setDate(date.getDate() - days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function ReportsPage() {
  const [range, setRange] = useState<'today' | '7' | '30'>('today');
  const [activeHour, setActiveHour] = useState<number | null>(null);
  const to = tehranToday();
  const from = range === 'today' ? to : shift(range === '7' ? 6 : 29);
  const report = useQuery({
    queryKey: ['report', from, to],
    queryFn: () => api<Report>(`/api/v1/admin/reports/summary?from=${from}&to=${to}`),
  });
  const hourly = report.data?.hourly ?? [];
  const max = Math.max(1, ...hourly.map((item) => item.count));
  const selected = activeHour == null ? null : hourly.find((item) => item.hour === activeHour) ?? null;

  return (
    <div className="panel-page">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
          <h1 className="panel-title">گزارش فروش</h1>
          <p className="panel-subtitle">
            بازه شمسی: {gregorianToJalaliInput(from)}
            {from !== to ? ` تا ${gregorianToJalaliInput(to)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([['today', 'امروز'], ['7', '۷ روز'], ['30', '۳۰ روز']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`toolbar-chip ${range === id ? 'toolbar-chip-on' : ''}`}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {report.isError ? (
        <button type="button" className="toolbar-chip mb-4 text-primary" onClick={() => report.refetch()}>
          تلاش دوباره
        </button>
      ) : null}

      {report.data ? (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <Stat label="فروش" value={formatPrice(report.data.totalSales)} />
            <Stat label="تعداد سفارش" value={toPersianDigits(report.data.orderCount)} />
            <Stat label="میانگین سفارش" value={formatPrice(report.data.averageOrderValue)} />
          </div>

          <h2 className="mb-2 text-[15px] font-bold">پنج محصول برتر</h2>
          <div className="order-card mb-6 overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead className="bg-tint/50 text-muted">
                <tr>
                  <th className="p-3 text-right font-medium">محصول</th>
                  <th className="p-3 text-right font-medium">تعداد</th>
                  <th className="p-3 text-right font-medium">مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {report.data.topProducts.map((item) => (
                  <tr key={item.name} className="border-t border-line/80 hover:bg-tint/30">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{toPersianDigits(item.quantity)}</td>
                    <td className="p-3 font-medium text-primary">{formatPrice(item.amount)}</td>
                  </tr>
                ))}
                {report.data.topProducts.length === 0 ? (
                  <tr>
                    <td className="p-8 text-center text-muted" colSpan={3}>
                      در این بازه محصولی ثبت نشده
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-[15px] font-bold">سفارش در ساعت</h2>
            <p className="text-xs text-muted">چپ: بامداد · راست: بعدازظهر و شب</p>
          </div>
          <div className="board-column bg-white/80 p-3" dir="ltr">
            <div className="mb-2 min-h-8 text-center text-sm" dir="rtl">
              {selected ? (
                <span className="font-bold text-primary">
                  ساعت {toPersianDigits(selected.hour)}:۰۰ — {toPersianDigits(selected.count)} سفارش
                </span>
              ) : (
                <span className="text-muted">روی هر ستون بروید یا کلیک کنید</span>
              )}
            </div>
            <div className="flex h-44 items-end gap-0.5">
              {hourly.map((item) => {
                const barPx = item.count > 0 ? Math.max(6, Math.round((item.count / max) * 148)) : 2;
                const isActive = activeHour === item.hour;
                return (
                  <button
                    key={item.hour}
                    type="button"
                    className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`ساعت ${item.hour}، ${item.count} سفارش`}
                    aria-pressed={isActive}
                    onMouseEnter={() => setActiveHour(item.hour)}
                    onFocus={() => setActiveHour(item.hour)}
                    onClick={() => setActiveHour(item.hour)}
                  >
                    <span
                      className={`mb-1 text-[10px] leading-none ${
                        item.count > 0 ? (isActive ? 'font-bold text-primary' : 'text-muted') : 'text-transparent'
                      }`}
                    >
                      {toPersianDigits(item.count || 0)}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all duration-150 ${
                        isActive ? 'bg-primary' : item.count > 0 ? 'bg-primary/70 group-hover:bg-primary' : 'bg-line'
                      }`}
                      style={{ height: `${barPx}px` }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-0.5 border-t border-line pt-2">
              {hourly.map((item) => (
                <div
                  key={`label-${item.hour}`}
                  className={`min-w-0 flex-1 text-center text-[10px] ${
                    activeHour === item.hour ? 'font-bold text-primary' : 'text-muted'
                  }`}
                >
                  {item.hour % 3 === 0 ? toPersianDigits(item.hour) : ''}
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted" dir="rtl">
              <span>شب</span>
              <span>ظهر</span>
              <span>صبح</span>
            </div>
            {hourly.every((item) => item.count === 0) ? (
              <p className="mt-2 text-center text-sm text-muted" dir="rtl">
                در این بازه سفارشی ثبت نشده
              </p>
            ) : null}
          </div>
        </>
      ) : !report.isError ? (
        <p className="panel-subtitle">در حال بارگذاری گزارش…</p>
      ) : null}
    </div>
  );
}
