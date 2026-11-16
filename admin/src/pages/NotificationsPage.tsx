import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { JALAALI_MONTH_NAMES, formatJalali, toPersianDigits } from '../lib/format';

type Audience = 'ALL' | 'USER' | 'MULTI' | 'BIRTHDAY' | 'SPECIAL_DAY';
type Delivery = 'NOW' | 'RULE';

interface Campaign {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  delivery: Delivery;
  userId: string | null;
  userIds: string[];
  specialMonth: number | null;
  specialDay: number | null;
  active: boolean;
  lastRunOn: string | null;
  createdAt: string;
  recipientCount: number;
}

interface Customer {
  id: string;
  phone: string;
  name: string | null;
}

interface PreviewRecipients {
  count: number;
  users: { id: string; phone: string; name: string | null; birthDate: string | null }[];
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: 'همه مشتریان',
  USER: 'یک مشتری',
  MULTI: 'چند مشتری',
  BIRTHDAY: 'متولدین امروز',
  SPECIAL_DAY: 'روز خاص',
};

const DELIVERY_LABEL: Record<Delivery, string> = {
  NOW: 'ارسال فوری',
  RULE: 'قانون خودکار',
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const campaigns = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => api<Campaign[]>('/api/v1/admin/notifications'),
  });
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api<Customer[]>('/api/v1/admin/customers'),
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('ALL');
  const [delivery, setDelivery] = useState<Delivery>('NOW');
  const [userId, setUserId] = useState('');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [specialMonth, setSpecialMonth] = useState(1);
  const [specialDay, setSpecialDay] = useState(1);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<PreviewRecipients | null>(null);

  const customerOptions = useMemo(() => customers.data ?? [], [customers.data]);
  const rules = useMemo(
    () => (campaigns.data ?? []).filter((item) => item.delivery === 'RULE'),
    [campaigns.data],
  );
  const history = useMemo(
    () => (campaigns.data ?? []).filter((item) => item.delivery !== 'RULE'),
    [campaigns.data],
  );

  useEffect(() => {
    if (audience === 'BIRTHDAY' || audience === 'SPECIAL_DAY') {
      // keep delivery as chosen; RULE is allowed
    } else if (delivery === 'RULE') {
      setDelivery('NOW');
    }
  }, [audience, delivery]);

  const send = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          audience,
          delivery: audience === 'BIRTHDAY' || audience === 'SPECIAL_DAY' ? delivery : 'NOW',
          userId: audience === 'USER' ? userId : undefined,
          userIds: audience === 'MULTI' || audience === 'SPECIAL_DAY' ? userIds : undefined,
          specialMonth: audience === 'SPECIAL_DAY' ? specialMonth : undefined,
          specialDay: audience === 'SPECIAL_DAY' ? specialDay : undefined,
          active: delivery === 'RULE' ? true : undefined,
        }),
      }),
    onSuccess: async () => {
      setTitle('');
      setBody('');
      setAudience('ALL');
      setDelivery('NOW');
      setUserId('');
      setUserIds([]);
      setPreview(null);
      setMessage('اعلان ثبت شد');
      await queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/api/v1/admin/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  async function loadPreview() {
    setMessage('');
    try {
      const params = new URLSearchParams({ audience });
      if (audience === 'USER' && userId) params.set('userId', userId);
      if ((audience === 'MULTI' || audience === 'SPECIAL_DAY') && userIds.length) {
        params.set('userIds', userIds.join(','));
      }
      if (audience === 'SPECIAL_DAY') {
        params.set('specialMonth', String(specialMonth));
        params.set('specialDay', String(specialDay));
      }
      const result = await api<PreviewRecipients>(`/api/v1/admin/notifications/preview-recipients?${params}`);
      setPreview(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خطا در پیش‌نمایش');
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (audience === 'USER' && !userId) {
      setMessage('مشتری را انتخاب کنید');
      return;
    }
    if (audience === 'MULTI' && userIds.length === 0) {
      setMessage('حداقل یک مشتری انتخاب کنید');
      return;
    }
    send.mutate();
  }

  function toggleUser(id: string) {
    setUserIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const showDelivery = audience === 'BIRTHDAY' || audience === 'SPECIAL_DAY';

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={onSubmit} className="rounded-card bg-white p-4">
        <h1 className="mb-4 text-[22px] font-bold">ارسال اعلان</h1>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">عنوان</span>
          <input className="h-12 w-full rounded-btn border border-line px-3" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">متن</span>
          <textarea
            className="min-h-28 w-full rounded-btn border border-line px-3 py-3"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="می‌توانید از %name برای نام مشتری استفاده کنید"
            required
          />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">مخاطب</span>
          <select
            className="h-12 w-full rounded-btn border border-line px-3"
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
          >
            <option value="ALL">همه مشتریان</option>
            <option value="USER">یک مشتری</option>
            <option value="MULTI">چند مشتری</option>
            <option value="BIRTHDAY">تولد</option>
            <option value="SPECIAL_DAY">روز خاص</option>
          </select>
        </label>

        {showDelivery ? (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">نحوه ارسال</span>
            <select
              className="h-12 w-full rounded-btn border border-line px-3"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value as Delivery)}
            >
              <option value="NOW">
                {audience === 'BIRTHDAY' ? 'همین حالا به متولدین امروز' : 'ارسال فوری (اگر امروز همان روز است)'}
              </option>
              <option value="RULE">قانون خودکار سالانه</option>
            </select>
          </label>
        ) : null}

        {audience === 'USER' ? (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted">مشتری</span>
            <select className="h-12 w-full rounded-btn border border-line px-3" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">انتخاب کنید</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {(customer.name || 'بدون نام') + ' — ' + customer.phone}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {audience === 'MULTI' || audience === 'SPECIAL_DAY' ? (
          <fieldset className="mb-3">
            <legend className="mb-1 text-sm text-muted">
              {audience === 'SPECIAL_DAY' ? 'محدود به این مشتریان (اختیاری)' : 'انتخاب مشتریان'}
            </legend>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-btn border border-line p-2">
              {customerOptions.map((customer) => (
                <label key={customer.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={userIds.includes(customer.id)} onChange={() => toggleUser(customer.id)} />
                  <span>
                    {(customer.name || 'بدون نام') + ' — ' + customer.phone}
                  </span>
                </label>
              ))}
              {customerOptions.length === 0 ? <p className="text-xs text-muted">مشتری‌ای ثبت نشده.</p> : null}
            </div>
          </fieldset>
        ) : null}

        {audience === 'SPECIAL_DAY' ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">ماه شمسی</span>
              <select
                className="h-12 w-full rounded-btn border border-line px-3"
                value={specialMonth}
                onChange={(e) => setSpecialMonth(Number(e.target.value) || 1)}
                required
              >
                {JALAALI_MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">روز شمسی</span>
              <select
                className="h-12 w-full rounded-btn border border-line px-3"
                value={specialDay}
                onChange={(e) => setSpecialDay(Number(e.target.value) || 1)}
                required
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {toPersianDigits(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="mb-3 flex gap-2">
          <button type="button" className="h-11 flex-1 rounded-btn border border-line text-sm" onClick={() => void loadPreview()}>
            پیش‌نمایش مخاطبان
          </button>
        </div>
        {preview ? (
          <p className="mb-3 rounded-btn bg-tint px-3 py-2 text-sm">
            {toPersianDigits(preview.count)} مخاطب
            {preview.users.slice(0, 3).map((u) => ` · ${u.name || u.phone}`).join('')}
            {preview.count > 3 ? '…' : ''}
          </p>
        ) : null}

        {message ? <p className="mb-3 text-sm">{message}</p> : null}
        <button className="h-12 w-full rounded-btn bg-primary font-bold text-white" type="submit" disabled={send.isPending}>
          {delivery === 'RULE' && showDelivery ? 'ذخیره قانون' : 'ارسال'}
        </button>
      </form>

      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-[22px] font-bold">قوانین خودکار</h2>
          <div className="space-y-3">
            {rules.map((item) => (
              <article key={item.id} className="rounded-card bg-white p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold">{item.title}</h3>
                  <button
                    className={`h-9 rounded-full px-3 text-xs font-bold ${item.active ? 'bg-primary text-white' : 'bg-sand text-ink'}`}
                    onClick={() => toggleRule.mutate({ id: item.id, active: !item.active })}
                    disabled={toggleRule.isPending}
                  >
                    {item.active ? 'فعال' : 'غیرفعال'}
                  </button>
                </div>
                <p className="mb-2 text-sm text-muted">{item.body}</p>
                <p className="text-xs text-muted">
                  {AUDIENCE_LABEL[item.audience]} · {DELIVERY_LABEL.RULE}
                  {item.audience === 'SPECIAL_DAY' && item.specialMonth && item.specialDay
                    ? ` · ${JALAALI_MONTH_NAMES[item.specialMonth - 1] ?? toPersianDigits(item.specialMonth)} ${toPersianDigits(item.specialDay)}`
                    : ''}
                  {item.lastRunOn
                    ? ` · آخرین اجرا ${/^\d{4}-\d{2}-\d{2}/.test(item.lastRunOn) ? formatJalali(`${item.lastRunOn}T12:00:00+03:30`).split(' ')[0] : toPersianDigits(item.lastRunOn)}`
                    : ''}
                  {` · ${toPersianDigits(item.recipientCount)} ارسال`}
                </p>
              </article>
            ))}
            {!campaigns.isLoading && rules.length === 0 ? (
              <p className="text-sm text-muted">هنوز قانون خودکاری ثبت نشده.</p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-bold">تاریخچه ارسال</h2>
          {campaigns.isError ? <button onClick={() => campaigns.refetch()}>تلاش دوباره</button> : null}
          <div className="space-y-3">
            {history.map((item) => (
              <article key={item.id} className="rounded-card bg-white p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h3 className="font-bold">{item.title}</h3>
                  <span className="text-xs text-muted">{formatJalali(item.createdAt)}</span>
                </div>
                <p className="mb-2 text-sm text-muted">{item.body}</p>
                <p className="text-xs text-muted">
                  {AUDIENCE_LABEL[item.audience] || item.audience} · {toPersianDigits(item.recipientCount)} نفر
                </p>
              </article>
            ))}
            {!campaigns.isLoading && history.length === 0 ? (
              <p className="text-sm text-muted">هنوز اعلانی ارسال نشده.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
