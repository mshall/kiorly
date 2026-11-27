# Kiorly

One Expo staff app (iOS, Android, web) for the Kiorly Clinic, Pharmacy and Lab products, sold on the Pro and Enterprise plans (safety alerts reach every plan). Run it with `npm run web` (http://localhost:8082); design notes are in [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md).

Demo logins, role x module matrix, Basic/Lite walkthrough and manual test scripts: [DEMO_DATA.md](DEMO_DATA.md) (DEV ONLY). Workspace index of every demo: [../DEMO_DATA.md](../DEMO_DATA.md).

## Development build (local, no EAS account)

The app is a normal Expo SDK 58 project; `expo-dev-client` is part of DEVELOPMENT builds only (see "Dev client only in development profiles" below); native folders (`ios/`, `android/`) are **generated** (`expo prebuild`) and git-ignored. Config lives in `app.json` (bundle id / package `com.kiorly.app`, scheme `kiorly`, permissions, `expo-notifications` plugin with `remote-notification` background mode) and `eas.json` (profiles `development`, `development-simulator`, `preview`, `production`; no secrets).

```bash
# one-time tooling (this Mac has no Homebrew): CocoaPods into ~/.local/gems
export GEM_HOME=$HOME/.local/gems PATH=$HOME/.local/gems/bin:$PATH LANG=en_US.UTF-8 RUBYOPT=-rlogger
npx expo run:ios --device "iPhone 18 Pro" --port 8091        # builds with Xcode, installs, starts Metro
# Android (JDK 17 + SDK in ~/.local, emulator running):
export JAVA_HOME=~/.local/jdk17/jdk-17.0.21.1+2/Contents/Home ANDROID_HOME=~/.local/android/sdk PATH=$ANDROID_HOME/platform-tools:$PATH
npx expo run:android --port 8092                              # Android emulator reaches the Mac APIs at 10.0.2.2 (see DEMO_DATA.md)
```
Later runs only need Metro: `npx expo start --dev-client --port 8091`, then open `exp+kiorly://expo-development-client/?url=<metro url>`.
`react-native-reanimated` and `react-native-worklets` are pinned to the versions Expo SDK 58 expects (4.7.1 / 0.13.0); a newer reanimated needs worklets 0.14 and breaks `pod install`.

**Layout direction.** First launch is Arabic; `I18nManager.forceRTL` only applies after a JS reload, so `bootstrapI18n()` returns `needsRestart` and `handleRestart()` (src/i18n/restart.ts) calls `reloadAppAsync` once (guarded against loops for 60 s). In Expo Go it cannot reload and shows a one-time "close and reopen" banner instead. Verified on a real dev build: see `_docs/mobile/DEVICE_TEST_REPORT_2026-11-20.md`.

## Push notifications

What is real and testable today (no credentials needed): permission flow, token registration (mock token when Expo cannot issue one), token upload to `PUT /mobile/devices/:id/push-token`, one router for every notification (`src/lib/notifications.ts`: critical lab alert, SOS, `order.received`, upgrade request, plus the existing Rx / lab / clinic ids), tap while running / backgrounded / cold start, foreground banner + haptic + inbox refresh, app-icon badge = unread inbox + open alerts.

* **Local simulation (dev builds):** Me > Notifications shows a "Dev: send test notification (local)" card. Each button schedules a local notification (3 s) that comes back through the same listener and router as a remote one; the card also shows the token state (`mock no-project-id` plus the reason) and the last route taken.
* **Remote-format payloads on the iOS simulator:** `e2e-push/send.sh lab-critical|sos|order-received|upgrade-request` runs `xcrun simctl push booted com.kiorly.app e2e-push/<type>.json`. The fixtures use the Expo push shape: `aps` for the visible alert, the product's `data` object under the `body` key (that is where expo-notifications reads `content.data` for a remote push). Values match the demo seed (`demo_hv_cp1_7` etc.).

| Type | Fixture | Tap opens |
|---|---|---|
| Critical lab value | `e2e-push/lab-critical.json` | `/lab/critical` |
| SOS (home visit) | `e2e-push/sos.json` | `/clinic/round/<homeVisitId>` (no id: Inbox) |
| New Kiorex order | `e2e-push/order-received.json` | `/pharmacy/orders` |
| Upgrade request | `e2e-push/upgrade-request.json` | `/upgrade?product=<product>` |

**What remains for real remote push (credentials only, no code):** (1) `eas init` to write `extra.eas.projectId` into `app.json` (without it the app logs a warning, shows the reason in the dev card and keeps the mock token; it does not crash); (2) upload an **APNs key** (iOS) and an **FCM v1 service account** + `google-services.json` (Android) to EAS; (3) switch the product APIs from `PUSH_MODE=mock` to `real` with the Expo gateway. Remote push cannot be delivered to a simulator.

## Identity
Plain **Kiorly** (founder, 23 Nov 2026, ADR-037): display name Kiorly / كيورلي, store title "Kiorly: Clinic, Pharmacy & Lab" (listing in `Docs/STORE_LISTING.md`), bundle id and Android package `com.kiorly.app`, URL scheme `kiorly://`, Expo slug `kiorly` (dev client `exp+kiorly://`), request header `X-Kiorly-Client: kiorly/<version>`, package `@kiorly/app`. Modules inside the app are Clinic, Nurse, Pharmacy, Lab. "by Kiorex" shows only on the splash and the About card. Icon assets: `cd ../_brand && node scripts/gen-assets.cjs` then `npm run gen:assets` (Kiorex mark, Kiorly accent). The repo folder is still `kiorly-team` until it is renamed. Existing native folders (`ios/`, `android/`, git-ignored) still carry the old ids: run `npx expo prebuild --clean` before the next device build.

## Sign in with Kiorex Passport
The sign-in card has a working **Sign in with Kiorex Passport** button: OIDC authorization code + PKCE (S256) as the public client `kiorly`, `src/auth/passport.ts`. The Passport access token is the bearer for the product API of the entry you picked; each product verifies it and maps the subject to its own staff row. The dev password / chip login stays for local development. Local setup: Passport dev IdP on `http://localhost:4400` (`EXPO_PUBLIC_PASSPORT_ISSUER`), each product API with Passport accepted (`AUTH_MODE=oidc`, or `AUTH_ACCEPT_PASSPORT=true` in dual mode where the product supports it) and the staff row linked by verified phone. Sign-out revokes the grant and ends the Passport session with `id_token_hint` (see `Docs/SECURITY.md`). Tests: `src/__tests__/passport.test.ts`, `session-passport.test.tsx`, `signin-passport.test.tsx`; web e2e against a mock Passport: `e2e-web/passport-signin.spec.ts` (`passport.config.ts` has the build and run commands).

## Sign-in entries
Sign-in shows four tiles: Clinic, **Nurse**, Pharmacy and Lab. Nurse is the front door for nurses, aides and dispatchers: they have Kiorly Clinic accounts, so it uses the Clinic API and lands on today's home-visit rounds. There is no separate nurse app.

## Navigation and sign-out
* **Tab bar everywhere.** Every pushed screen (`clinic/*`, `pharmacy/*`, `lab/*`, `devices`, `sync`, `upgrade`, `search`) lives in `app/(tabs)/(more)/`, one extra tab inside `(tabs)` whose button is hidden, with its own Stack (header with a back button that falls back to Home when the screen was opened by a deep link or a push tap). Route groups do not change URLs, so `/clinic/visits`, `/lab/critical`, `/upgrade?product=...` and the push router (`src/lib/notifications.ts`) are unchanged. Note: in expo-router 58 a tab with `href: null` is *not navigable* (it redirects to the first tab), which is why the tab is kept and only its button hidden (`tabBarButton: () => null`, `tabBarItemStyle: { display: "none" }`). `scan` stays a full-screen modal with its own close.
* **Sign out.** Home header has a sign-out button; Me has a prominent "Sign out" on top and at the bottom, per product and "everything". All go through `SignOutSheet` (confirm step): it deletes this device's record on the product API (this drops the push token), clears the secure-stored session and the query cache, and returns to `/sign-in` when no account is left.
* **Sign-in header.** `BrandLockup` (mark | rule | "Kiorly" bold, from `app.name`) plus the language pills; product tiles are a 2x2 grid (icon + full label).
* **Dev-client "Tools" gear.** The round gear that used to overlap the sign-in header in debug builds is the expo-dev-client floating tools button, not part of the app. `plugins/withDevMenuNoFab.js` sets `EXDevMenuShowFloatingActionButton=false` (Info.plist / manifest meta-data) so it is off by default after the next `expo prebuild`; it can still be switched on in the dev menu ("Tools button"). Release builds never have it.

## Dev client only in development profiles

`app.config.ts` removes the `expo-dev-client` and `./plugins/withDevMenuNoFab.js` config plugins unless the build profile is `development` or `development-*` (`EAS_BUILD_PROFILE`, else `APP_ENV`, else development for local runs). So `preview`, `kx-test`, `kx-test-simulator`, `pilot` and `production` (the store and internal release profiles) are prebuilt without the dev launcher wiring or the dev-menu manifest entries. The profile is checked per EAS profile by `src/__tests__/dev-client-profiles.test.ts`. By hand:

```bash
for p in development development-simulator preview kx-test pilot production; do
  echo "== $p"; EAS_BUILD_PROFILE=$p SKIP_FIREBASE_CHECK=1 STAFF_LINK_HOST=app.test.kiorly.com npx expo config --json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));console.log(d.plugins.map(p=>Array.isArray(p)?p[0]:p).filter(x=>/dev/i.test(x)))'
done   # development* print both plugins, every other profile prints []
```

Limit worth knowing: the `expo-dev-client` npm package stays in `package.json` (development builds need it) and Expo autolinking still compiles its native modules, whose release variants are no-ops; what is gone from the other profiles is the config-plugin native wiring. Local release builds (`npm run build:android:test`, APP_ENV `preview`) follow the same rule, so Metro with `--dev-client` needs a development build, not that APK.
