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
  PICKUP: 'ارسال با پیک',
  DINE_IN: 'ارسال با پیک',
};

function beep() {
  const audio = new Audio('/notif.mp3');
  audio.volume = 1;
  void audio.play().catch(() => undefined);
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
  const [printReprint, setPrintReprint] = useState(false);
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
            setPrintReprint(false);
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

  const columnTone: Record<string, string> = {
    NEW: 'bg-[linear-gradient(180deg,rgba(227,237,230,0.95),rgba(255,255,255,0.72))]',
    PREPARING: 'bg-[linear-gradient(180deg,rgba(251,235,207,0.9),rgba(255,255,255,0.72))]',
    READY: 'bg-[linear-gradient(180deg,rgba(242,181,90,0.22),rgba(255,255,255,0.75))]',
  };

  return (
    <div className="panel-page">
      {down ? (
        <div className="mb-4 rounded-2xl border border-accent/40 bg-sand px-4 py-2.5 text-sm shadow-sm">
          اتصال لحظه‌ای قطع شد — در حال تلاش مجدد…
        </div>
      ) : null}

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
          <h1 className="panel-title">{isToday ? 'سفارش‌های امروز' : 'سفارش‌ها'}</h1>
          <p className="panel-subtitle">
            {toPersianDigits(orders.length)} سفارش ثبت‌شده · {toPersianDigits(active)} سفارش فعال
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {!isToday ? (
            <button className="toolbar-chip" onClick={() => setDay(tehranToday())}>
              امروز
            </button>
          ) : null}
          <button
            className={`toolbar-chip ${printOn ? 'toolbar-chip-on' : ''}`}
            onClick={() => {
              const next = !printOn;
              setPrintOn(next);
              localStorage.setItem('cafe-print', next ? '1' : '0');
            }}
          >
            <span className={`h-2 w-2 rounded-full ${printOn ? 'bg-primary' : 'bg-line'}`} aria-hidden />
            چاپ خودکار {printOn ? 'روشن' : 'خاموش'}
          </button>
          <button
            className={`toolbar-chip ${soundOn ? 'toolbar-chip-on' : ''}`}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem('cafe-sound', next ? '1' : '0');
            }}
          >
            <span className={`h-2 w-2 rounded-full ${soundOn ? 'bg-primary' : 'bg-line'}`} aria-hidden />
            صدای اعلان {soundOn ? 'روشن' : 'خاموش'}
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
          <section key={column.key} className={`board-column ${columnTone[column.key] ?? 'bg-white/70'}`}>
            <div className="mb-3.5 flex items-center justify-between px-0.5">
              <h2 className="text-[15px] font-bold">{column.title}</h2>
              <span
                className={`grid h-7 min-w-7 place-items-center rounded-full px-2 text-sm font-bold ${
                  column.key === 'NEW' ? 'bg-accent text-ink' : 'bg-white/90 text-ink shadow-sm'
                }`}
              >
                {toPersianDigits(column.items.length)}
              </span>
            </div>
            <div className="space-y-3">
              {column.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line/80 bg-white/45 px-3 py-8 text-center text-sm text-muted">
                  سفارشی نیست
                </div>
              ) : (
                column.items.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    flash={flash === order.id}
                    open={openId === order.id}
                    level={timerLevel(order, now)}
                    onToggle={() => setOpenId(openId === order.id ? null : order.id)}
                    onMove={(to) => requestMove(order, to)}
                    onPrint={() => {
                      setPrintReprint(true);
                      setPrintOrder(order);
                      window.setTimeout(() => window.print(), 50);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-7 rounded-[22px] border border-line/70 bg-white/70 p-4 shadow-[var(--shadow-soft)] backdrop-blur-sm">
        <button
          className="flex w-full items-center justify-between text-right font-bold"
          onClick={() => setEnRouteOpen(!enRouteOpen)}
        >
          <span>در راه</span>
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-tint px-2 text-sm">
            {toPersianDigits(orders.filter((order) => order.status === 'OUT_FOR_DELIVERY').length)}
          </span>
        </button>
        {enRouteOpen ? (
          <div className="mt-3 space-y-3">
            {orders
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
                    setPrintReprint(true);
                    setPrintOrder(order);
                    window.setTimeout(() => window.print(), 50);
                  }}
                />
              ))}
          </div>
        ) : null}
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-[15px] font-bold">{isToday ? 'امروز تحویل شده' : 'تحویل شده'}</h2>
        <div className="space-y-2">
          {orders
            .filter((order) => order.status === 'DELIVERED')
            .map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-2xl border border-line/80 bg-white/90 px-4 py-3 text-sm shadow-sm"
              >
                <span className="font-medium">سفارش {toPersianDigits(order.number)}</span>
                <span className="font-bold text-primary">{formatPrice(order.total)}</span>
              </div>
            ))}
        </div>
      </section>

      {etaOrder ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]">
            <h3 className="mb-1 text-lg font-bold">زمان آماده‌سازی</h3>
            <p className="mb-4 text-sm text-muted">
              سفارش {toPersianDigits(etaOrder.number)} — چند دقیقه تا آماده شدن؟
            </p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {ETA_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  className="h-12 rounded-btn bg-primary text-sm font-bold text-white transition hover:brightness-110"
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
      {printOrder ? (
        <Receipt order={printOrder} settings={settingsQuery.data ?? null} reprint={printReprint} />
      ) : null}
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
  const badge = FULFILL[order.fulfillment] || 'ارسال با پیک';
  const style = timerStyle(level);
  return (
    <article
      className={`order-card ${flash ? 'order-card-flash border-accent' : ''}`}
      style={style}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <strong className="text-[15px]">سفارش {toPersianDigits(order.number)}</strong>
        <span className="rounded-full bg-tint/80 px-2 py-0.5 text-xs text-muted">{tehranTime(order.createdAt)}</span>
      </div>
      <div className="mb-2 inline-flex rounded-full bg-sand px-2.5 py-1 text-[11px] font-medium text-ink/85">{badge}</div>
      {order.customerNote ? (
        <p className="mb-2 rounded-xl border border-accent/25 bg-sand/90 px-2.5 py-1.5 text-sm font-semibold text-ink">
          توضیح مشتری: {order.customerNote}
        </p>
      ) : null}
      <button className="block w-full rounded-xl px-1 py-1 text-right text-sm leading-6 transition hover:bg-tint/40" onClick={onToggle}>
        {summary(order)}
      </button>
      {open ? (
        <ul className="mt-2 space-y-1 rounded-xl bg-tint/35 px-2.5 py-2 text-xs text-muted">
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
      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-line/70 pt-3">
        <span className="text-sm font-bold text-primary">{formatPrice(order.total)}</span>
        <div className="flex items-center gap-2">
          <button
            className="grid h-11 min-w-11 place-items-center rounded-[14px] border border-line bg-white px-2 text-xs font-medium transition hover:bg-tint/50"
            onClick={onPrint}
            aria-label="چاپ فیش"
          >
            چاپ
          </button>
          {action ? (
            <button
              className="h-11 rounded-btn bg-primary px-3.5 text-sm font-bold text-white transition hover:brightness-110"
              onClick={() => onMove(action.to)}
            >
              {action.label}
            </button>
          ) : null}
        </div>
      </div>
      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? (
        <button className="mt-2 text-xs text-muted transition hover:text-danger" onClick={() => onMove('CANCELLED')}>
          لغو سفارش
        </button>
      ) : null}
    </article>
  );
}
