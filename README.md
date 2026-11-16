# CafeJavid

سیستم سفارش یک کافه: اپ اندروید (مشتری)، API با NestJS و پنل وب کارکنان.

طراحی صفحه‌ها در `طراحی اپ کافه.pdf` و نسخه‌های PNG در `docs/mockups/` است. رفتار محصول در `CURSOR_PROMPT.md` است. تصمیم‌های پیاده‌سازی در `docs/DECISIONS.md`.

## پیش‌نیاز

- Docker Desktop (برای Postgres و API)
- Node.js 20 یا جدیدتر
- Android Studio (SDK 35) برای اپ

اگر Docker ندارید، Postgres را جدا نصب کنید و `backend/.env` را با `DATABASE_URL` خودتان پر کنید.

## API

```bash
cd backend
copy .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run test
npm run start:dev
```

یا از ریشهٔ پروژه:

```bash
docker compose up --build
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- ورود کارکنان پیش‌فرض: `owner` / `owner12345`
- کد OTP در حالت `SMS_PROVIDER=console` داخل لاگ API چاپ می‌شود. در `NODE_ENV=production` کد لاگ نمی‌شود.

## پنل کارکنان

```bash
cd admin
npm install
npm run dev
```

مرورگر: `http://localhost:5173`

صدای اعلان و چاپ خودکار فیش در نوار بالای سفارش‌ها ذخیره می‌شوند. فیش برای چاپگر ۸۰ میلی‌متری با `window.print()` است.

## اپ اندروید

1. Android Studio را باز کنید و پوشهٔ `android` را Import کنید.
2. اگر `local.properties` ساخته نشد، `sdk.dir` را به Android SDK بدهید.
3. یک شبیه‌ساز بسازید و Run کنید.

آدرس پیش‌فرض API برای شبیه‌ساز `http://10.0.2.2:3000/` است (`BuildConfig.API_BASE` در `android/app/build.gradle.kts`). برای گوشی واقعی، IP کامپیوتر را همان‌جا بگذارید.

ورود: شمارهٔ `09xxxxxxxxx`، سپس کد ۴ رقمی از لاگ API. بدون ورود هم می‌شود منو را دید؛ ثبت سفارش نیاز به ورود دارد.

## جریان پذیرش

1. کاربر با OTP وارد می‌شود.
2. منو از API می‌آید. جنس تمام‌شده خاکستری است و دکمهٔ افزودن ندارد. جنس مخفی اصلاً برنمی‌گردد.
3. شخصی‌سازی لاته قیمت را زنده عوض می‌کند و سبد خلاصهٔ گزینه‌ها را نشان می‌دهد.
4. سرور قیمت را دوباره حساب می‌کند و جنس ناموجود را رد می‌کند.
5. ارسال، تحویل حضوری و داخل کافه هر کدام اعتبارسنجی آدرس یا میز دارند.
6. سفارش روی تابلوی پنل با SSE می‌آید؛ صدا و چاپ خودکار قابل روشن و خاموش شدن است.
7. تغییر وضعیت، خط زمان مشتری را به‌روز می‌کند. انتقال نامعتبر `409` است.
8. فیش ۸۰ میلی‌متری برای هر سه نوع تحویل از دکمهٔ چاپ در کارت سفارش درمی‌آید.
9. کلید «تموم شد» بعد از تازه‌سازی منو در اپ، افزودن را می‌بندد.
10. گزارش فروش امروز و پنج محصول برتر برای مدیر است.

جزئیات endpointها در `docs/API.md`.
