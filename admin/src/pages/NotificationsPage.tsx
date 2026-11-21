import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { JALAALI_MONTH_NAMES, formatJalali, toPersianDigits } from '../lib/format';

type Audience = 'ALL' | 'USER' | 'MULTI' | 'BIRTHDAY' | 'SPECIAL_DAY';
type Delivery = 'NOW' | 'RULE';
type RuleKind = 'CALENDAR' | 'INTERVAL';
type IntervalUnit = 'HOURS' | 'DAYS' | 'WEEKS';
type SendMode = 'NOW' | 'INTERVAL' | 'CALENDAR';

interface Campaign {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  delivery: Delivery;
  ruleKind: RuleKind;
  intervalUnit: IntervalUnit | null;
  intervalValue: number | null;
  userId: string | null;
  userIds: string[];
  specialMonth: number | null;
  specialDay: number | null;
  active: boolean;
  lastRunOn: string | null;
  lastRunAt: string | null;
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

const INTERVAL_LABEL: Record<IntervalUnit, string> = {
  HOURS: 'ساعت',
  DAYS: 'روز',
  WEEKS: 'هفته',
};

function intervalSummary(unit: IntervalUnit | null, value: number | null) {
  if (!unit || !value) return '';
  return `هر ${toPersianDigits(value)} ${INTERVAL_LABEL[unit]}`;
}

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
  const [sendMode, setSendMode] = useState<SendMode>('NOW');
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('DAYS');
  const [intervalValue, setIntervalValue] = useState('7');
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

  const calendarAudience = audience === 'BIRTHDAY' || audience === 'SPECIAL_DAY';
  const intervalAudience = audience === 'ALL' || audience === 'USER' || audience === 'MULTI';

  useEffect(() => {
    if (sendMode === 'INTERVAL' && !intervalAudience) setSendMode('NOW');
    if (sendMode === 'CALENDAR' && !calendarAudience) setSendMode('NOW');
  }, [audience, sendMode, intervalAudience, calendarAudience]);

  const send = useMutation({
    mutationFn: () => {
      const delivery: Delivery = sendMode === 'NOW' ? 'NOW' : 'RULE';
      const ruleKind: RuleKind = sendMode === 'INTERVAL' ? 'INTERVAL' : 'CALENDAR';
      const value = Number(intervalValue);
      return api('/api/v1/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          audience,
          delivery,
          ruleKind: delivery === 'RULE' ? ruleKind : undefined,
          intervalUnit: sendMode === 'INTERVAL' ? intervalUnit : undefined,
          intervalValue: sendMode === 'INTERVAL' ? value : undefined,
          userId: audience === 'USER' ? userId : undefined,
          userIds: audience === 'MULTI' || audience === 'SPECIAL_DAY' ? userIds : undefined,
          specialMonth: audience === 'SPECIAL_DAY' ? specialMonth : undefined,
          specialDay: audience === 'SPECIAL_DAY' ? specialDay : undefined,
          active: delivery === 'RULE' ? true : undefined,
        }),
      });
    },
    onSuccess: async () => {
      setTitle('');
      setBody('');
      setAudience('ALL');
      setSendMode('NOW');
      setIntervalUnit('DAYS');
      setIntervalValue('7');
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
    if (sendMode === 'INTERVAL') {
      const value = Number(intervalValue);
      if (!Number.isFinite(value) || value < 1) {
        setMessage('فاصله تکرار باید حداقل ۱ باشد');
        return;
      }
    }
    send.mutate();
  }

  function toggleUser(id: string) {
    setUserIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const fieldClass =
    'h-12 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

  return (
    <div className="panel-page">
      <header className="mb-6">
        <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
        <h1 className="panel-title">اعلان‌ها</h1>
        <p className="panel-subtitle">
          {toPersianDigits(rules.length)} قانون خودکار · {toPersianDigits(history.length)} ارسال در تاریخچه
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={onSubmit} className="board-column bg-white/85 !p-4">
          <h2 className="mb-3 text-sm font-bold text-primary/90">ارسال اعلان</h2>
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
              className="min-h-28 w-full rounded-btn border border-line bg-white px-3 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="می‌توانید از %name برای نام مشتری استفاده کنید"
              required
            />
          </label>

          <div className="order-card mb-3 !p-3 !shadow-none">
            <p className="mb-2 text-xs font-medium text-primary/80">مخاطب و زمان‌بندی</p>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">مخاطب</span>
              <select className={fieldClass} value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                <option value="ALL">همه مشتریان</option>
                <option value="USER">یک مشتری</option>
                <option value="MULTI">چند مشتری</option>
                <option value="BIRTHDAY">تولد</option>
                <option value="SPECIAL_DAY">روز خاص</option>
              </select>
            </label>
            <label className="mb-0 block text-sm">
              <span className="mb-1 block text-muted">نحوه ارسال</span>
              <select className={fieldClass} value={sendMode} onChange={(e) => setSendMode(e.target.value as SendMode)}>
                <option value="NOW">{audience === 'BIRTHDAY' ? 'همین حالا به متولدین امروز' : 'ارسال فوری'}</option>
                {intervalAudience ? <option value="INTERVAL">تکرار دوره‌ای</option> : null}
                {calendarAudience ? <option value="CALENDAR">قانون خودکار سالانه</option> : null}
              </select>
            </label>
          </div>

          {sendMode === 'INTERVAL' ? (
            <div className="mb-3 grid grid-cols-[1fr_1.2fr] gap-2 rounded-2xl border border-line/70 bg-tint/30 p-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted">هر چند</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className={fieldClass}
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">واحد فاصله</span>
                <select
                  className={fieldClass}
                  value={intervalUnit}
                  onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                >
                  <option value="HOURS">ساعت</option>
                  <option value="DAYS">روز</option>
                  <option value="WEEKS">هفته</option>
                </select>
              </label>
              <p className="col-span-2 text-xs text-muted">
                مثلاً هر ۷ روز یک‌بار برای همه ارسال می‌شود. اولین ارسال بلافاصله انجام می‌گیرد.
              </p>
            </div>
          ) : null}

          {audience === 'USER' ? (
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">مشتری</span>
              <select className={fieldClass} value={userId} onChange={(e) => setUserId(e.target.value)} required>
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
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-line/80 bg-tint/30 p-2">
                {customerOptions.map((customer) => (
                  <label key={customer.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-white/70">
                    <input type="checkbox" checked={userIds.includes(customer.id)} onChange={() => toggleUser(customer.id)} />
                    <span>{(customer.name || 'بدون نام') + ' — ' + customer.phone}</span>
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
                  className={fieldClass}
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
                  className={fieldClass}
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

          <button type="button" className="toolbar-chip mb-3 w-full justify-center" onClick={() => void loadPreview()}>
            پیش‌نمایش مخاطبان
          </button>
          {preview ? (
            <p className="mb-3 rounded-2xl border border-primary/20 bg-tint px-3 py-2 text-sm">
              {toPersianDigits(preview.count)} مخاطب
              {preview.users.slice(0, 3).map((u) => ` · ${u.name || u.phone}`).join('')}
              {preview.count > 3 ? '…' : ''}
            </p>
          ) : null}

          {message ? (
            <p className="mb-3 rounded-2xl border border-primary/20 bg-tint px-3 py-2 text-sm text-primary">{message}</p>
          ) : null}
          <button
            className="h-12 w-full rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
            type="submit"
            disabled={send.isPending}
          >
            {sendMode === 'NOW' ? 'ارسال' : 'ذخیره قانون'}
          </button>
        </form>

        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-[15px] font-bold">قوانین خودکار</h2>
            <div className="space-y-3">
              {rules.map((item) => (
                <article
                  key={item.id}
                  className={`order-card !p-4 ${item.active ? 'border-primary/20' : ''}`}
                >
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold">{item.title}</h3>
                    <button
                      className={`h-9 rounded-full px-3 text-xs font-bold transition ${
                        item.active ? 'bg-primary text-white hover:brightness-110' : 'bg-sand text-ink'
                      }`}
                      onClick={() => toggleRule.mutate({ id: item.id, active: !item.active })}
                      disabled={toggleRule.isPending}
                    >
                      {item.active ? 'فعال' : 'غیرفعال'}
                    </button>
                  </div>
                  <p className="mb-2 text-sm text-muted">{item.body}</p>
                  <p className="text-xs text-muted">
                    {AUDIENCE_LABEL[item.audience]}
                    {item.ruleKind === 'INTERVAL'
                      ? ` · تکرار دوره‌ای · ${intervalSummary(item.intervalUnit, item.intervalValue)}`
                      : ' · قانون تقویمی'}
                    {item.audience === 'SPECIAL_DAY' && item.specialMonth && item.specialDay
                      ? ` · ${JALAALI_MONTH_NAMES[item.specialMonth - 1] ?? toPersianDigits(item.specialMonth)} ${toPersianDigits(item.specialDay)}`
                      : ''}
                    {item.lastRunAt
                      ? ` · آخرین اجرا ${formatJalali(item.lastRunAt)}`
                      : item.lastRunOn
                        ? ` · آخرین اجرا ${/^\d{4}-\d{2}-\d{2}/.test(item.lastRunOn) ? formatJalali(`${item.lastRunOn}T12:00:00+03:30`).split(' ')[0] : toPersianDigits(item.lastRunOn)}`
                        : ''}
                    {` · ${toPersianDigits(item.recipientCount)} ارسال`}
                  </p>
                </article>
              ))}
              {!campaigns.isLoading && rules.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-muted">
                  هنوز قانون خودکاری ثبت نشده.
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-bold">تاریخچه ارسال</h2>
            {campaigns.isError ? (
              <button type="button" className="toolbar-chip mb-3 text-primary" onClick={() => campaigns.refetch()}>
                تلاش دوباره
              </button>
            ) : null}
            <div className="space-y-3">
              {history.map((item) => (
                <article key={item.id} className="order-card !p-4">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h3 className="font-bold">{item.title}</h3>
                    <span className="rounded-full bg-tint/80 px-2 py-0.5 text-[11px] text-muted">
                      {formatJalali(item.createdAt)}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-muted">{item.body}</p>
                  <p className="text-xs text-muted">
                    {AUDIENCE_LABEL[item.audience] || item.audience} · {toPersianDigits(item.recipientCount)} نفر
                  </p>
                </article>
              ))}
              {!campaigns.isLoading && history.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-muted">
                  هنوز اعلانی ارسال نشده.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
