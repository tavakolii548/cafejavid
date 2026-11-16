import { formatJalali, formatPrice, toPersianDigits } from '../lib/format';
import type { Order, Settings } from '../api';

const FULFILL: Record<string, string> = {
  DELIVERY: 'ارسال با پیک',
  PICKUP: 'تحویل حضوری',
  DINE_IN: 'داخل کافه',
};

const PAY: Record<string, string> = {
  CASH: 'پرداخت در محل',
  ONLINE: 'پرداخت آنلاین',
};

export function Receipt({ order, settings }: { order: Order; settings: Settings | null }) {
  const address = order.addressSnapshot as { details?: string; title?: string } | null;
  return (
    <div className="receipt-sheet">
      <article className="receipt">
        <h1>{settings?.cafeName || 'کافه من'}</h1>
        <div className="center">{toPersianDigits(settings?.phone || '')}</div>
        <hr />
        <div>سفارش {toPersianDigits(order.number)}</div>
        <div>{formatJalali(order.createdAt)}</div>
        <div>
          {FULFILL[order.fulfillment] || order.fulfillment}
          {order.tableNumber ? ` · میز ${toPersianDigits(order.tableNumber)}` : ''}
        </div>
        {address?.details ? <div>{address.details}</div> : null}
        <div>{toPersianDigits(order.user?.phone || '')}</div>
        <hr />
        {order.items.map((item) => (
          <div key={item.id}>
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
            {item.note ? <div className="opt">{item.note}</div> : null}
          </div>
        ))}
        <hr />
        <div className="row">
          <span>جمع سفارش</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        <div className="row">
          <span>هزینه‌ی پیک</span>
          <span>{formatPrice(order.deliveryFee)}</span>
        </div>
        {(order.packagingFee ?? 0) > 0 ? (
          <div className="row">
            <span>هزینه‌ی بسته‌بندی</span>
            <span>{formatPrice(order.packagingFee ?? 0)}</span>
          </div>
        ) : null}
        {(order.discountAmount ?? 0) > 0 ? (
          <div className="row">
            <span>تخفیف{order.discountCode ? ` (${order.discountCode})` : ''}</span>
            <span>{formatPrice(-(order.discountAmount ?? 0))}</span>
          </div>
        ) : null}
        <div className="row">
          <strong>مبلغ قابل پرداخت</strong>
          <strong>{formatPrice(order.total)}</strong>
        </div>
        <div>{PAY[order.paymentMethod] || order.paymentMethod}</div>
        <hr />
        <div className="center">{settings?.receiptFooter}</div>
      </article>
    </div>
  );
}
