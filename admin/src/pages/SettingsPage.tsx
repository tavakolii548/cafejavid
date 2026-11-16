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

  if (settings.isError) return <button className="m-6" onClick={() => settings.refetch()}>تلاش دوباره</button>;
  if (!form) return <p className="p-6">در حال بارگذاری</p>;

  return (
    <form onSubmit={save} className="max-w-xl p-6">
      <h1 className="mb-4 text-[22px] font-bold">تنظیمات</h1>
      <Field label="نام کافه" value={form.cafeName} onChange={(value) => setForm({ ...form, cafeName: value })} />
      <Field label="تلفن" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
      <Field label="آدرس" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
      <Field label="ساعات کاری" value={form.openingHours} onChange={(value) => setForm({ ...form, openingHours: value })} />
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
      <Field label="متن پایین فیش" value={form.receiptFooter} onChange={(value) => setForm({ ...form, receiptFooter: value })} />
      <label className="mb-4 flex items-center gap-2">
        <input type="checkbox" checked={form.acceptingOrders} onChange={(e) => setForm({ ...form, acceptingOrders: e.target.checked })} />
        پذیرش سفارش
      </label>
      {message ? <p className="mb-3 text-sm">{message}</p> : null}
      <button className="h-12 rounded-btn bg-primary px-6 font-bold text-white" type="submit">
        ذخیره
      </button>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <input className="h-12 w-full rounded-btn border border-line px-3" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
