# Decisions

Assumptions made where the prompt left a choice, plus anything unfinished on this machine.

## Chosen options

- **Map:** Osmdroid with OpenStreetMap tiles. No Google Play Services.
- **Cart persistence:** DataStore Preferences holding a JSON document (product id, choice ids, quantity, note, display snapshot). Room is not used.
- **Password and OTP hashing:** `bcryptjs` (bcrypt-compatible, pure JavaScript) so the API image does not need native `argon2` bindings on Windows.
- **Refresh tokens:** random 32-byte secrets stored as SHA-256 hashes. Passwords and OTP codes use bcrypt.
- **Jalali calendar:** a small port of the well-known `jalaali-js` conversion (MIT) in the admin app and the Android app, so both show Tehran dates without an extra native calendar SDK.
- **Notification sound:** a short Web Audio beep in the admin panel (no binary asset).
- **Out-for-delivery column:** the card has a "تحویل داده شد" action so the state machine can reach `DELIVERED`. The prompt lists the column but not that button.
- **Product row tap** opens customization. The "+" button opens customization when the product has any option group; otherwise it adds one unit with no choices.
- **Sales reports** count orders that are not `CANCELLED`, using `createdAt` inside the selected range (UTC bounds of Tehran calendar days).
- **Featured products:** setting `featured=true` clears the flag on every other product (max one).
- **Online payment:** `ZarinpalPaymentGateway` is a stub. Checkout rejects `ONLINE` while `PAYMENT_ONLINE_ENABLED=false`.
- **Push:** `PushProvider` logs a line in development and does nothing else.
- **Uploads:** local disk in dev (`UPLOAD_DIR`). `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` are documented for a later adapter; the running code stores files locally.
- **Idempotency:** `Idempotency-Key` header on `POST /orders`. Replays return the original order.
- **Order numbers** start at 1001 (`max(number)+1` inside the create transaction).
- **Guest browsing** is client-only. The menu endpoint is public. Checkout requires a customer JWT.
- **SSE auth:** `Authorization: Bearer` or `?token=` query (EventSource cannot set headers).
- **Estimated time** defaults to 25 minutes when staff do not send `estimatedMinutes`.
- **Cafe display name** comes from settings (`cafeName`), seeded as `کافه من`.

## Verification on this machine

- Backend unit tests passed: pricing, phone/OTP attempt rules, order state machine (7 tests).
- `npx tsc -p tsconfig.build.json --noEmit` and `npx nest build` succeeded.
- Admin `tsc --noEmit` and `vite build` succeeded.
- Docker is not installed here, so `docker compose up` and a live order from the app were not executed.
- Android SDK is not installed here, so the Gradle project was not assembled. Open `android/` in Android Studio to build it.

## What still needs a machine with Docker and Android Studio

- `docker compose up` was not run here because the Docker CLI is not installed, and PostgreSQL is not installed locally, so migrations were not applied to a database.
- The Android project was not assembled because `ANDROID_HOME` is not set. Open the `android` folder in Android Studio and run it on an emulator.
- The six design pages are in `docs/mockups/page-01.png` through `page-06.png`, taken from `طراحی اپ کافه.pdf`.
