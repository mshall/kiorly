# Kiorly Work: architecture

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
Light/dark + AR (default, RTL) / EN; haptics; skeletons; pull-to-refresh; bottom sheets; charts (Sparkline, BarChart, Progress); biometric lock; remote sign-out; offline queue + sync chip; push (mock) + inbox; global search; barcode/QR (expo-camera + manual entry); deep links (`kiorlywork://`, expo-router file routes + push `data` routing).

## Limits
No native device/simulator run in this environment (Xcode absent): verified with jest-expo, `tsc`, and Expo web in the browser pane at mobile size (AR/EN, light/dark). Native-only paths (biometrics, camera, push tokens, expo-location) are unit-tested with mocks and degrade on web.
