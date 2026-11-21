import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { JalaliDateInput } from '../components/JalaliDateInput';
import { Stat } from '../components/Stat';
import {
  formatJalali,
  formatPrice,
  gregorianToJalaliInput,
  parseJalaliInput,
  tehranJalaliToday,
  tehranToday,
  toPersianDigits,
} from '../lib/format';

interface CustomerProfile {
  id: string;
  phone: string;
  customerCode: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  orderCount: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderAt: string | null;
  createdAt: string | null;
  addressCount: number;
}

interface CustomerSummary {
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  topProducts: { name: string; quantity: number; amount: number }[];
  hourly: { hour: number; count: number }[];
  fulfillment: Record<string, number>;
  discountTotal: number;
}

interface CustomerOrderRow {
  id: string;
  number: number;
  status: string;
  fulfillment: string;
  total: number;
  discountAmount: number;
  discountCode: string | null;
  createdAt: string;
  itemCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'جدید',
  PREPARING: 'آماده‌سازی',
  READY: 'آماده',
  OUT_FOR_DELIVERY: 'ارسال',
  DELIVERED: 'تحویل',
  CANCELLED: 'لغو',
};

const FULFILLMENT_LABEL: Record<string, string> = {
  DELIVERY: 'ارسال',
  PICKUP: 'حضوری',
  DINE_IN: 'داخل سالن',
};

function shift(days: number) {
  const date = new Date(`${tehranToday()}T12:00:00+03:30`);
  date.setDate(date.getDate() - days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function displayName(c: Pick<CustomerProfile, 'firstName' | 'lastName' | 'name'>) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || 'بدون نام';
}

function isBirthdayToday(birthDate: string | null) {
  if (!birthDate?.trim()) return false;
  const parsed = parseJalaliInput(birthDate);
  if (!parsed) return false;
  const today = tehranJalaliToday();
  return parsed.jm === today.jm && parsed.jd === today.jd;
}

export function CustomerProfilePage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<'today' | '7' | '30'>('30');
  const [activeHour, setActiveHour] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState('پیام کافه جاوید');
  const [notifBody, setNotifBody] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
  });

  const to = tehranToday();
  const from = range === 'today' ? to : shift(range === '7' ? 6 : 29);

  const profile = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api<CustomerProfile>(`/api/v1/admin/customers/${id}`),
    enabled: Boolean(id),
  });
  const summary = useQuery({
    queryKey: ['customer-summary', id, from, to],
    queryFn: () => api<CustomerSummary>(`/api/v1/admin/customers/${id}/summary?from=${from}&to=${to}`),
    enabled: Boolean(id),
  });
  const orders = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: () => api<CustomerOrderRow[]>(`/api/v1/admin/customers/${id}/orders?limit=40`),
    enabled: Boolean(id),
  });

  const hourly = summary.data?.hourly ?? [];
  const max = Math.max(1, ...hourly.map((item) => item.count));
  const selected = activeHour == null ? null : hourly.find((item) => item.hour === activeHour) ?? null;

  const fulfillmentLines = useMemo(() => {
    const data = summary.data?.fulfillment ?? {};
    return Object.entries(data)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${FULFILLMENT_LABEL[key] || key}: ${toPersianDigits(count)}`);
  }, [summary.data]);

  const update = useMutation({
    mutationFn: () =>
      api(`/api/v1/admin/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          phone: form.phone.trim(),
          birthDate: form.birthDate.trim() || null,
        }),
      }),
    onSuccess: async () => {
      setEditOpen(false);
      setMessage('پروفایل به‌روز شد');
      await queryClient.invalidateQueries({ queryKey: ['customer', id] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const sendNotif = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody,
          audience: 'USER',
          userId: id,
        }),
      }),
    onSuccess: () => {
      setNotifOpen(false);
      setNotifBody('');
      setMessage('اعلان ارسال شد');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function openEdit() {
    if (!profile.data) return;
    setForm({
      firstName: profile.data.firstName || '',
      lastName: profile.data.lastName || '',
      phone: profile.data.phone,
      birthDate: profile.data.birthDate || '',
    });
    setFormError('');
    setEditOpen(true);
  }

  function onSubmitEdit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!form.phone.trim()) {
      setFormError('موبایل الزامی است');
      return;
    }
    update.mutate();
  }

  if (profile.isError) {
    return (
      <div className="panel-page">
        <Link to="/customers" className="mb-4 inline-block text-sm text-primary">
          ← بازگشت به باشگاه
        </Link>
        <p className="text-muted">مشتری پیدا نشد.</p>
        <button type="button" className="mt-3 text-sm text-primary" onClick={() => profile.refetch()}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  const customer = profile.data;

  const fieldClass =
    'h-11 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

  const statusChip = (status: string) => {
    if (status === 'CANCELLED') return 'bg-[var(--color-danger-soft)] text-danger';
    if (status === 'DELIVERED') return 'bg-tint text-primary';
    if (status === 'NEW') return 'bg-accent/70 text-ink';
    return 'bg-sand text-ink';
  };

  return (
    <div className="panel-page">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/customers" className="mb-2 inline-block text-sm font-medium text-primary hover:underline">
            ← بازگشت به باشگاه
          </Link>
          <h1 className="panel-title">{customer ? displayName(customer) : 'در حال بارگذاری…'}</h1>
          {customer ? (
            <p className="panel-subtitle flex flex-wrap items-center gap-2">
              <span>{customer.customerCode ? toPersianDigits(customer.customerCode) : 'بدون کد'}</span>
              <span>·</span>
              <span dir="ltr">{toPersianDigits(customer.phone)}</span>
              {customer.birthDate ? (
                <>
                  <span>·</span>
                  <span>تولد {toPersianDigits(customer.birthDate)}</span>
                </>
              ) : null}
              {isBirthdayToday(customer.birthDate) ? (
                <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold text-primary">امروز تولدش است</span>
              ) : null}
            </p>
          ) : null}
        </div>
        {customer ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="toolbar-chip" onClick={openEdit}>
              ویرایش
            </button>
            <button
              type="button"
              className="h-10 rounded-full bg-primary px-4 text-sm font-bold text-white transition hover:brightness-110"
              onClick={() => {
                setNotifTitle('پیام کافه جاوید');
                setNotifBody('');
                setFormError('');
                setNotifOpen(true);
              }}
            >
              اعلان
            </button>
          </div>
        ) : null}
      </header>

      {message ? (
        <p className="mb-4 rounded-2xl border border-primary/20 bg-tint px-3 py-2 text-sm text-primary">{message}</p>
      ) : null}

      {customer ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="کل سفارش‌ها" value={toPersianDigits(customer.orderCount)} />
          <Stat label="مجموع خرید" value={formatPrice(customer.totalSpent)} />
          <Stat label="میانگین سفارش" value={formatPrice(customer.averageOrderValue)} />
          <Stat label="آخرین سفارش" value={customer.lastOrderAt ? formatJalali(customer.lastOrderAt) : '—'} />
        </div>
      ) : null}

      {customer ? (
        <div className="order-card mb-6 !p-4 text-sm">
          <h2 className="mb-2 text-sm font-bold text-primary/90">اطلاعات عضو</h2>
          <div className="grid gap-2 text-muted sm:grid-cols-2">
            <div>عضویت از: {customer.createdAt ? formatJalali(customer.createdAt) : '—'}</div>
            <div>تعداد آدرس: {toPersianDigits(customer.addressCount)}</div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">تحلیل سفارش‌ها</h2>
          <p className="text-xs text-muted">
            بازه شمسی: {gregorianToJalaliInput(from)}
            {from !== to ? ` تا ${gregorianToJalaliInput(to)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([['today', 'امروز'], ['7', '۷ روز'], ['30', '۳۰ روز']] as const).map(([idKey, label]) => (
            <button
              key={idKey}
              type="button"
              className={`toolbar-chip ${range === idKey ? 'toolbar-chip-on' : ''}`}
              onClick={() => setRange(idKey)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {summary.isError ? (
        <button type="button" className="toolbar-chip mb-3 text-primary" onClick={() => summary.refetch()}>
          خطا در خلاصه — تلاش دوباره
        </button>
      ) : null}

      {summary.data ? (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <Stat label="فروش بازه" value={formatPrice(summary.data.totalSales)} />
            <Stat label="سفارش بازه" value={toPersianDigits(summary.data.orderCount)} />
            <Stat label="تخفیف استفاده‌شده" value={formatPrice(summary.data.discountTotal)} />
          </div>
          {fulfillmentLines.length ? (
            <p className="mb-4 text-sm text-muted">نوع تحویل: {fulfillmentLines.join(' · ')}</p>
          ) : null}

          <h2 className="mb-2 text-[15px] font-bold">محصولات پرتکرار</h2>
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
                {summary.data.topProducts.map((item) => (
                  <tr key={item.name} className="border-t border-line/80 hover:bg-tint/30">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{toPersianDigits(item.quantity)}</td>
                    <td className="p-3 font-medium text-primary">{formatPrice(item.amount)}</td>
                  </tr>
                ))}
                {summary.data.topProducts.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-muted" colSpan={3}>
                      در این بازه سفارشی نیست
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
          <div className="board-column mb-8 bg-white/80 p-3" dir="ltr">
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
          </div>
        </>
      ) : null}

      <h2 className="mb-3 text-[15px] font-bold">تاریخچه سفارش‌ها</h2>
      <div className="order-card overflow-x-auto !p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-tint/50 text-muted">
            <tr>
              <th className="p-3 text-right font-medium">شماره</th>
              <th className="p-3 text-right font-medium">تاریخ</th>
              <th className="p-3 text-right font-medium">وضعیت</th>
              <th className="p-3 text-right font-medium">تحویل</th>
              <th className="p-3 text-right font-medium">اقلام</th>
              <th className="p-3 text-right font-medium">مبلغ</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data ?? []).map((order) => (
              <tr key={order.id} className="border-t border-line/80 hover:bg-tint/30">
                <td className="p-3 font-bold">{toPersianDigits(order.number)}</td>
                <td className="p-3 text-muted">{formatJalali(order.createdAt)}</td>
                <td className="p-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusChip(order.status)}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </td>
                <td className="p-3">{FULFILLMENT_LABEL[order.fulfillment] || order.fulfillment}</td>
                <td className="p-3">{toPersianDigits(order.itemCount)}</td>
                <td className="p-3 font-medium text-primary">
                  {formatPrice(order.total)}
                  {order.discountAmount > 0 ? (
                    <div className="text-xs font-normal text-muted">تخفیف {formatPrice(order.discountAmount)}</div>
                  ) : null}
                </td>
              </tr>
            ))}
            {!orders.isLoading && (orders.data ?? []).length === 0 ? (
              <tr>
                <td className="p-8 text-center text-muted" colSpan={6}>
                  سفارشی ثبت نشده
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={onSubmitEdit}
            className="w-full max-w-md rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]"
          >
            <h2 className="mb-4 text-lg font-bold">ویرایش عضو</h2>
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
            {formError ? <p className="mb-3 text-sm text-danger">{formError}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-11 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
                disabled={update.isPending}
              >
                ذخیره
              </button>
              <button type="button" className="h-11 flex-1 rounded-btn border border-line" onClick={() => setEditOpen(false)}>
                بستن
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {notifOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <form
            className="w-full max-w-md rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError('');
              if (!notifBody.trim()) {
                setFormError('متن اعلان را وارد کنید');
                return;
              }
              sendNotif.mutate();
            }}
          >
            <h2 className="mb-4 text-lg font-bold">ارسال اعلان</h2>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">عنوان</span>
              <input className={fieldClass} value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} required />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">متن</span>
              <textarea
                className="min-h-24 w-full rounded-btn border border-line bg-white px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                required
              />
            </label>
            {formError ? <p className="mb-3 text-sm text-danger">{formError}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-11 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
                disabled={sendNotif.isPending}
              >
                ارسال
              </button>
              <button type="button" className="h-11 flex-1 rounded-btn border border-line" onClick={() => setNotifOpen(false)}>
                بستن
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
