# CURSOR BUILD PROMPT — Cafe Ordering App (Android + Backend + Admin Panel)

You are a senior full-stack engineer. Build the complete system described below, end to end, in one monorepo. Follow this document literally. When something is unspecified, choose the simplest option that fits the stack and note it in `DECISIONS.md`. Do not skip features marked MVP. Do not add features marked "Out of scope".

Attached with this prompt: screenshots of the UI design (6 screens). The design is the source of truth for layout, spacing, colors and Persian copy. Match it.

---

## 1. Product summary

A single-cafe ordering system for a cafe owner.

- **Customers** use an Android app (Persian, RTL) to log in with their mobile number (SMS OTP), browse the menu, customize drinks, build a cart, place an order (delivery by courier, pickup, or dine-in), and track its status.
- **Cafe staff** use a web admin panel (tablet-friendly, Persian, RTL) that receives new orders in real time with a sound alert, moves orders through statuses, prints receipts, and hides sold-out items.
- Every order produces a **receipt (فیش)** stored in the system and printable on an 80mm thermal printer.

Primary market: Iran. Therefore: do NOT depend on Firebase/Google Play Services for core functionality. Push notifications are optional and behind an interface; real-time status in the app works via polling + Server-Sent Events.

---

## 2. Tech stack (fixed)

### Android app (`/android`)
- Kotlin, Jetpack Compose, Material 3, min SDK 24, target SDK 35
- MVVM + unidirectional state (`UiState` / `UiEvent` / `ViewModel` with `StateFlow`)
- Hilt (DI), Navigation Compose, Retrofit + OkHttp + kotlinx.serialization, DataStore (token/session), Coil (images)
- Whole app is **RTL, Persian**. `android:supportsRtl="true"`, force `LayoutDirection.Rtl` in the theme root.
- Persian digits for all displayed numbers and prices (a `formatPrice()` / `toPersianDigits()` util). Prices are stored as integers in **Toman**.
- Font: Vazirmatn (bundle weights 400, 500, 700 in `res/font`).

### Backend (`/backend`)
- Node.js 20, TypeScript, **NestJS**, PostgreSQL, **Prisma**
- JWT auth (access 15 min + refresh 30 days)
- Validation with `class-validator`
- Real-time: **SSE** endpoints (`/admin/orders/stream` for staff, `/orders/:id/stream` for customer)
- Docker Compose for local dev (postgres + api)
- Swagger/OpenAPI at `/docs`
- Provider interfaces with a dev/console implementation AND a documented real implementation slot:
  - `SmsProvider` (dev: logs OTP to console; real: Kavenegar-compatible adapter, config via env)
  - `PaymentGateway` (MVP: Cash/POS only; online gateway interface + Zarinpal adapter stubbed behind `PAYMENT_ONLINE_ENABLED=false`)
  - `PushProvider` (stub)

### Admin panel (`/admin`)
- React 18 + Vite + TypeScript, Tailwind CSS (RTL via `dir="rtl"`), TanStack Query
- Font Vazirmatn
- Served as static files; talks to the same API
- Receipt printing via a dedicated print stylesheet for **80mm width** (`window.print()`), plus auto-print option when a new order arrives

### Repo layout
```
/android
/backend
/admin
/docs            (API.md, DESIGN_TOKENS.md, DECISIONS.md)
docker-compose.yml
README.md        (setup + run for all three parts)
```

---

## 3. Design tokens (from the mockups)

Colors:
- background `#F4F6F2`
- surface/card `#FFFFFF`
- border `#DDE4DE`
- ink (text) `#17251E`
- muted text `#5B6B62`
- primary (deep green) `#1E4D3A`
- primary tint `#E3EDE6`
- accent (amber) `#F2B55A` (always with dark `#17251E` text, never white text)
- dark button `#17251E`
- tiles tints: `#E3EDE6`, `#FBEBCF`, `#EDE6F2`

Shape and spacing:
- Screen horizontal padding 20dp (login 24dp)
- Cards: radius 18dp, 1dp border `#DDE4DE`, white
- Buttons: radius 16dp, height 52–56dp, primary = green bg + white text, bold 15–16sp
- Icon buttons: 44x44dp, radius 14dp
- Chips/pills: height 40dp, radius 20dp
- Minimum touch target 44dp everywhere
- Product tile image: 68dp square, radius 14dp
- Typography (Vazirmatn): title 22sp bold, section 16sp bold, body 14sp, caption 12sp muted

All colors/dimens live in a single Compose theme file; no hard-coded colors in screens. Mirror the same tokens as Tailwind theme extension in `/admin` and write them to `docs/DESIGN_TOKENS.md`.

No emoji anywhere. Icons: Material Symbols / outlined style, stroke-like.

---

## 4. Android screens (match the mockups)

Navigation graph: `Login → Verify → Menu → (ProductDetail) → Cart → OrderTracking`, plus bottom tabs `Menu | Orders | Profile`.

### 4.1 Login (`ورود یا ثبت‌نام`)
- Top green header (260dp, bottom corners radius 36dp) with logo tile and cafe name "کافه من" (name comes from `GET /config`).
- Title "ورود یا ثبت‌نام", subtitle "شماره موبایلت رو وارد کن تا کد تأیید برات پیامک بشه."
- Phone field (LTR digits, `09xxxxxxxxx`), label "شماره موبایل", hint "یک کد ۴ رقمی برات پیامک می‌شه.", prefix chip "IR +۹۸".
- Button "دریافت کد تأیید" (disabled until the number is a valid Iranian mobile: `^09\d{9}$`, accepts Persian/Arabic digits and normalizes them).
- Terms text with links "قوانین و مقررات" and "حریم خصوصی".
- Secondary button "فعلاً فقط منو رو ببینم" = guest browsing (menu only; login required at checkout).

### 4.2 Verify (not in mockups — same visual language)
- Title "کد تأیید رو وارد کن", shows the number with "ویرایش شماره" link.
- 4 OTP boxes, auto-advance, SMS auto-read not required.
- Countdown 120s then "ارسال دوباره کد".
- Wrong code: inline error "کد واردشده درست نیست".
- Success → store tokens in DataStore → Menu. First login creates the user.

### 4.3 Menu (`منو`)
- Header: "سلام، خوش اومدی" + cafe name; notification icon button.
- Category chips (horizontally scrollable): "همه" selected by default, then categories from API (e.g. قهوه گرم, نوشیدنی سرد, کیک و دسر, صبحانه).
- Featured card (green, rounded 22dp): badge "پیشنهاد امروز", title, one-line subtitle, image tile. Data from `featured` flag on a product (max 1).
- Section "پرفروش‌ها": product rows (tile, name, short description, price "۱۱۵٬۰۰۰ تومان", 44dp "+" button).
  - "+" on a product **without** required options adds directly; on a product **with** options opens ProductDetail.
- Hidden or sold-out products: sold-out products are shown greyed with label "تموم شد" and a disabled button; hidden ones are not returned.
- Floating cart bar above bottom nav (dark `#17251E`, radius 18dp): amber count badge, "مشاهده سبد خرید", total on the end. Only visible when cart is non-empty.
- Bottom nav: "منو", "سفارش‌ها", "پروفایل".

### 4.4 Product detail / customization (`شخصی‌سازی`)
- Back button, favorite toggle, large image tile (140dp, radius 24dp), name, base price.
- Option groups come from the API (data-driven, NOT hard-coded):
  - single-choice group (e.g. "سایز": کوچک / متوسط / بزرگ; "نوع شیر": کامل / بادام / جو) rendered as equal-width segmented buttons, selected = green bg white text
  - toggle/multi group (e.g. "شات اضافه" +۲۰٬۰۰۰ تومان) rendered as a switch row
  - each choice has `priceDelta` (Toman)
- Free-text field "توضیحات سفارش" (max 140 chars).
- Bottom bar: quantity stepper (min 1, max 20) and button "افزودن به سبد · {computed total}". Total = (base + sum of selected deltas) × qty, updates live.

### 4.5 Cart and checkout (`سبد خرید`)
- Cart persisted locally (Room or DataStore) so it survives restarts.
- Fulfillment segmented control: "ارسال با پیک" | "تحویل حضوری" | "داخل کافه".
  - delivery → address row "انتخاب آدرس روی نقشه" (map picker; use OpenStreetMap-based map library to avoid Google dependency, e.g. osmdroid or MapLibre) + saved addresses list + free-text address details
  - pickup → no address
  - dine-in → table number input (1..N, N from config)
- Items list: name, option summary line ("متوسط · شیر کامل"), line price, quantity chip, swipe or minus/plus to edit/remove.
- Payment method: "پرداخت آنلاین" (shown only if `PAYMENT_ONLINE_ENABLED`) | "پرداخت در محل".
- Summary: "جمع سفارش", "هزینه‌ی پیک" (0 unless delivery), "مبلغ قابل پرداخت".
- Primary button "ثبت سفارش و پرداخت" ("ثبت سفارش" when pay-on-delivery). Requires login; if guest → go to Login then return.
- On success → OrderTracking for the new order.

### 4.6 Order tracking (`پیگیری سفارش`)
- Green summary card: "سفارش شماره {n}", big current status text, estimated time ("زمان تقریبی ۲۵ دقیقه").
- Vertical timeline with 5 steps (for delivery) — completed = filled green circle with check, current = ring with dot, future = grey ring:
  1. سفارش دریافت شد
  2. در حال آماده‌سازی
  3. آماده‌ی ارسال
  4. پیک در راه است
  5. تحویل داده شد
  - For pickup/dine-in, steps 3–5 become: "آماده‌ی تحویل" → "تحویل داده شد".
- Order summary row: item count, item names, total.
- Buttons: "تماس با کافه" (opens dialer with cafe phone from config), "بازگشت به منو".
- Updates live via SSE with polling fallback every 10s.
- Cancelled state: red-free neutral card "سفارش لغو شد" with reason if provided.

### 4.7 Orders tab and Profile tab (simple)
- Orders: list of past/active orders (status chip, date, total), tap → tracking/detail, button "سفارش مجدد" which refills the cart.
- Profile: name (editable), phone (read-only), saved addresses CRUD, logout.

---

## 5. Admin panel screens (`/admin`)

Login: staff username + password (separate from customer OTP). Roles: `OWNER`, `STAFF`. Seed one OWNER from env.

### 5.1 Orders board (`سفارش‌های امروز`) — default page
- Fixed right sidebar (200px, green `#1E4D3A`): logo/name, items "سفارش‌ها" (active, white pill), "منو و موجودی", "گزارش فروش", "مشتری‌ها", "تنظیمات".
- Header: title, subtitle "{n} سفارش ثبت شده · {m} سفارش فعال", two status pills: "چاپ خودکار فیش روشن است" and "صدای اعلان روشن است" (both toggles, persisted in localStorage).
- Three kanban columns: **جدید** (amber count badge), **در حال آماده‌سازی**, **آماده‌ی تحویل**.
- Order card: "سفارش {n}", time, fulfillment badge ("ارسال با پیک" / "تحویل حضوری" / "داخل کافه · میز {t}"), item summary ("۲× لاته، ۱× چیزکیک" including options on expand), total, print icon button (44px), and the next-action button:
  - NEW → "شروع آماده‌سازی"
  - PREPARING → "آماده شد"
  - READY (delivery) → "تحویل به پیک"; READY (pickup/dine-in) → "تحویل به مشتری"
- When `OUT_FOR_DELIVERY` the card moves to a fourth collapsed column "در راه"; completed orders go to a "امروز تحویل شده" list at the bottom.
- New orders arrive through SSE: play a short notification sound (if enabled), highlight the card for 5s, and auto-open the print dialog (if enabled). Reconnect automatically; show a small banner "اتصال قطع شد" when the stream is down.
- Cancel order action with reason (OWNER and STAFF).

### 5.2 Menu and inventory
- Categories CRUD with drag ordering.
- Products CRUD: name, description, price, image upload, category, option groups/choices, `featured`, and a prominent **"موجود / تموم شد"** toggle (one click) plus "مخفی" toggle.

### 5.3 Reports (OWNER only)
- Date range: today / 7 days / 30 days.
- Total sales, order count, average order value, top 5 products, hourly order histogram. Simple tables and one bar chart.

### 5.4 Customers (OWNER only)
- List with phone, name, order count, total spent, last order date. Read-only.

### 5.5 Settings (OWNER only)
- Cafe name, phone, address, opening hours, delivery fee (flat, MVP), minimum order amount, dine-in table count, "accepting orders" master switch (when off, app shows "الان سفارش نمی‌گیریم" and blocks checkout), receipt footer text.

### 5.6 Receipt layout (print CSS, 80mm)
Header: cafe name + phone. Then: order number, date/time (Jalali), fulfillment type (+ table number or address and customer phone), items with qty × name, option lines indented, line totals, subtotal, delivery fee, total, payment method, footer text. Monospace-friendly, black on white, no colors.

---

## 6. Data model (Prisma)

```
User            id, phone (unique), name?, createdAt
Address         id, userId, title, details, lat, lng
OtpCode         id, phone, codeHash, expiresAt, attempts, consumedAt?
StaffUser       id, username (unique), passwordHash, role (OWNER|STAFF), active
Category        id, name, sortOrder, active
Product         id, categoryId, name, description, price (int Toman), imageUrl?,
                featured (bool), soldOut (bool), hidden (bool), sortOrder
OptionGroup     id, productId, name, type (SINGLE|MULTI), required (bool), sortOrder
OptionChoice    id, groupId, name, priceDelta (int), isDefault, sortOrder
Order           id, number (int, unique, sequential), userId, status, fulfillment
                (DELIVERY|PICKUP|DINE_IN), tableNumber?, addressSnapshot (json)?,
                customerNote?, subtotal, deliveryFee, total, paymentMethod
                (CASH|ONLINE), paymentStatus (PENDING|PAID|FAILED), cancelReason?,
                estimatedMinutes?, createdAt, updatedAt
OrderItem       id, orderId, productId, productName (snapshot), unitPrice (snapshot),
                quantity, optionsSnapshot (json), note?, lineTotal
OrderStatusLog  id, orderId, fromStatus, toStatus, byStaffId?, createdAt
Setting         key (unique), value (json)
```

Rules:
- Order and item data are **snapshotted** at creation; later menu edits never change old receipts.
- The server **recomputes all prices** from the database. Never trust prices sent by the client.
- Order `number` is a human-friendly sequential integer starting at 1001.

### Order status state machine
```
NEW → PREPARING → READY → (DELIVERY: OUT_FOR_DELIVERY → DELIVERED) | (PICKUP/DINE_IN: DELIVERED)
NEW|PREPARING|READY → CANCELLED
```
Invalid transitions return `409`. Every transition writes an `OrderStatusLog`, emits an SSE event to the customer stream and the admin stream, and (if configured) a push.

---

## 7. API (REST, JSON, prefix `/api/v1`)

Customer:
- `GET  /config` — cafe name, phone, accepting-orders flag, delivery fee, min order, table count, online-payment enabled
- `POST /auth/otp/request` `{phone}` — rate limit: 1 per 60s per phone, max 5 per hour; always returns 200 with `{retryAfterSeconds}`
- `POST /auth/otp/verify` `{phone, code}` → `{accessToken, refreshToken, user}`; code is 4 digits, expires in 120s, max 5 attempts, hashed in DB
- `POST /auth/refresh`, `POST /auth/logout`
- `GET  /menu` → categories with products (non-hidden), option groups and choices, `soldOut` flags
- `GET/PUT /me`, `GET/POST/PUT/DELETE /me/addresses`
- `POST /orders` — body: `{fulfillment, tableNumber?, addressId?|address{...}, paymentMethod, note?, items:[{productId, quantity, choiceIds[], note?}]}`; validates availability, required option groups, min order, accepting-orders flag; returns the order
- `GET  /orders` (mine), `GET /orders/:id`, `POST /orders/:id/cancel` (only while NEW)
- `GET  /orders/:id/stream` — SSE of status events (auth via token query param or header)
- `POST /orders/:id/reorder-preview` — returns current-availability cart for re-ordering

Admin (staff JWT):
- `POST /admin/auth/login`
- `GET  /admin/orders?status=&date=`, `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status` `{toStatus, reason?, estimatedMinutes?}`
- `GET  /admin/orders/stream` — SSE (events: `order.created`, `order.updated`); send a `ping` comment every 20s
- CRUD: `/admin/categories`, `/admin/products` (+ `PATCH /admin/products/:id/availability {soldOut}`), image upload `POST /admin/uploads` (local disk in dev, S3-compatible via env in prod)
- `GET /admin/reports/summary?from=&to=`, `GET /admin/customers`
- `GET/PUT /admin/settings`

Conventions: errors as `{error:{code,message}}`, Persian user-facing `message` strings, all timestamps ISO-8601 UTC (UI converts to Tehran time and Jalali calendar).

---

## 8. Non-functional requirements

- **Security:** hash OTPs and passwords (argon2/bcrypt); rate-limit auth endpoints; validate all input; role guards on admin routes; CORS locked to configured origins; never log OTP codes in production mode.
- **Reliability:** order creation in a DB transaction; idempotency key header on `POST /orders` to prevent double-submits.
- **Offline/poor network:** Android shows retry states for every network screen; cart works offline; order placement requires network.
- **Accessibility:** content descriptions on all icon buttons, 4.5:1 text contrast, 44dp targets, TalkBack-readable order timeline.
- **Localization:** all strings in `strings.xml` (Persian) — no hard-coded text in composables; backend returns Persian error messages.
- **Time:** display Jalali dates (use a well-known library) and Tehran time zone.
- **Config via env:** `DATABASE_URL`, `JWT_SECRET`, `SMS_PROVIDER`, `SMS_API_KEY`, `PAYMENT_ONLINE_ENABLED`, `CORS_ORIGINS`, `OWNER_USERNAME`, `OWNER_PASSWORD`, `UPLOAD_DIR`. Provide `.env.example`.

---

## 9. Seed data

Seed script creates: 1 owner, categories (قهوه گرم, نوشیدنی سرد, کیک و دسر, صبحانه), ~12 sample products including: لاته (115000, groups: سایز, نوع شیر, شات اضافه +20000), کاپوچینو (105000), آیس آمریکانو (95000), چیزکیک (130000), one featured "قهوه‌ی روز", and default settings (delivery fee 35000, min order 100000, 10 tables). Prices are samples; the owner will edit them.

---

## 10. Build order (do in this sequence, commit after each step)

1. Monorepo scaffold, Docker Compose, README.
2. Backend: Prisma schema + migrations + seed; auth (OTP + staff); menu endpoints.
3. Backend: orders, state machine, SSE, settings, reports; Swagger; unit tests for pricing and state machine.
4. Admin panel: login, orders board with SSE + sound + print, menu/inventory, settings, reports, customers.
5. Android: theme/design system, Login + Verify, Menu, Product detail, Cart/Checkout, Tracking, Orders, Profile.
6. End-to-end pass: place an order from the app → appears on the admin board with sound → move through statuses → app timeline updates → receipt prints.
7. Polish: empty/error/loading states, RTL checks, string audit, README screenshots.

---

## 11. Acceptance criteria (must all pass)

- [ ] A new user logs in with a mobile number and a 4-digit OTP (dev provider prints it in the API console).
- [ ] The menu loads from the API; sold-out items are greyed and cannot be added; hidden items never appear.
- [ ] Customizing a latte updates the price live and the cart shows the option summary.
- [ ] Server rejects tampered prices and unavailable items.
- [ ] Delivery, pickup and dine-in orders can each be placed; address / table validations work.
- [ ] A placed order appears on the admin board within 2 seconds, with sound and optional auto-print.
- [ ] Moving an order through statuses updates the customer's timeline live; invalid transitions are blocked.
- [ ] 80mm receipt prints correctly (Persian, RTL, readable) for all three fulfillment types.
- [ ] Toggling "تموم شد" in admin hides the add button in the app within one refresh.
- [ ] Owner can see today's sales and top products.
- [ ] App is fully RTL, all numbers are Persian digits, no hard-coded strings, matches the screenshots.
- [ ] `docker compose up` brings up DB + API; README explains running admin and Android from scratch.

---

## 12. Out of scope (do NOT build now)

Loyalty/points, wallet, coupons, subscriptions, table reservation, reviews, multi-branch, courier app, live courier map tracking, online payment gateway integration beyond the interface/stub, iOS app. Leave clean extension points (interfaces, enums) but no UI.

---

## 13. How to work

- Work step by step following section 10. After each step, run the build/tests and fix errors before moving on.
- Keep files small and named by feature. Write tests for: price calculation, OTP flow, order state machine, order creation validation.
- Whenever the design screenshots and this text disagree, follow the screenshots for visuals and this text for behavior.
- At the end, produce `DECISIONS.md` listing every assumption you made and anything left unfinished.
