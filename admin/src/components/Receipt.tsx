import { API_URL } from '../api';
import { formatJalali, formatPrice, toPersianDigits } from '../lib/format';
import type { Order, Settings } from '../api';

const FULFILL: Record<string, { label: string; hint: string }> = {
  DELIVERY: { label: 'ارسال با پیک', hint: 'تحویل در آدرس مشتری' },
  PICKUP: { label: 'ارسال با پیک', hint: '' },
  DINE_IN: { label: 'ارسال با پیک', hint: '' },
};

const PAY: Record<string, string> = {
  CASH: 'پرداخت در محل',
  ONLINE: 'پرداخت آنلاین',
};

function resolveLogo(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) return '/cafe-logo.png';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed;
  return `${API_URL.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
}

export function Receipt({ order, settings }: { order: Order; settings: Settings | null }) {
  const address = order.addressSnapshot as { details?: string; title?: string } | null;
  const fulfill = FULFILL[order.fulfillment] || { label: order.fulfillment, hint: '' };
  const showPhone = settings?.receiptShowPhone !== false;
  const showAddress = settings?.receiptShowAddress !== false;
  const showHours = Boolean(settings?.receiptShowHours);
  const logoSrc = resolveLogo(settings?.logoUrl);

  return (
    <div className="receipt-sheet">
      <article className="receipt">
        <header className="receipt-brand">
          <img className="receipt-logo" src={logoSrc} alt="" />
          <h1>{settings?.cafeName || 'کافه جاوید'}</h1>
          {settings?.receiptHeader ? <p className="receipt-tagline">{settings.receiptHeader}</p> : null}
          <div className="receipt-meta">
            {showPhone && settings?.phone ? <div>تلفن: {toPersianDigits(settings.phone)}</div> : null}
            {showAddress && settings?.address ? <div>{settings.address}</div> : null}
            {showHours && settings?.openingHours ? <div>ساعات کاری: {toPersianDigits(settings.openingHours)}</div> : null}
          </div>
        </header>

        <div className="receipt-fulfill">
          <strong>{fulfill.label}</strong>
          {fulfill.hint ? <span>{fulfill.hint}</span> : null}
        </div>

        <section className="receipt-block">
          <div className="row">
            <span>شماره سفارش</span>
            <strong>{toPersianDigits(order.number)}</strong>
          </div>
          <div className="row">
            <span>زمان</span>
            <span>{formatJalali(order.createdAt)}</span>
          </div>
          {order.user?.name ? (
            <div className="row">
              <span>مشتری</span>
              <span>{order.user.name}</span>
            </div>
          ) : null}
          {order.user?.phone ? (
            <div className="row">
              <span>موبایل</span>
              <span>{toPersianDigits(order.user.phone)}</span>
            </div>
          ) : null}
          {address?.details ? (
            <div className="receipt-address">
              <span>آدرس تحویل</span>
              <p>
                {address.title ? `${address.title} · ` : ''}
                {address.details}
              </p>
            </div>
          ) : null}
          {order.customerNote ? (
            <div className="receipt-note">
              <span>یادداشت مشتری</span>
              <p>{order.customerNote}</p>
            </div>
          ) : null}
        </section>

        <div className="receipt-rule" />

        <section className="receipt-items">
          {order.items.map((item) => (
            <div className="receipt-item" key={item.id}>
              <div className="row">
                <span>
                  {toPersianDigits(item.quantity)}× {item.productName}
                </span>
                <span>{formatPrice(item.lineTotal)}</span>
              </div>
              {(Array.isArray(item.options) ? item.options : []).map((option, index) => (
                <div className="opt" key={`${item.id}-${index}`}>
                  {option.choiceName}
                  {option.priceDelta ? ` (${formatPrice(option.priceDelta)})` : ''}
                </div>
              ))}
              {item.note ? <div className="opt">یادداشت: {item.note}</div> : null}
            </div>
          ))}
        </section>

        <div className="receipt-rule" />

        <section className="receipt-totals">
          <div className="row">
            <span>جمع سفارش</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.fulfillment === 'DELIVERY' || order.deliveryFee > 0 ? (
            <div className="row">
              <span>هزینه پیک</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </div>
          ) : null}
          {(order.packagingFee ?? 0) > 0 ? (
            <div className="row">
              <span>بسته‌بندی</span>
              <span>{formatPrice(order.packagingFee ?? 0)}</span>
            </div>
          ) : null}
          {(order.discountAmount ?? 0) > 0 ? (
            <div className="row">
              <span>تخفیف{order.discountCode ? ` (${order.discountCode})` : ''}</span>
              <span>{formatPrice(-(order.discountAmount ?? 0))}</span>
            </div>
          ) : null}
          <div className="row receipt-total">
            <strong>قابل پرداخت</strong>
            <strong>{formatPrice(order.total)}</strong>
          </div>
          <div className="row">
            <span>روش پرداخت</span>
            <span>{PAY[order.paymentMethod] || order.paymentMethod}</span>
          </div>
        </section>

        {settings?.receiptFooter ? (
          <>
            <div className="receipt-rule" />
            <footer className="receipt-footer">{settings.receiptFooter}</footer>
          </>
        ) : null}
      </article>
    </div>
  );
}
