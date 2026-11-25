import { API_URL, loadSession, type Order, type Settings } from '../api';
import { formatJalaliFull, formatPriceGrouped, toPersianDigits } from '../lib/format';

function resolveLogo(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) return '/cafe-logo.png';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed;
  return `${API_URL.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
}

/** Compact 1D barcode (Code39-ish bars) for thermal print — no external lib. */
function ReceiptBarcode({ value }: { value: string }) {
  const digits = value.replace(/\D/g, '') || '0';
  const pattern: number[] = [1, 1, 1]; // quiet start
  for (const ch of digits) {
    const n = Number(ch);
    pattern.push(2, 1, n % 2 === 0 ? 2 : 1, 1, 1, 1);
  }
  pattern.push(2, 1, 1);
  const unit = 1.1;
  let x = 0;
  const rects: { x: number; w: number }[] = [];
  pattern.forEach((w, i) => {
    if (i % 2 === 0) rects.push({ x, w: w * unit });
    x += w * unit;
  });
  const height = 28;
  return (
    <svg className="receipt-barcode" viewBox={`0 0 ${x} ${height}`} width="100%" height={height} aria-hidden>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={height} fill="#000" />
      ))}
    </svg>
  );
}

function MetaRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  if (!value) return null;
  return (
    <div className="receipt-kv">
      <span className="receipt-kv-label">{label}</span>
      <span className={strong ? 'receipt-kv-value is-strong' : 'receipt-kv-value'}>{value}</span>
    </div>
  );
}

export function Receipt({
  order,
  settings,
  reprint = false,
}: {
  order: Order;
  settings: Settings | null;
  reprint?: boolean;
}) {
  const address = order.addressSnapshot as { details?: string; title?: string } | null;
  const showPhone = settings?.receiptShowPhone !== false;
  const showAddress = settings?.receiptShowAddress !== false;
  const logoSrc = resolveLogo(settings?.logoUrl);
  const staff = loadSession()?.username || 'کاربر';
  const customerName = order.user?.name?.trim() || '—';
  const customerPhone = order.user?.phone ? toPersianDigits(order.user.phone) : '';
  const clubCode = order.user?.customerCode ? toPersianDigits(order.user.customerCode) : '';
  const addressLine = [address?.title, address?.details].filter(Boolean).join(' · ');
  const wait =
    order.estimatedMinutes != null && order.estimatedMinutes > 0
      ? `${toPersianDigits(order.estimatedMinutes)} دقیقه`
      : '';
  const invoiceNo = toPersianDigits(order.number);
  const ticketNo = toPersianDigits(order.number);
  const packaging = order.packagingFee ?? 0;
  const discount = order.discountAmount ?? 0;

  return (
    <div className="receipt-sheet">
      <article className="receipt">
        <header className="receipt-top">
          <div className="receipt-ticket">{ticketNo}</div>
          <div className="receipt-top-center">
            <h1>{settings?.cafeName || 'کافه جاوید'}</h1>
            {reprint ? <div className="receipt-reprint">چاپ مجدد</div> : null}
            {settings?.receiptHeader ? <p className="receipt-tagline">{settings.receiptHeader}</p> : null}
          </div>
          <img className="receipt-logo" src={logoSrc} alt="" />
        </header>

        <div className="receipt-rule solid" />

        <section className="receipt-meta-block">
          <div className="receipt-kv-row">
            <MetaRow label="تاریخ و ساعت" value={formatJalaliFull(order.createdAt)} />
            {order.tableNumber != null ? (
              <MetaRow label="شماره میز" value={toPersianDigits(order.tableNumber)} strong />
            ) : null}
          </div>
          <MetaRow label="مدت زمان انتظار" value={wait} />
          <MetaRow label="شماره فاکتور" value={invoiceNo} />
          <MetaRow label="صورتحساب" value={customerName} />
          <MetaRow label="اشتراک" value={clubCode} />
          <MetaRow label="تماس" value={customerPhone} />
          <MetaRow label="آدرس" value={addressLine || '—'} />
          {order.customerNote ? <MetaRow label="یادداشت" value={order.customerNote} /> : null}
        </section>

        <table className="receipt-table">
          <thead>
            <tr>
              <th className="col-name">نام کالا</th>
              <th className="col-qty">تعداد</th>
              <th className="col-price">قیمت</th>
              <th className="col-sum">جمع کل</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const opts = Array.isArray(item.options) ? item.options : [];
              const optText = opts.map((o) => o.choiceName).filter(Boolean).join('، ');
              return (
                <tr key={item.id}>
                  <td className="col-name">
                    <div className="item-name">{item.productName}</div>
                    {optText ? <div className="item-opt">{optText}</div> : null}
                    {item.note ? <div className="item-opt">یادداشت: {item.note}</div> : null}
                  </td>
                  <td className="col-qty">{toPersianDigits(item.quantity)}</td>
                  <td className="col-price">{formatPriceGrouped(item.unitPrice)}</td>
                  <td className="col-sum">{formatPriceGrouped(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <section className="receipt-finance">
          <div className="receipt-finance-rows">
            <div className="receipt-kv">
              <span className="receipt-kv-label">مبلغ فاکتور</span>
              <span className="receipt-kv-value">{formatPriceGrouped(order.subtotal)}</span>
            </div>
            <div className="receipt-kv">
              <span className="receipt-kv-label">مالیات</span>
              <span className="receipt-kv-value">{toPersianDigits(0)}</span>
            </div>
            <div className="receipt-kv">
              <span className="receipt-kv-label">هزینه ارسال</span>
              <span className="receipt-kv-value">{formatPriceGrouped(order.deliveryFee)}</span>
            </div>
            <div className="receipt-kv">
              <span className="receipt-kv-label">حق سرویس</span>
              <span className="receipt-kv-value">{formatPriceGrouped(packaging)}</span>
            </div>
            <div className="receipt-kv">
              <span className="receipt-kv-label">تخفیف{order.discountCode ? ` (${order.discountCode})` : ''}</span>
              <span className="receipt-kv-value">{formatPriceGrouped(discount)}</span>
            </div>
          </div>
          <div className="receipt-barcode-wrap">
            <ReceiptBarcode value={String(order.number).padStart(8, '0')} />
          </div>
        </section>

        <div className="receipt-payable">
          <span className="receipt-payable-brand">{settings?.cafeName || 'کافه جاوید'}</span>
          <span className="receipt-payable-amount">
            قابل پرداخت: {formatPriceGrouped(order.total)}
          </span>
        </div>

        <footer className="receipt-foot">
          {showAddress && settings?.address ? <div>{settings.address}</div> : null}
          {showPhone && settings?.phone ? <div>تلفن: {toPersianDigits(settings.phone)}</div> : null}
          <div>کاربر: {staff}</div>
          {settings?.receiptFooter ? <div className="receipt-quote">{settings.receiptFooter}</div> : null}
        </footer>
      </article>
    </div>
  );
}
