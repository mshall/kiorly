# Kiorly: architecture

One Expo (SDK 58, React Native 0.88, expo-router, TypeScript strict) staff app with three product modules: **Clinic** (clinics-management, branch `kiorex`), **Pharmacy** (kiorly-pharmacy) and **Lab** (kiorly-lab). It has its own lockfile and `.npmrc` (`legacy-peer-deps=true`), like `kiorex-platform/apps/mobile`, and reuses its kit: brand theme (`src/brand/theme.ts` from `_brand/theme.ts`), `KiorexLogo`, `Screen/Card/Sheet/Toast`, Jost + IBM Plex Sans Arabic, haptics, skeletons.

## Layers
```
app/                       expo-router routes
  sign-in, upgrade, search, scan, devices, sync
  (tabs)/ index work inbox me
  clinic/* pharmacy/* lab/*   module screens (one folder per product)
src/
  api/        client (headers, single-flight refresh, error mapping), auth (product login), products (ports, accents), types
  auth/       SessionProvider (one session per product, SecureStore), lock (biometric)
  offline/    queue (persisted write queue, conflicts), mutate, network, SyncDriver
  hooks/      useRead (offline-first reads), useAlerts/useMessages, NotificationDriver
  components/ ui (kit), kit (ListRow, StatTile, Sparkline, BarChart, QueryView, ActionSheet, SyncChip), scanner (expo-camera)
  modules/    registry (tiles, deep links), <product>/ (screens' helpers, HomeSummary)
  i18n/       core strings + one bundle per product (modules/<product>.ts), AR default, RTL
```

## One app, three products
* Each product has **its own API and auth**; the app keeps one `Session` per product (token, device id/token, cached bootstrap). A user can be signed in to any combination. Home aggregates; Work lists tiles from every connected product; Inbox merges safety alerts and messages.
* On sign-in the app calls `GET /mobile/bootstrap`: `user/org/plan`, `entitlement`, `modules[]` (per role), `safetyAlertsOnly`. **Modules shown = bootstrap `modules[].enabled`** (per role) **and** entitlement. The tile registry (`src/modules/registry.ts`) maps module keys to routes.
* Basic orgs: `entitlement.enabled=false` => `/upgrade` screen + Home upgrade card; **safety alerts keep working** (ADR-025) through `/mobile/alerts`.
* After entitlement: `POST /mobile/devices` (device-bound token, SecureStore), then every request carries `X-Kiorly-Client`, `X-Kiorly-Device`, `X-Kiorly-Device-Token`.

## Backends (added per product, tested there)
Contract identical in the three repos (`clinics-management/Docs/MOBILE.md`, `kiorly-pharmacy/Docs/MOBILE.md`, `kiorly-lab/Docs/MOBILE.md` hold the exact shapes and the per-feature "App API map"): `/mobile/bootstrap`, `/mobile/devices` (+ revoke, push-token), `/mobile/inbox`, `/mobile/push/test` (mock sender), `/mobile/alerts` (+ack), plus read models (`/mobile/summary`, `/mobile/schedule`, `/mobile/pharmacy/*`, `/mobile/scan`, ...). Everything else uses the products' existing REST endpoints.

## Ports (dev)
Expo web **8082**. APIs: clinic 3010, pharmacy 3100, lab 3200 (never 3000/5173/5175). Override with `EXPO_PUBLIC_{CLINIC,PHARMACY,LAB}_API` (`.env.example`). Lab and pharmacy APIs allow the 8082 origin for Expo web in dev (`CORS_ORIGINS`).

## Features by requirement
Light/dark + AR (default, RTL) / EN; haptics; skeletons; pull-to-refresh; bottom sheets; charts (Sparkline, BarChart, Progress); biometric lock; remote sign-out; offline queue + sync chip; push (mock) + inbox; global search; barcode/QR (expo-camera + manual entry); deep links (`kiorly://`, expo-router file routes + push `data` routing).

## Limits
Verified on Expo web (Playwright, per role, against the live local APIs), jest-expo and `tsc`, plus an Android 15 emulator and an iPhone 18 Pro simulator (Expo Go, 20-21 Nov 2026; see `_docs/mobile/DEVICE_TEST_REPORT_2026-11-20.md` in the workspace). Native-only paths still unverified on a device: biometrics, camera scanning, push tokens, expo-location accuracy.

## Notification permission, direction restart, pills (21 Nov 2026)
* **Push permission in context.** `registerPush` never prompts; it only reads the permission. `PushPrimer` (`src/components/PushPrimer.tsx`) shows a short bottom sheet once, 2.5 s after the tabs first appear, explaining critical alerts and Rx/lab events; "Not now" (or swipe away) is remembered for 14 days (`kw-push-prompt-v1`, rule `shouldShowPrimer` in `src/lib/pushPermission.ts`). Me > Notifications has a switch (asks the OS, or opens system settings when blocked). Never blocks the app; absent on web and when already allowed.
* **Direction restart.** `bootstrapI18n().needsRestart` -> `handleRestart()` (`src/i18n/restart.ts`): real build reloads with `reloadAppAsync` from the `expo` core package (lazy `require` in try/catch, once per 60 s to avoid loops; no `expo-updates` needed); Expo Go shows a one-time dismissible "close and reopen" banner (`DirectionBanner`). Expo Go is detected by `isRunningInExpoGo()` as well as `Constants.executionEnvironment`, because Expo Go 58 on Android reports "bare". The automatic reload needs a development build to verify.
* **Android pill clipping.** Shrink-wrapped Arabic labels ("في الانتظار") were measured on one line but laid out on two, the second clipped. `Badge`, `Chip` and `Button` labels now use `numberOfLines={1}`.
* `Sheet` wraps its content in `KeyboardAvoidingView` (the upgrade note field).
