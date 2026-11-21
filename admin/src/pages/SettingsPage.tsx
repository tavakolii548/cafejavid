import { FormEvent, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Settings } from '../api';
import { PriceInput } from '../components/PriceInput';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<Settings>('/api/v1/admin/settings') });
  const [form, setForm] = useState<Settings | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    await api('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify(form) });
    setMessage('ذخیره شد');
    await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
  }

  if (settings.isError) {
    return (
      <div className="panel-page">
        <button className="toolbar-chip text-primary" onClick={() => settings.refetch()}>
          تلاش دوباره
        </button>
      </div>
    );
  }
  if (!form) {
    return (
      <div className="panel-page">
        <p className="panel-subtitle">در حال بارگذاری…</p>
      </div>
    );
  }

  return (
    <div className="panel-page">
      <header className="mb-6">
        <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
        <h1 className="panel-title">تنظیمات</h1>
        <p className="panel-subtitle">هویت کافه، هزینه‌ها و پذیرش سفارش</p>
      </header>

      <form onSubmit={save} className="order-card max-w-xl !p-5">
        <h2 className="mb-3 text-sm font-bold text-primary/90">اطلاعات کافه</h2>
        <Field label="نام کافه" value={form.cafeName} onChange={(value) => setForm({ ...form, cafeName: value })} />
        <Field label="تلفن" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        <Field label="آدرس" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
        <Field label="ساعات کاری" value={form.openingHours} onChange={(value) => setForm({ ...form, openingHours: value })} />
        <Field label="متن پایین فیش" value={form.receiptFooter} onChange={(value) => setForm({ ...form, receiptFooter: value })} />

        <div className="my-4 border-t border-line/80 pt-4">
          <h2 className="mb-3 text-sm font-bold text-primary/90">هزینه‌ها و سفارش</h2>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">هزینه پیک</span>
            <PriceInput value={form.deliveryFee} onChange={(v) => setForm({ ...form, deliveryFee: Number(v) || 0 })} min={0} />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">هزینه بسته‌بندی</span>
            <PriceInput
              value={form.packagingFee ?? 0}
              onChange={(v) => setForm({ ...form, packagingFee: Number(v) || 0 })}
              min={0}
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">حداقل سفارش</span>
            <PriceInput value={form.minOrder} onChange={(v) => setForm({ ...form, minOrder: Number(v) || 0 })} min={0} />
          </label>
          <Field label="تعداد میز" value={String(form.tableCount)} onChange={(value) => setForm({ ...form, tableCount: Number(value) || 0 })} />
        </div>

        <button
          type="button"
          className={`toolbar-chip mb-4 w-full justify-between ${form.acceptingOrders ? 'toolbar-chip-on' : ''}`}
          onClick={() => setForm({ ...form, acceptingOrders: !form.acceptingOrders })}
        >
          <span>پذیرش سفارش</span>
          <span className={`h-2.5 w-2.5 rounded-full ${form.acceptingOrders ? 'bg-primary' : 'bg-line'}`} aria-hidden />
        </button>

        {message ? (
          <p className="mb-3 rounded-2xl border border-primary/20 bg-tint px-3 py-2 text-sm text-primary">{message}</p>
        ) : null}
        <button className="h-12 w-full rounded-btn bg-primary px-6 font-bold text-white transition hover:brightness-110" type="submit">
          ذخیره
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <input
        className="h-12 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
