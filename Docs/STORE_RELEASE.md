# Store release checklist (no submission has been made)

Store title **Kiorly: Clinic, Pharmacy & Lab** (listing text in [STORE_LISTING.md](STORE_LISTING.md)). Bundle ids `com.kiorly.app` (iOS and Android) are **placeholders until the Apple/Google accounts exist (NEEDS_HUMAN)**. `eas.json` has development / preview (internal) / production profiles.

## Before the first build (human steps)
The founder-only items, with exact steps, live in [NEEDS_HUMAN.md](NEEDS_HUMAN.md). The list below is the engineering view.
1. Apple Developer + Google Play Console accounts under the company; confirm app name "Kiorly" / "كيورلي" and final bundle ids.
2. `eas init`, set `EXPO_PUBLIC_CLINIC_API`, `EXPO_PUBLIC_PHARMACY_API`, `EXPO_PUBLIC_LAB_API` per EAS environment (staging first); real HTTPS endpoints only.
3. Passport: the public client `kiorly` (`kiorly://auth/callback`, post-logout `kiorly://auth/logout`) is registered for local in `kiorex-account` and the app already signs in with OIDC PKCE; create the staging/production app client (Cognito) with the same redirect URIs, set `EXPO_PUBLIC_PASSPORT_ISSUER` per EAS environment, and set each product API to `AUTH_MODE=oidc` with `kiorly` in its accepted clients.
4. Provider go-live pass: real Expo push (APNs key, FCM), per product `Docs/NEEDS_HUMAN.md` "Provider go-live"; set `MOBILE_PUSH_MODE=real` in staging.
5. Add `mobile_staff_app` to the flag catalogue (see ENTITLEMENTS.md).
6. Run on real devices (iPhone + Android): camera scanning, Face ID/fingerprint, push, location permission copy, RTL flip (native needs a restart after language change), VoiceOver/TalkBack, Dynamic Type.
7. Assets from `_brand` (`cd _brand && node scripts/gen-assets.cjs`, then `npm run gen:assets` here): icon, adaptive icon, favicon and splash from the Kiorex mark with the Kiorly accent (Ocean), never a product colour. "by Kiorex" only on the splash and the About card, never in the icon label or the store name. Screenshots in AR and EN, light and dark.

## Privacy labels
Superseded by [STORE_DECLARATIONS.md](STORE_DECLARATIONS.md) (Apple App Privacy, Google Data Safety, rating, Health apps declaration, screenshot shot list). The notes below are the earlier summary, kept for context. Everything is a draft until counsel has reviewed it.

### Earlier summary (draft, counsel review required)
* **Data collected, linked to the user:** name, email (account); health & fitness-type data handled on behalf of the provider (patient records viewed/entered by staff); precise location (only at home-visit check-in/SOS); device id (install id for device-bound sessions); push token.
* **Not collected:** advertising id, contacts, photos. **No tracking**, no third-party analytics SDKs.
* Purposes: app functionality, security (session binding, alerts). Data stays on the product servers; offline cache/queue is on-device and cleared on sign-out.
* iOS: camera, Face ID, location-when-in-use usage strings are set in `app.json`. Android permissions: CAMERA, USE_BIOMETRIC, ACCESS_FINE_LOCATION.
* Account deletion is handled by the employer organisation (staff accounts are provisioned by the provider owner); state this in the store listing.

## Review notes / demo accounts
Provide reviewers a PRO account per product from TEST_DATA.md **against a staging API with demo seed (never production)**: Clinic `nadia.na@demo.kiorex.test`, Pharmacy `pharmacist@demo.kiorly.local`, Lab org `demo-lab` / `signatory@demo-lab.test`; and a Basic account (`owner.basic@demo.kiorex.test`) to show the upgrade screen. Explain: staff-only app, sign-in required, camera is used for barcode scanning, location only on home-visit safety actions, safety alerts available on every plan.

## Versioning
`version` in `app.json`; `appVersionSource: remote` + `autoIncrement` for production builds. The API sees `X-Kiorly-Client: kiorly/<version>` and `appVersion` at device registration (use for forced-update later).
