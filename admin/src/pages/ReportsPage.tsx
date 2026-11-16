import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
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
  const to = tehranToday();
  const from = range === 'today' ? to : shift(range === '7' ? 6 : 29);
  const report = useQuery({
    queryKey: ['report', from, to],
    queryFn: () => api<Report>(`/api/v1/admin/reports/summary?from=${from}&to=${to}`),
  });
  const max = Math.max(1, ...(report.data?.hourly.map((item) => item.count) ?? [1]));
  return (
    <div className="p-6">
      <h1 className="mb-4 text-[22px] font-bold">گزارش فروش</h1>
      <p className="mb-3 text-sm text-muted">
        بازه شمسی: {gregorianToJalaliInput(from)}
        {from !== to ? ` تا ${gregorianToJalaliInput(to)}` : ''}
      </p>
      <div className="mb-4 flex gap-2">
        {([['today', 'امروز'], ['7', '۷ روز'], ['30', '۳۰ روز']] as const).map(([id, label]) => (
          <button key={id} className={`h-10 rounded-full px-4 ${range === id ? 'bg-primary text-white' : 'bg-white'}`} onClick={() => setRange(id)}>
            {label}
          </button>
        ))}
      </div>
      {report.isError ? <button onClick={() => report.refetch()}>تلاش دوباره</button> : null}
      {report.data ? (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <Stat label="فروش" value={formatPrice(report.data.totalSales)} />
            <Stat label="تعداد سفارش" value={toPersianDigits(report.data.orderCount)} />
            <Stat label="میانگین سفارش" value={formatPrice(report.data.averageOrderValue)} />
          </div>
          <h2 className="mb-2 font-bold">پنج محصول برتر</h2>
          <table className="mb-6 w-full overflow-hidden rounded-card bg-white text-sm">
            <tbody>
              {report.data.topProducts.map((item) => (
                <tr key={item.name} className="border-b border-line">
                  <td className="p-3">{item.name}</td>
                  <td className="p-3">{toPersianDigits(item.quantity)}</td>
                  <td className="p-3">{formatPrice(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 className="mb-2 font-bold">سفارش در ساعت</h2>
          <div className="flex h-40 items-end gap-1 rounded-card bg-white p-3">
            {report.data.hourly.map((item) => (
              <div key={item.hour} className="flex flex-1 flex-col items-center justify-end">
                <div className="w-full rounded-t bg-primary" style={{ height: `${(item.count / max) * 100}%` }} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
