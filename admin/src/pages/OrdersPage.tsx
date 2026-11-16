import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, api, loadSession, type Order, type Settings } from '../api';
import { Receipt } from '../components/Receipt';
import { JalaliDateInput } from '../components/JalaliDateInput';
import {
  formatPrice,
  gregorianToJalaliInput,
  jalaliInputToGregorianYmd,
  tehranJalaliToday,
  tehranTime,
  tehranToday,
  toPersianDigits,
} from '../lib/format';

const NEXT: Record<string, { label: string; to: string } | ((order: Order) => { label: string; to: string })> = {
  NEW: { label: 'شروع آماده‌سازی', to: 'PREPARING' },
  PREPARING: { label: 'آماده شد', to: 'READY' },
  OUT_FOR_DELIVERY: { label: 'تحویل داده شد', to: 'DELIVERED' },
};

const ETA_OPTIONS = [15, 25, 40] as const;
const TIMER_YELLOW_MS = 10 * 60 * 1000;
const TIMER_RED_MS = 20 * 60 * 1000;

function nextAction(order: Order) {
  if (order.status === 'READY') {
    return order.fulfillment === 'DELIVERY'
      ? { label: 'تحویل به پیک', to: 'OUT_FOR_DELIVERY' }
      : { label: 'تحویل به مشتری', to: 'DELIVERED' };
  }
  const value = NEXT[order.status];
  return typeof value === 'function' ? value(order) : value;
}

const FULFILL: Record<string, string> = {
  DELIVERY: 'ارسال با پیک',
  PICKUP: 'تحویل حضوری',
  DINE_IN: 'داخل کافه',
};

function beep() {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
  osc.onended = () => void ctx.close();
}

function summary(order: Order) {
  return order.items.map((item) => `${toPersianDigits(item.quantity)}× ${item.productName}`).join('، ');
}

/** Stuck-clock: NEW uses createdAt; PREPARING uses updatedAt as status-enter proxy. */
function stuckSince(order: Order) {
  if (order.status === 'NEW') return order.createdAt;
  if (order.status === 'PREPARING') return order.updatedAt;
  return null;
}

type TimerLevel = 'ok' | 'warn' | 'late' | null;

function timerLevel(order: Order, now: number): TimerLevel {
  const since = stuckSince(order);
  if (!since) return null;
  const elapsed = now - new Date(since).getTime();
  if (elapsed >= TIMER_RED_MS) return 'late';
  if (elapsed >= TIMER_YELLOW_MS) return 'warn';
  return 'ok';
}

function timerStyle(level: TimerLevel): CSSProperties | undefined {
  if (!level) return undefined;
  const color = level === 'ok' ? 'var(--timer-ok)' : level === 'warn' ? 'var(--timer-warn)' : 'var(--timer-late)';
  const bg =
    level === 'ok'
      ? 'color-mix(in srgb, var(--color-tint) 70%, white)'
      : level === 'warn'
        ? 'color-mix(in srgb, var(--color-sand) 80%, white)'
        : 'var(--color-danger-soft)';
  return {
    borderColor: color,
    borderRightWidth: 4,
    background: bg,
  };
}

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [soundOn, setSoundOn] = useState(localStorage.getItem('cafe-sound') !== '0');
  const [printOn, setPrintOn] = useState(localStorage.getItem('cafe-print') !== '0');
  const [down, setDown] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [enRouteOpen, setEnRouteOpen] = useState(false);
  const [day, setDay] = useState(tehranToday);
  const [etaOrder, setEtaOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [, setBoardTick] = useState(0);
  const isToday = day === tehranToday();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const ordersQuery = useQuery({
    queryKey: ['orders', day],
    queryFn: () => api<Order[]>(`/api/v1/admin/orders?date=${day}`),
  });
  const settingsQuery = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Settings>('/api/v1/config'),
  });

  useEffect(() => {
    const token = loadSession()?.accessToken;
    if (!token) return;
    if (token === 'preview-token') {
      setDown(false);
      return;
    }
    let source: EventSource | null = null;
    let timer: number | undefined;
    const connect = () => {
      source = new EventSource(`${API_URL}/api/v1/admin/orders/stream?token=${encodeURIComponent(token)}`);
      source.onopen = () => setDown(false);
      source.onerror = () => {
        setDown(true);
        source?.close();
        timer = window.setTimeout(connect, 2000);
      };
      const onEvent = (event: MessageEvent, created: boolean) => {
        const order = JSON.parse(event.data) as Order;
        queryClient.setQueryData<Order[]>(['orders', day], (current = []) => {
          const rest = current.filter((item) => item.id !== order.id);
          return [order, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
        if (created) {
          if (localStorage.getItem('cafe-sound') !== '0') beep();
          setFlash(order.id);
          window.setTimeout(() => setFlash((id) => (id === order.id ? null : id)), 5000);
          if (localStorage.getItem('cafe-print') !== '0') {
            setPrintOrder(order);
            window.setTimeout(() => window.print(), 200);
          }
        }
      };
      source.addEventListener('order.created', (event) => onEvent(event as MessageEvent, true));
      source.addEventListener('order.updated', (event) => onEvent(event as MessageEvent, false));
    };
    connect();
    return () => {
      source?.close();
      if (timer) window.clearTimeout(timer);
    };
  }, [day, queryClient]);

  const orders = ordersQuery.data ?? [];
  const active = orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length;
  const columns = useMemo(
    () => [
      { key: 'NEW', title: 'جدید', items: orders.filter((order) => order.status === 'NEW') },
      { key: 'PREPARING', title: 'در حال آماده‌سازی', items: orders.filter((order) => order.status === 'PREPARING') },
      { key: 'READY', title: 'آماده‌ی تحویل', items: orders.filter((order) => order.status === 'READY') },
    ],
    [orders],
  );

  async function move(order: Order, toStatus: string, estimatedMinutes?: number) {
    const reason = toStatus === 'CANCELLED' ? window.prompt('دلیل لغو سفارش') || undefined : undefined;
    if (toStatus === 'CANCELLED' && !reason) return;
    try {
      const updated = await api<Order>(`/api/v1/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ toStatus, reason, estimatedMinutes }),
      });
      const safe: Order =
        updated && typeof updated === 'object' && typeof updated.id === 'string' && typeof updated.status === 'string'
          ? {
              ...order,
              ...updated,
              status: updated.status || toStatus,
              estimatedMinutes:
                updated.estimatedMinutes !== undefined ? updated.estimatedMinutes : estimatedMinutes ?? order.estimatedMinutes,
              updatedAt: updated.updatedAt || new Date().toISOString(),
              createdAt: updated.createdAt || order.createdAt,
            }
          : {
              ...order,
              status: toStatus,
              estimatedMinutes: estimatedMinutes ?? order.estimatedMinutes,
              cancelReason: toStatus === 'CANCELLED' ? reason ?? order.cancelReason : order.cancelReason,
              updatedAt: new Date().toISOString(),
            };
      queryClient.setQueryData<Order[]>(['orders', day], (current = []) => {
        const rest = current.filter((item) => item.id !== safe.id);
        return [safe, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      // Force a commit: some preview/HMR paths update the cache without notifying observers.
      setBoardTick((n) => n + 1);
    } catch (err) {
      console.error('order status update failed', err);
      window.alert('به‌روزرسانی وضعیت سفارش انجام نشد');
    }
  }

  function requestMove(order: Order, toStatus: string) {
    if (order.status === 'NEW' && toStatus === 'PREPARING') {
      setEtaOrder(order);
      return;
    }
    void move(order, toStatus);
  }

  return (
    <div className="p-6">
      {down ? <div className="mb-3 rounded-btn bg-sand px-4 py-2 text-sm">اتصال قطع شد</div> : null}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold">{isToday ? 'سفارش‌های امروز' : 'سفارش‌ها'}</h1>
          <p className="text-sm text-muted">
            {toPersianDigits(orders.length)} سفارش ثبت شده · {toPersianDigits(active)} سفارش فعال
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm">
            <span className="text-muted shrink-0">تاریخ شمسی</span>
            <JalaliDateInput
              compact
              value={gregorianToJalaliInput(day)}
              onChange={(jalali) => {
                const ymd = jalaliInputToGregorianYmd(jalali);
                if (ymd) setDay(ymd);
              }}
              yearFrom={tehranJalaliToday().jy - 3}
              yearTo={tehranJalaliToday().jy + 1}
            />
          </label>
          {!isToday ? (
            <button className="h-10 rounded-full border border-line bg-white px-4 text-sm" onClick={() => setDay(tehranToday())}>
              امروز
            </button>
          ) : null}
          <button
            className="h-10 rounded-full border border-line bg-white px-4 text-sm"
            onClick={() => {
              const next = !printOn;
              setPrintOn(next);
              localStorage.setItem('cafe-print', next ? '1' : '0');
            }}
          >
            چاپ خودکار فیش {printOn ? 'روشن است' : 'خاموش است'}
          </button>
          <button
            className="h-10 rounded-full border border-line bg-white px-4 text-sm"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem('cafe-sound', next ? '1' : '0');
            }}
          >
            صدای اعلان {soundOn ? 'روشن است' : 'خاموش است'}
          </button>
        </div>
      </header>
      {ordersQuery.isError ? (
        <button className="mb-4 rounded-btn bg-primary px-4 py-2 text-white" onClick={() => ordersQuery.refetch()}>
          تلاش دوباره
        </button>
      ) : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {columns.map((column) => (
          <section key={column.key} className="rounded-card bg-tint/60 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">{column.title}</h2>
              <span className={`grid h-7 min-w-7 place-items-center rounded-full px-2 text-sm font-bold ${column.key === 'NEW' ? 'bg-accent text-ink' : 'bg-white'}`}>
                {toPersianDigits(column.items.length)}
              </span>
            </div>
            <div className="space-y-3">
              {column.items.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  flash={flash === order.id}
                  open={openId === order.id}
                  level={timerLevel(order, now)}
                  onToggle={() => setOpenId(openId === order.id ? null : order.id)}
                  onMove={(to) => requestMove(order, to)}
                  onPrint={() => {
                    setPrintOrder(order);
                    window.setTimeout(() => window.print(), 50);
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-6">
        <button className="font-bold" onClick={() => setEnRouteOpen(!enRouteOpen)}>
          در راه ({toPersianDigits(orders.filter((order) => order.status === 'OUT_FOR_DELIVERY').length)})
        </button>
        {enRouteOpen
          ? orders
              .filter((order) => order.status === 'OUT_FOR_DELIVERY')
              .map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  flash={false}
                  open={openId === order.id}
                  level={null}
                  onToggle={() => setOpenId(openId === order.id ? null : order.id)}
                  onMove={(to) => requestMove(order, to)}
                  onPrint={() => {
                    setPrintOrder(order);
                    window.setTimeout(() => window.print(), 50);
                  }}
                />
              ))
          : null}
      </section>
      <section className="mt-6">
        <h2 className="mb-2 font-bold">{isToday ? 'امروز تحویل شده' : 'تحویل شده'}</h2>
        <div className="space-y-2">
          {orders
            .filter((order) => order.status === 'DELIVERED')
            .map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-card border border-line bg-white px-4 py-3 text-sm">
                <span>سفارش {toPersianDigits(order.number)}</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            ))}
        </div>
      </section>
      {etaOrder ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-lg">
            <h3 className="mb-1 text-lg font-bold">زمان آماده‌سازی</h3>
            <p className="mb-4 text-sm text-muted">
              سفارش {toPersianDigits(etaOrder.number)} — چند دقیقه تا آماده شدن؟
            </p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {ETA_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  className="h-12 rounded-btn bg-primary text-sm font-bold text-white"
                  onClick={() => {
                    const order = etaOrder;
                    setEtaOrder(null);
                    void move(order, 'PREPARING', mins);
                  }}
                >
                  {toPersianDigits(mins)} دقیقه
                </button>
              ))}
            </div>
            <button className="h-11 w-full rounded-btn border border-line text-sm" onClick={() => setEtaOrder(null)}>
              انصراف
            </button>
          </div>
        </div>
      ) : null}
      {printOrder ? <Receipt order={printOrder} settings={settingsQuery.data ?? null} /> : null}
    </div>
  );
}

function OrderCard({
  order,
  flash,
  open,
  level,
  onToggle,
  onMove,
  onPrint,
}: {
  order: Order;
  flash: boolean;
  open: boolean;
  level: TimerLevel;
  onToggle: () => void;
  onMove: (to: string) => void;
  onPrint: () => void;
}) {
  const action = nextAction(order);
  const badge =
    order.fulfillment === 'DINE_IN'
      ? `داخل کافه · میز ${toPersianDigits(order.tableNumber || '')}`
      : FULFILL[order.fulfillment];
  const style = timerStyle(level);
  return (
    <article
      className={`rounded-card border bg-white p-3 ${flash ? 'border-accent' : 'border-line'}`}
      style={style}
    >
      <div className="mb-2 flex items-center justify-between">
        <strong>سفارش {toPersianDigits(order.number)}</strong>
        <span className="text-sm text-muted">{tehranTime(order.createdAt)}</span>
      </div>
      <div className="mb-2 inline-block rounded-full bg-sand px-2 py-1 text-xs">{badge}</div>
      {order.customerNote ? (
        <p className="mb-2 rounded-btn bg-sand/80 px-2 py-1.5 text-sm font-semibold text-ink">
          توضیح مشتری: {order.customerNote}
        </p>
      ) : null}
      <button className="block w-full text-right text-sm" onClick={onToggle}>
        {summary(order)}
      </button>
      {open ? (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.productName}
              {Array.isArray(item.options) && item.options.length
                ? ` (${item.options.map((option) => option.choiceName).join(' · ')})`
                : ''}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{formatPrice(order.total)}</span>
        <div className="flex items-center gap-2">
          <button className="grid h-11 w-11 place-items-center rounded-[14px] border border-line" onClick={onPrint} aria-label="چاپ فیش">
            چاپ
          </button>
          {action ? (
            <button className="h-11 rounded-btn bg-ink px-3 text-sm font-bold text-white" onClick={() => onMove(action.to)}>
              {action.label}
            </button>
          ) : null}
        </div>
      </div>
      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? (
        <button className="mt-2 text-xs text-muted" onClick={() => onMove('CANCELLED')}>
          لغو سفارش
        </button>
      ) : null}
    </article>
  );
}
