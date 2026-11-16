import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { JalaliDateInput } from '../components/JalaliDateInput';
import { PriceInput } from '../components/PriceInput';
import {
  formatJalali,
  formatPrice,
  jalaliInputToEndsAtISO,
  tehranJalaliToday,
  toPersianDigits,
} from '../lib/format';

type DiscountType = 'PERCENT' | 'FIXED';

interface ClubCustomer {
  id: string;
  phone: string;
  customerCode: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface DiscountCodeRow {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  userId: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  user: {
    id: string;
    phone: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    customerCode: string | null;
  };
}

type FormState = {
  code: string;
  type: DiscountType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  userId: string;
  active: boolean;
  endsAt: string;
  maxUses: string;
};

const emptyForm: FormState = {
  code: '',
  type: 'PERCENT',
  value: '',
  minOrder: '',
  maxDiscount: '',
  userId: '',
  active: true,
  endsAt: '',
  maxUses: '1',
};

function displayName(user: { name: string | null; firstName?: string | null; lastName?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'بدون نام';
}

export function DiscountCodesPage() {
  const queryClient = useQueryClient();
  const codes = useQuery({
    queryKey: ['discount-codes'],
    queryFn: () => api<DiscountCodeRow[]>('/api/v1/admin/discount-codes'),
  });
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api<ClubCustomer[]>('/api/v1/admin/customers'),
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [userSearch, setUserSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const customerOptions = useMemo(() => {
    const list = customers.data ?? [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const hay = [c.customerCode, c.phone, c.name, c.firstName, c.lastName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q) || toPersianDigits(hay).includes(userSearch.trim());
    });
  }, [customers.data, userSearch]);

  const create = useMutation({
    mutationFn: () => {
      const value = Number(form.value);
      const maxUses = Number(form.maxUses || '1');
      const minOrder = form.minOrder.trim() ? Number(form.minOrder) : undefined;
      const maxDiscount =
        form.type === 'PERCENT' && form.maxDiscount.trim() ? Number(form.maxDiscount) : undefined;
      const endsAt = form.endsAt.trim() ? jalaliInputToEndsAtISO(form.endsAt) : undefined;
      if (form.endsAt.trim() && !endsAt) {
        throw new Error('تاریخ انقضا نامعتبر است');
      }
      return api('/api/v1/admin/discount-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          type: form.type,
          value,
          userId: form.userId,
          minOrder,
          maxDiscount,
          active: form.active,
          endsAt: endsAt || undefined,
          maxUses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : 1,
        }),
      });
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setUserSearch('');
      setError('');
      setMessage('کد تخفیف ثبت شد');
      await queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
    },
    onError: (err: Error) => {
      setMessage('');
      setError(err.message);
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/api/v1/admin/discount-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!form.userId) {
      setError('عضو باشگاه را انتخاب کنید');
      return;
    }
    if (!form.code.trim()) {
      setError('کد را وارد کنید');
      return;
    }
    const value = Number(form.value);
    if (!Number.isFinite(value) || value < 1) {
      setError('مقدار معتبر نیست');
      return;
    }
    if (form.type === 'PERCENT' && value > 100) {
      setError('درصد باید حداکثر ۱۰۰ باشد');
      return;
    }
    create.mutate();
  }

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={onSubmit} className="rounded-card bg-white p-4">
        <h1 className="mb-1 text-[22px] font-bold">کدهای تخفیف</h1>
        <p className="mb-4 text-sm text-muted">کد اختصاصی برای یک عضو باشگاه — فقط همان کاربر می‌تواند استفاده کند</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">کد</span>
          <input
            className="h-12 w-full rounded-btn border border-line px-3 font-mono uppercase"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="مثلاً SARA20"
            required
          />
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">نوع</span>
          <select
            className="h-12 w-full rounded-btn border border-line px-3"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DiscountType }))}
          >
            <option value="PERCENT">درصدی</option>
            <option value="FIXED">مبلغ ثابت</option>
          </select>
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">{form.type === 'PERCENT' ? 'درصد' : 'مبلغ (تومان)'}</span>
          {form.type === 'PERCENT' ? (
            <input
              type="number"
              min={1}
              max={100}
              className="h-12 w-full rounded-btn border border-line px-3"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              required
            />
          ) : (
            <PriceInput
              value={form.value}
              onChange={(v) => setForm((f) => ({ ...f, value: v }))}
              min={1}
              required
            />
          )}
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">حداقل سفارش (اختیاری)</span>
          <PriceInput
            value={form.minOrder}
            onChange={(v) => setForm((f) => ({ ...f, minOrder: v }))}
            min={0}
            allowEmpty
            placeholder="۰"
          />
        </label>

        {form.type === 'PERCENT' ? (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">سقف تخفیف (اختیاری)</span>
            <PriceInput
              value={form.maxDiscount}
              onChange={(v) => setForm((f) => ({ ...f, maxDiscount: v }))}
              min={1}
              allowEmpty
            />
          </label>
        ) : null}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">جستجوی عضو باشگاه</span>
          <input
            className="mb-2 h-12 w-full rounded-btn border border-line px-3"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="کد مشتری، نام یا موبایل"
          />
          <select
            className="h-12 w-full rounded-btn border border-line px-3"
            value={form.userId}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            required
          >
            <option value="">انتخاب کنید</option>
            {customerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.customerCode ? `${c.customerCode} · ` : '') + displayName(c) + ' — ' + c.phone}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">سقف استفاده</span>
          <input
            type="number"
            min={1}
            className="h-12 w-full rounded-btn border border-line px-3"
            value={form.maxUses}
            onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
          />
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">تاریخ انقضا شمسی (اختیاری — پایان همان روز)</span>
          <JalaliDateInput
            value={form.endsAt}
            onChange={(v) => setForm((f) => ({ ...f, endsAt: v }))}
            optional
            yearFrom={tehranJalaliToday().jy - 1}
            yearTo={tehranJalaliToday().jy + 10}
          />
        </label>

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          <span>فعال</span>
        </label>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mb-3 text-sm text-primary">{message}</p> : null}

        <button
          type="submit"
          className="h-12 w-full rounded-btn bg-primary font-bold text-white disabled:opacity-60"
          disabled={create.isPending}
        >
          {create.isPending ? 'در حال ثبت…' : 'ثبت کد تخفیف'}
        </button>
      </form>

      <div className="rounded-card bg-white p-4">
        <h2 className="mb-4 text-lg font-bold">فهرست کدها</h2>
        {codes.isError ? (
          <button type="button" className="mb-3 text-sm text-primary" onClick={() => codes.refetch()}>
            خطا در بارگذاری — تلاش دوباره
          </button>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-2 py-2 font-medium">کد</th>
                <th className="px-2 py-2 font-medium">کاربر</th>
                <th className="px-2 py-2 font-medium">مقدار</th>
                <th className="px-2 py-2 font-medium">استفاده</th>
                <th className="px-2 py-2 font-medium">وضعیت</th>
                <th className="px-2 py-2 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {(codes.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-line/70">
                  <td className="px-2 py-3 font-mono font-bold">{row.code}</td>
                  <td className="px-2 py-3">
                    <div>{displayName(row.user)}</div>
                    <div className="text-xs text-muted">
                      {(row.user.customerCode ? `${toPersianDigits(row.user.customerCode)} · ` : '') +
                        toPersianDigits(row.user.phone)}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {row.type === 'PERCENT'
                      ? `${toPersianDigits(row.value)}٪`
                      : formatPrice(row.value)}
                    {row.minOrder ? (
                      <div className="text-xs text-muted">حداقل {formatPrice(row.minOrder)}</div>
                    ) : null}
                    {row.endsAt ? (
                      <div className="text-xs text-muted">تا {formatJalali(row.endsAt)}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    {toPersianDigits(row.usedCount)} / {toPersianDigits(row.maxUses)}
                  </td>
                  <td className="px-2 py-3">
                    <span className={row.active ? 'text-primary' : 'text-muted'}>
                      {row.active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="rounded-full border border-line px-3 py-1 text-xs"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: row.id, active: !row.active })}
                    >
                      {row.active ? 'غیرفعال کردن' : 'فعال کردن'}
                    </button>
                  </td>
                </tr>
              ))}
              {!codes.isLoading && (codes.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-muted">
                    هنوز کدی ثبت نشده است
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
