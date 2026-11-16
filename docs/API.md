# API

پایه: `/api/v1`. خطاها: `{ "error": { "code": "...", "message": "..." } }` با متن فارسی. زمان‌ها ISO-8601 و UTC هستند. قیمت‌ها عدد صحیح تومان‌اند.

## مشتری

| Method | Path | توضیح |
| --- | --- | --- |
| GET | `/config` | نام، تلفن، پذیرش سفارش، هزینه پیک، حداقل، تعداد میز، پرداخت آنلاین |
| POST | `/auth/otp/request` | `{phone}` همیشه 200 و `retryAfterSeconds`. سقف ۱ در ۶۰ ثانیه و ۵ در ساعت |
| POST | `/auth/otp/verify` | `{phone, code}` توکن‌ها و کاربر. کد ۴ رقم، ۱۲۰ ثانیه، حداکثر ۵ تلاش |
| POST | `/auth/login` | `{phone, password, register?, firstName?, lastName?, birthDate?}` ورود یا ثبت‌نام با رمز |
| GET | `/me/notifications` | Inbox اعلان‌های مشتری |
| POST | `/me/notifications/read` | همه اعلان‌ها را خوانده علامت بزن |
| POST | `/auth/refresh` | `{refreshToken}` |
| POST | `/auth/logout` | `{refreshToken}` |
| GET | `/menu` | دسته‌ها و محصولات غیرمخفی، گزینه‌ها، `soldOut`، `featured` |
| GET/PUT | `/me` | پروفایل. PUT: `{name}` |
| GET/POST/PUT/DELETE | `/me/addresses` | آدرس‌ها |
| POST | `/orders` | ساخت سفارش. هدر `Idempotency-Key`. قیمت فقط سمت سرور |
| GET | `/orders` | سفارش‌های خود کاربر |
| GET | `/orders/:id` | جزئیات |
| POST | `/orders/:id/cancel` | فقط در وضعیت `NEW` |
| GET | `/orders/:id/stream` | SSE. توکن در `Authorization` یا `?token=` |
| POST | `/orders/:id/reorder-preview` | سبد قابل سفارش مجدد |

بدنهٔ سفارش:

```json
{
  "fulfillment": "DELIVERY",
  "addressId": "optional",
  "address": { "title": "", "details": "", "lat": 0, "lng": 0 },
  "tableNumber": 1,
  "paymentMethod": "CASH",
  "note": "",
  "items": [{ "productId": "", "quantity": 1, "choiceIds": [], "note": "" }]
}
```

`DELIVERY` آدرس می‌خواهد. `DINE_IN` شماره میز ۱ تا N. `PICKUP` آدرس نمی‌خواهد. `ONLINE` فقط وقتی `PAYMENT_ONLINE_ENABLED=true`.

## کارکنان

ورود: `POST /admin/auth/login` با `{username, password}`. نقش‌ها `OWNER` و `STAFF`.

| Method | Path | نقش |
| --- | --- | --- |
| GET | `/admin/orders?status=&date=` | هر دو. `date` روز تهران `YYYY-MM-DD` |
| GET | `/admin/orders/:id` | هر دو |
| PATCH | `/admin/orders/:id/status` | `{toStatus, reason?, estimatedMinutes?}` انتقال نامعتبر 409 |
| GET | `/admin/orders/stream` | SSE: `order.created`, `order.updated` و کامنت ping هر ۲۰ ثانیه |
| CRUD | `/admin/categories` | `PUT /admin/categories/reorder` با `{ids}` |
| CRUD | `/admin/products` | |
| PATCH | `/admin/products/:id/availability` | `{soldOut}` |
| POST | `/admin/uploads` | فایل `file`، ذخیره روی دیسک |
| GET | `/admin/reports/summary?from=&to=` | فقط OWNER |
| GET | `/admin/customers` | فقط OWNER |
| GET/POST | `/admin/notifications` | فقط OWNER. ارسال به ALL یا USER |
| GET/PUT | `/admin/settings` | فقط OWNER. شامل `packagingFee` |

وضعیت سفارش:

`NEW → PREPARING → READY → (ارسال: OUT_FOR_DELIVERY → DELIVERED) | (حضوری/داخل کافه: DELIVERED)`

`NEW`، `PREPARING` و `READY` می‌توانند `CANCELLED` شوند.

شمارهٔ انسانی سفارش از ۱۰۰۱ شروع می‌شود. نام و قیمت آیتم در لحظهٔ ثبت ذخیره می‌شود.
