import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { JalaliDateInput } from '../components/JalaliDateInput';
import {
  formatJalali,
  formatJalaliPartsLatin,
  formatPrice,
  parseJalaliInput,
  tehranJalaliToday,
  toPersianDigits,
} from '../lib/format';

interface Customer {
  id: string;
  phone: string;
  customerCode: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

type MemberForm = {
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: string;
  customerCode: string;
};

const emptyForm: MemberForm = {
  firstName: '',
  lastName: '',
  phone: '',
  birthDate: '',
  customerCode: '',
};

function isBirthdayToday(birthDate: string | null) {
  if (!birthDate?.trim()) return false;
  const parsed = parseJalaliInput(birthDate);
  if (!parsed) return false;
  const today = tehranJalaliToday();
  return parsed.jm === today.jm && parsed.jd === today.jd;
}

function displayName(c: Customer) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || 'بدون نام';
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api<Customer[]>('/api/v1/admin/customers') });
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<Customer | null>(null);
  const [title, setTitle] = useState('پیام کافه جاوید');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    const list = customers.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const hay = [
        c.customerCode,
        c.phone,
        c.name,
        c.firstName,
        c.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q) || toPersianDigits(hay).includes(search.trim());
    });
  }, [customers.data, search]);

  const send = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          audience: 'USER',
          userId: target?.id,
        }),
      }),
    onSuccess: async () => {
      setTarget(null);
      setBody('');
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveMember = useMutation({
    mutationFn: async () => {
      const birthRaw = form.birthDate.trim();
      const birthParsed = birthRaw ? parseJalaliInput(birthRaw) : null;
      if (birthRaw && !birthParsed) {
        throw new Error('تاریخ تولد شمسی نامعتبر است');
      }
      const payload = {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim(),
        birthDate: birthParsed ? formatJalaliPartsLatin(birthParsed) : undefined,
        customerCode: form.customerCode.trim() || undefined,
      };
      if (formOpen === 'edit' && editing) {
        return api<Customer>(`/api/v1/admin/customers/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return api<Customer>('/api/v1/admin/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setFormOpen(null);
      setEditing(null);
      setForm(emptyForm);
      setFormError('');
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function onSubmitNotify(event: FormEvent) {
    event.preventDefault();
    send.mutate();
  }

  function onSubmitMember(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!form.phone.trim()) {
      setFormError('موبایل الزامی است');
      return;
    }
    saveMember.mutate();
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen('create');
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      phone: customer.phone,
      birthDate: customer.birthDate || '',
      customerCode: customer.customerCode || '',
    });
    setFormError('');
    setFormOpen('edit');
  }

  const fieldClass =
    'h-11 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

  return (
    <div className="panel-page">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
          <h1 className="panel-title">باشگاه مشتریان</h1>
          <p className="panel-subtitle">
            {toPersianDigits((customers.data ?? []).length)} عضو · کد، موبایل و تاریخ تولد
          </p>
        </div>
        <button
          type="button"
          className="h-12 shrink-0 rounded-btn bg-primary px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(30,77,58,0.22)] transition hover:brightness-110"
          onClick={openCreate}
        >
          عضو جدید
        </button>
      </header>

      <div className="mb-4">
        <input
          className="h-11 w-full max-w-md rounded-full border border-line bg-white/90 px-4 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          placeholder="جستجو با کد مشتری، موبایل یا نام…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {customers.isError ? (
        <button type="button" className="toolbar-chip mb-3 text-primary" onClick={() => customers.refetch()}>
          تلاش دوباره
        </button>
      ) : null}

      <div className="order-card overflow-x-auto !p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-tint/50 text-muted">
            <tr>
              <th className="p-3 text-right font-medium">کد مشتری</th>
              <th className="p-3 text-right font-medium">نام</th>
              <th className="p-3 text-right font-medium">نام خانوادگی</th>
              <th className="p-3 text-right font-medium">موبایل</th>
              <th className="p-3 text-right font-medium">تاریخ تولد</th>
              <th className="p-3 text-right font-medium">سفارش</th>
              <th className="p-3 text-right font-medium">مجموع</th>
              <th className="p-3 text-right font-medium">آخرین سفارش</th>
              <th className="p-3 text-right font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <tr key={customer.id} className="border-t border-line/80 transition hover:bg-tint/30">
                <td className="p-3 font-bold">
                  <Link className="text-primary hover:underline" to={`/customers/${customer.id}`}>
                    {customer.customerCode ? toPersianDigits(customer.customerCode) : 'پروفایل'}
                  </Link>
                </td>
                <td className="p-3">
                  <Link className="hover:underline" to={`/customers/${customer.id}`}>
                    {customer.firstName || '—'}
                  </Link>
                </td>
                <td className="p-3">
                  <Link className="hover:underline" to={`/customers/${customer.id}`}>
                    {customer.lastName || '—'}
                  </Link>
                </td>
                <td className="p-3" dir="ltr">
                  {toPersianDigits(customer.phone)}
                </td>
                <td className="p-3">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {customer.birthDate ? toPersianDigits(customer.birthDate) : '—'}
                    {isBirthdayToday(customer.birthDate) ? (
                      <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold text-primary">امروز</span>
                    ) : null}
                  </span>
                </td>
                <td className="p-3">{toPersianDigits(customer.orderCount)}</td>
                <td className="p-3 font-medium text-primary">{formatPrice(customer.totalSpent)}</td>
                <td className="p-3 text-muted">{customer.lastOrderAt ? formatJalali(customer.lastOrderAt) : '—'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Link className="toolbar-chip !h-8 !px-3 text-xs font-bold" to={`/customers/${customer.id}`}>
                      پروفایل
                    </Link>
                    <button className="toolbar-chip !h-8 !px-3 text-xs font-bold" type="button" onClick={() => openEdit(customer)}>
                      ویرایش
                    </button>
                    <button
                      className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-bold text-white transition hover:brightness-110"
                      type="button"
                      onClick={() => {
                        setTarget(customer);
                        setTitle('پیام کافه جاوید');
                        setBody('');
                        setError('');
                      }}
                    >
                      اعلان
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!customers.isLoading && filtered.length === 0 ? (
              <tr>
                <td className="p-10 text-center text-muted" colSpan={9}>
                  عضوی پیدا نشد
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={onSubmitMember}
            className="w-full max-w-md rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]"
          >
            <h2 className="mb-1 text-lg font-bold">{formOpen === 'create' ? 'ثبت عضو باشگاه' : 'ویرایش عضو'}</h2>
            <p className="mb-4 text-sm text-muted">نام، نام خانوادگی، موبایل و تاریخ تولد شمسی</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted">نام</span>
                <input
                  className={fieldClass}
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">نام خانوادگی</span>
                <input
                  className={fieldClass}
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </label>
            </div>
            <label className="mb-3 mt-3 block text-sm">
              <span className="mb-1 block text-muted">موبایل</span>
              <input
                className={fieldClass}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
                dir="ltr"
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">تاریخ تولد شمسی</span>
              <JalaliDateInput
                value={form.birthDate}
                onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))}
                optional
                yearFrom={tehranJalaliToday().jy - 90}
                yearTo={tehranJalaliToday().jy}
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">
                کد مشتری {formOpen === 'create' ? '(اختیاری — خودکار ساخته می‌شود)' : ''}
              </span>
              <input
                className={fieldClass}
                value={form.customerCode}
                onChange={(e) => setForm((f) => ({ ...f, customerCode: e.target.value }))}
                placeholder="CJ-1001"
                dir="ltr"
                readOnly={formOpen === 'edit'}
              />
              {formOpen === 'edit' ? (
                <span className="mt-1 block text-xs text-muted">کد مشتری یکتاست و فقط خواندنی است</span>
              ) : null}
            </label>
            {formError ? <p className="mb-3 text-sm text-danger">{formError}</p> : null}
            <div className="flex gap-2">
              <button
                className="h-11 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
                type="submit"
                disabled={saveMember.isPending}
              >
                ذخیره
              </button>
              <button
                className="h-11 flex-1 rounded-btn border border-line"
                type="button"
                onClick={() => {
                  setFormOpen(null);
                  setEditing(null);
                }}
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {target ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={onSubmitNotify}
            className="w-full max-w-md rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]"
          >
            <h2 className="mb-1 text-lg font-bold">اعلان به مشتری</h2>
            <p className="mb-4 text-sm text-muted">
              {displayName(target)} — {toPersianDigits(target.phone)}
              {target.customerCode ? ` · ${toPersianDigits(target.customerCode)}` : ''}
            </p>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">عنوان</span>
              <input
                className={fieldClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">متن</span>
              <textarea
                className="min-h-24 w-full rounded-btn border border-line bg-white px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </label>
            {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <button
                className="h-11 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
                type="submit"
                disabled={send.isPending}
              >
                ارسال
              </button>
              <button className="h-11 flex-1 rounded-btn border border-line" type="button" onClick={() => setTarget(null)}>
                انصراف
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
