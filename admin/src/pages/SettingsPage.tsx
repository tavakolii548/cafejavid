import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, api, type Settings } from '../api';
import { PriceInput } from '../components/PriceInput';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<Settings>('/api/v1/admin/settings') });
  const [form, setForm] = useState<Settings | null>(null);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.data) {
      setForm({
        ...settings.data,
        logoUrl: settings.data.logoUrl || '',
        courierPhone: settings.data.courierPhone || '',
        receiptHeader: settings.data.receiptHeader || '',
        receiptShowPhone: settings.data.receiptShowPhone !== false,
        receiptShowAddress: settings.data.receiptShowAddress !== false,
        receiptShowHours: Boolean(settings.data.receiptShowHours),
      });
    }
  }, [settings.data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    await api('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify(form) });
    setMessage('ذخیره شد');
    await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    await queryClient.invalidateQueries({ queryKey: ['config'] });
  }

  async function uploadLogo(file: File) {
    if (!form) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const result = await api<{ url: string }>('/api/v1/admin/uploads', { method: 'POST', body: data });
      setForm({ ...form, logoUrl: result.url });
      setMessage('لوگو آپلود شد — ذخیره را بزنید');
    } finally {
      setUploading(false);
    }
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

  const logoPreview = form.logoUrl?.trim()
    ? /^https?:\/\//i.test(form.logoUrl) || form.logoUrl.startsWith('/')
      ? form.logoUrl
      : `${API_URL.replace(/\/+$/, '')}/${form.logoUrl.replace(/^\/+/, '')}`
    : '/cafe-logo.png';

  return (
    <div className="panel-page">
      <header className="mb-6">
        <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
        <h1 className="panel-title">تنظیمات</h1>
        <p className="panel-subtitle">هویت کافه، فیش چاپ، هزینه‌ها و پذیرش سفارش</p>
      </header>

      <form onSubmit={save} className="order-card max-w-xl !p-5">
        <h2 className="mb-3 text-sm font-bold text-primary/90">اطلاعات کافه</h2>
        <Field label="نام کافه" value={form.cafeName} onChange={(value) => setForm({ ...form, cafeName: value })} />
        <Field label="تلفن کافه" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        <Field
          label="تلفن پیک"
          value={form.courierPhone || ''}
          onChange={(value) => setForm({ ...form, courierPhone: value })}
        />
        <Field label="آدرس" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
        <Field label="ساعات کاری" value={form.openingHours} onChange={(value) => setForm({ ...form, openingHours: value })} />

        <div className="my-4 border-t border-line/80 pt-4">
          <h2 className="mb-1 text-sm font-bold text-primary/90">قالب فیش چاپ</h2>
          <p className="mb-3 text-xs text-muted">لوگو، متن‌ها و نمایش تلفن/آدرس روی فیش سفارش</p>

          <div className="mb-4 flex items-center gap-4">
            <img
              src={logoPreview}
              alt="لوگو فیش"
              className="h-20 w-20 rounded-2xl border border-line object-cover bg-tint"
            />
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="toolbar-chip w-fit"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'در حال آپلود…' : 'آپلود لوگو'}
              </button>
              {form.logoUrl ? (
                <button
                  type="button"
                  className="toolbar-chip w-fit text-muted"
                  onClick={() => setForm({ ...form, logoUrl: '' })}
                >
                  بازگشت به لوگوی پیش‌فرض
                </button>
              ) : (
                <span className="text-xs text-muted">در حال حاضر لوگوی پیش‌فرض کافه استفاده می‌شود</span>
              )}
            </div>
          </div>

          <Field
            label="متن زیر نام کافه"
            value={form.receiptHeader || ''}
            onChange={(value) => setForm({ ...form, receiptHeader: value })}
          />
          <Field
            label="متن پایین فیش"
            value={form.receiptFooter}
            onChange={(value) => setForm({ ...form, receiptFooter: value })}
          />

          <Toggle
            label="نمایش تلفن روی فیش"
            on={form.receiptShowPhone !== false}
            onClick={() => setForm({ ...form, receiptShowPhone: form.receiptShowPhone === false })}
          />
          <Toggle
            label="نمایش آدرس روی فیش"
            on={form.receiptShowAddress !== false}
            onClick={() => setForm({ ...form, receiptShowAddress: form.receiptShowAddress === false })}
          />
          <Toggle
            label="نمایش ساعات کاری روی فیش"
            on={Boolean(form.receiptShowHours)}
            onClick={() => setForm({ ...form, receiptShowHours: !form.receiptShowHours })}
          />
        </div>

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

        <Toggle
          label="پذیرش سفارش"
          on={form.acceptingOrders}
          onClick={() => setForm({ ...form, acceptingOrders: !form.acceptingOrders })}
          className="mb-4"
        />

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

function Toggle({
  label,
  on,
  onClick,
  className = 'mb-2',
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={`toolbar-chip w-full justify-between ${on ? 'toolbar-chip-on' : ''} ${className}`} onClick={onClick}>
      <span>{label}</span>
      <span className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-primary' : 'bg-line'}`} aria-hidden />
    </button>
  );
}
