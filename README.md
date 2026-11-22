# Kiorly Work

One Expo staff app (iOS, Android, web) for the Kiorly Clinic, Pharmacy and Lab products, sold on the Pro and Enterprise plans (safety alerts reach every plan). Run it with `npm run web` (http://localhost:8082); design notes are in [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md).

Demo logins, role x module matrix, Basic/Lite walkthrough and manual test scripts: [DEMO_DATA.md](DEMO_DATA.md) (DEV ONLY). Workspace index of every demo: [../DEMO_DATA.md](../DEMO_DATA.md).

## Development build (local, no EAS account)

The app is a normal Expo SDK 58 project with `expo-dev-client`; native folders (`ios/`, `android/`) are **generated** (`expo prebuild`) and git-ignored. Config lives in `app.json` (bundle id / package `com.kiorly.work`, scheme `kiorlywork`, permissions, `expo-notifications` plugin with `remote-notification` background mode) and `eas.json` (profiles `development`, `development-simulator`, `preview`, `production`; no secrets).

```bash
# one-time tooling (this Mac has no Homebrew): CocoaPods into ~/.local/gems
export GEM_HOME=$HOME/.local/gems PATH=$HOME/.local/gems/bin:$PATH LANG=en_US.UTF-8 RUBYOPT=-rlogger
npx expo run:ios --device "iPhone 18 Pro" --port 8091        # builds with Xcode, installs, starts Metro
# Android (JDK 17 + SDK in ~/.local, emulator running):
export JAVA_HOME=~/.local/jdk17/jdk-17.0.21.1+2/Contents/Home ANDROID_HOME=~/.local/android/sdk PATH=$ANDROID_HOME/platform-tools:$PATH
npx expo run:android --port 8092                              # Android emulator reaches the Mac APIs at 10.0.2.2 (see DEMO_DATA.md)
```
Later runs only need Metro: `npx expo start --dev-client --port 8091`, then open `exp+kiorly-work://expo-development-client/?url=<metro url>`.
`react-native-reanimated` and `react-native-worklets` are pinned to the versions Expo SDK 58 expects (4.7.1 / 0.13.0); a newer reanimated needs worklets 0.14 and breaks `pod install`.

**Layout direction.** First launch is Arabic; `I18nManager.forceRTL` only applies after a JS reload, so `bootstrapI18n()` returns `needsRestart` and `handleRestart()` (src/i18n/restart.ts) calls `reloadAppAsync` once (guarded against loops for 60 s). In Expo Go it cannot reload and shows a one-time "close and reopen" banner instead. Verified on a real dev build: see `_docs/mobile/DEVICE_TEST_REPORT_2026-11-20.md`.

## Push notifications

What is real and testable today (no credentials needed): permission flow, token registration (mock token when Expo cannot issue one), token upload to `PUT /mobile/devices/:id/push-token`, one router for every notification (`src/lib/notifications.ts`: critical lab alert, SOS, `order.received`, upgrade request, plus the existing Rx / lab / clinic ids), tap while running / backgrounded / cold start, foreground banner + haptic + inbox refresh, app-icon badge = unread inbox + open alerts.

* **Local simulation (dev builds):** Me > Notifications shows a "Dev: send test notification (local)" card. Each button schedules a local notification (3 s) that comes back through the same listener and router as a remote one; the card also shows the token state (`mock no-project-id` plus the reason) and the last route taken.
* **Remote-format payloads on the iOS simulator:** `e2e-push/send.sh lab-critical|sos|order-received|upgrade-request` runs `xcrun simctl push booted com.kiorly.work e2e-push/<type>.json`. The fixtures use the Expo push shape: `aps` for the visible alert, the product's `data` object under the `body` key (that is where expo-notifications reads `content.data` for a remote push). Values match the demo seed (`demo_hv_cp1_7` etc.).

| Type | Fixture | Tap opens |
|---|---|---|
| Critical lab value | `e2e-push/lab-critical.json` | `/lab/critical` |
| SOS (home visit) | `e2e-push/sos.json` | `/clinic/round/<homeVisitId>` (no id: Inbox) |
| New Kiorex order | `e2e-push/order-received.json` | `/pharmacy/orders` |
| Upgrade request | `e2e-push/upgrade-request.json` | `/upgrade?product=<product>` |

**What remains for real remote push (credentials only, no code):** (1) `eas init` to write `extra.eas.projectId` into `app.json` (without it the app logs a warning, shows the reason in the dev card and keeps the mock token; it does not crash); (2) upload an **APNs key** (iOS) and an **FCM v1 service account** + `google-services.json` (Android) to EAS; (3) switch the product APIs from `PUSH_MODE=mock` to `real` with the Expo gateway. Remote push cannot be delivered to a simulator.

## Sign-in entries
Sign-in shows four tiles: Clinic, **Nurse**, Pharmacy and Lab. Nurse is the front door for nurses, aides and dispatchers: they have Kiorly Clinic accounts, so it uses the Clinic API and lands on today's home-visit rounds. There is no separate nurse app.
