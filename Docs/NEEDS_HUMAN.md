# NEEDS_HUMAN: Kiorly staff app store launch (only what the founder or counsel must do)

Updated 23 Nov 2026. Everything an agent could do is already drafted: store copy ([STORE_LISTING.md](STORE_LISTING.md)), policy and terms pages ([store-pages/](store-pages/index.html)), store questionnaire answers and screenshot list ([STORE_DECLARATIONS.md](STORE_DECLARATIONS.md)). All of it is **DRAFT**: no legal review, no native Arabic review, nothing submitted, no store account exists, no page is hosted. Provider go-live items (real push, WhatsApp, PSPs) stay in each product's `Docs/NEEDS_HUMAN.md`.

## Placeholders to confirm (one table)

| Item | Recommended value | Used in | Confirm by |
|---|---|---|---|
| Privacy policy URL | https://kiorly.com/privacy | both stores, app About | item 5 |
| Terms URL | https://kiorly.com/terms | app About, listing | item 5 |
| Support URL | https://kiorly.com/support | both stores | item 5 |
| Marketing URL | https://kiorly.com/app | App Store marketing URL, Play website | item 5 (page content also needed) |
| Support email | support@kiorly.com | stores, all pages, policy contact | item 4 |
| Bundle id / package | com.kiorly.app | `app.json`, `eas.json` | items 1, 2 |
| Legal entity name, registration no., address | not decided | policy, terms, store seller name | item 3 |
| Retention periods (account closure, security logs) | `[X days]` in the pages | privacy page | item 6 |
| Support hours | not decided | support page | item 4 |
| Subtitle EN | "For clinics, pharmacies & labs" (the "and" version is 32 chars, limit is 30) | App Store | item 7 |
| Title AR | "كيورلي: عيادة وصيدلية ومعمل" (the earlier form is 33 chars, limit is 30) | both stores | item 7 |

## 1. Apple Developer: enrol, register `com.kiorly.app`, reserve the name
1. Enrol the **company** (not an individual) at developer.apple.com/programs/enroll: needs the D-U-N-S number (item 3), a legal entity email on the company domain, and a person with authority to sign for the company. Fee USD 99 per year. Approval can take days.
2. Certificates, Identifiers & Profiles > Identifiers > new App ID, bundle id `com.kiorly.app`; enable Push Notifications. Create an APNs auth key (.p8), keep the key id and team id for EAS (`eas credentials`).
3. App Store Connect > My Apps > New App: platform iOS, name **Kiorly** (this reserves the name; build must follow within the reservation window), primary language English (add Arabic), bundle id `com.kiorly.app`, SKU `kiorly-app`.
4. Paste the listing text and answers from STORE_LISTING.md and STORE_DECLARATIONS.md. Accept the free-apps agreement; tax and banking forms are not needed for a free app.
5. Give the agent the team id, key id and app id so it can wire `eas.json` submit settings.

## 2. Google Play Console: create the app
1. Create an **organisation** developer account at play.google.com/console (USD 25 once; needs D-U-N-S and identity verification, item 3). An organisation account avoids the closed-testing rule for new personal accounts.
2. Create app > name **Kiorly: Clinic, Pharmacy & Lab**, default language English (add Arabic), App, Free. Package name `com.kiorly.app` is set by the first upload.
3. Turn on Play App Signing. Create a Firebase project and add the Android app `com.kiorly.app` for FCM, then give the agent `google-services.json` through EAS secrets (never in git).
4. Fill App content (privacy policy, ads, app access, Data safety, content rating, target audience, Health apps) with STORE_DECLARATIONS.md.

## 3. D-U-N-S and company details
1. Look up or request a D-U-N-S number for the legal entity (free through Apple's lookup at developer.apple.com/enroll/duns-lookup; allow up to about 30 days for a new number).
2. Decide and send the agent: legal entity name exactly as registered, commercial register number, registered address, public phone, website. These replace the bracketed placeholders in the pages and become the store seller name (visible publicly).

## 4. Support mailbox
1. Create `support@kiorly.com` on the company mail provider; add SPF, DKIM and DMARC for kiorly.com.
2. Assign an owner and a backup; set an auto-reply (AR and EN) that says not to send patient details; decide support hours.
3. Send a test message from outside to confirm delivery before the pages go live.

## 5. Host the pages
1. Upload the contents of `Docs/store-pages/` (index, 2 policy pages, 2 terms pages, support, style.css) to the kiorly.com site (static hosting or CDN; any deploy needs your go-ahead).
2. Route extension-less URLs: `/privacy` to `privacy.en.html` with an Arabic switch to `privacy.ar.html` (or choose by `Accept-Language`), `/terms` to `terms.en.html` / `terms.ar.html`, `/support` to `support.html`. Pages must open without sign-in on a phone, over HTTPS, not as PDF.
3. Create the marketing page `/app` (not drafted: needs your product copy). Reuse the listing text.
4. Do **not** remove the `noindex` tag and the DRAFT banner until item 6 is signed off. Apple and Google require a live URL at submission, so publish the draft with the banner only if counsel agrees it is acceptable, otherwise finish item 6 first.

## 6. Counsel review of privacy policy and terms (DRAFT - counsel review required)
Send `privacy.en.html`, `privacy.ar.html`, `terms.en.html`, `terms.ar.html` to an Egyptian lawyer with healthcare data experience. Questions to settle (each is also highlighted in yellow in the pages):
1. Controller/processor split: provider is controller of patient data, Kiorex is processor, and controller of staff account/security data. A data processing agreement template for each provider.
2. Egypt Personal Data Protection Law No. 151 of 2020 and its executive regulations: current status, licensing or registration with the Personal Data Protection Centre, data protection officer, breach notification wording, and health data as sensitive data (consent rules).
3. Cross-border transfer: servers are in Frankfurt (AWS eu-central-1). Is a permit or notification needed?
4. Retention periods for account data, logs and medical records (Egyptian rules on medical record retention).
5. Sub-processor list at launch, and the statement that patient data is not used to train AI models.
6. Liability limits, governing law (proposed Egypt law, Cairo courts) and the safety-alert disclaimer in the terms.
7. Whether the minimum age of 18 and the "no accounts for children" text is right for staff of clinics.
Counsel's written approval is what lets the agent remove the DRAFT banner. No agent may record that sign-off.

## 7. Native Arabic reviewer pass
1. Give a native Egyptian healthcare-literate reviewer `store-copy.json` (Arabic fields), `privacy.ar.html`, `terms.ar.html`, the Arabic FAQ in `support.html`, and the Arabic screenshot captions in STORE_DECLARATIONS.md.
2. Ask them to check tone for clinics, pharmacies and labs (MSA with familiar Egyptian terms such as معمل), medical terms, brand spelling كيورلي / كيوريكس باسبورت, and the 30-character title (re-run `node Docs/scripts/check-store-limits.mjs` after edits).
3. Decide the two wording changes in the placeholder table (subtitle "&", Arabic title without the definite article).

## 8. Kiorex Passport production client for the app
1. In the production Passport (Cognito, needs the AWS account owner), create the public app client `kiorly` with authorization code + PKCE, no client secret, scopes `openid profile phone kx kx_org offline_access`, redirect `kiorly://auth/callback`, sign-out `kiorly://auth/logout`. Repeat for staging first.
2. Give the agent the issuer URL; it sets `EXPO_PUBLIC_PASSPORT_ISSUER` in the EAS production environment, and each product API gets `AUTH_MODE=oidc` with `kiorly` as an accepted client. These need your go-ahead because they touch production.
3. Reviewers need a **staging** API with demo data reachable from the internet (see STORE_RELEASE.md review notes). Deploying staging also needs your go-ahead.

## Not on this list (done as drafts, awaiting the items above)
Arabic and English store text within length limits, the static pages, the Apple and Google questionnaire answers, the screenshot shot list. Screenshots themselves still have to be captured on a built app once staging exists.
