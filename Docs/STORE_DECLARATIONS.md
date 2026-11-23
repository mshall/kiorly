# Store declarations: ready-to-paste answers (DRAFT)

> DRAFT prepared 23 Nov 2026 from what the app does today (`app.json`, `SECURITY.md`). Nothing has been submitted. Store questionnaires change often: wording below follows the 2025/2026 forms, so re-read each question in the console and change an answer if the code changes (for example a crash reporter or analytics SDK would flip several answers). Counsel should confirm these answers match the privacy policy. Founder-only steps are in [NEEDS_HUMAN.md](NEEDS_HUMAN.md).

Facts these answers rest on: no analytics, ads or crash-reporting SDK; no tracking; staff accounts provisioned by the employer organisation (no public sign-up, no payments in the app); biometrics handled by the OS only; permissions are camera (barcode scan), Face ID/biometric, location while in use (home-visit check-in and safety button), push notifications; data goes only to the product APIs (Clinic, Pharmacy, Lab) over HTTPS and to Apple/Google push delivery.

## 1. Apple: App Privacy ("nutrition label")

**Tracking:** Does this app track users? **No.** (No data is linked with third-party data for ads or shared with data brokers.) Do not add an App Tracking Transparency prompt; `NSUserTrackingUsageDescription` must stay absent.

| Apple data type | Collected? | Linked to the user? | Used for tracking? | Purpose to tick |
|---|---|---|---|---|
| Contact Info > Name | Yes | Yes | No | App Functionality |
| Contact Info > Email Address | Yes | Yes | No | App Functionality |
| Contact Info > Phone Number (Passport sign-in) | Yes | Yes | No | App Functionality |
| Health & Fitness > Health (patient clinical data staff view or enter on behalf of the provider) | Yes | Yes | No | App Functionality |
| Location > Precise Location (check-in, safety button only) | Yes | Yes | No | App Functionality |
| Identifiers > User ID (staff account id) | Yes | Yes | No | App Functionality |
| Identifiers > Device ID (install id for device-bound sessions) | Yes | Yes | No | App Functionality |
| Sensitive Info, Financial Info, Contacts, User Content (photos, audio, other), Browsing/Search History, Purchases, Usage Data, Diagnostics, Surroundings, Body, Other Data | **No** | n/a | n/a | n/a |

Notes for the console:
- Face ID/fingerprint data is not collected (OS only). Camera is used for on-device scanning; images are not stored or uploaded.
- Push token is part of Device ID. It is used only for delivery.
- "Health" is declared because staff screens show and edit patient records on behalf of the provider. This is the conservative answer.
- Privacy Policy URL: https://kiorly.com/privacy. User Privacy Choices URL: leave empty.

**Other App Store Connect answers**
- Age rating questionnaire: no violence, sexual content, profanity, gambling, horror, contests, unrestricted web access or user-generated content. Medical/wellness topics: answer per the console wording; the app is a professional records tool and gives no medical advice. Expected rating 4+ (the console computes it).
- Export compliance: the app uses only OS-provided HTTPS/TLS. Answer "uses encryption" then "exempt (standard/OS encryption only)"; consider setting `ITSAppUsesNonExemptEncryption=false` in `app.json` (a code change, not made here).
- Content rights: yes, own content. Advertising identifier (IDFA): No.
- Account deletion (Guideline 5.1.1(v)): the app has no in-app account creation, accounts are provisioned by the employer, so in-app deletion is not required; explain this in review notes and give the support route (organisation owner or support@kiorly.com).
- Medical/health review (5.1.3): no HealthKit, no clinical diagnosis claims, patient data is the provider's.
- Review notes and demo accounts: see [STORE_RELEASE.md](STORE_RELEASE.md) (staging only, never production).
- Sign in with Apple is not required: the app signs in with the organisation's own identity (Kiorex Passport / workplace login), not a third-party social login. Mention this in the notes.

## 2. Google Play: Data safety

**Does your app collect or share any of the required user data types?** Yes (collects). **Is all of the user data collected by your app encrypted in transit?** Yes. **Do you provide a way for users to request that their data is deleted?** Yes. Deletion URL / instructions: https://kiorly.com/support (staff accounts through the organisation's owner or support@kiorly.com; patient records through the clinic, pharmacy or lab).

"Shared" in Google's definition excludes processors acting on behalf of the provider and the OS push service; answer **Not shared** for every type below. (Counsel to confirm.)

| Google data type | Collected | Shared | Required or optional | Purposes |
|---|---|---|---|---|
| Personal info > Name | Yes | No | Required | App functionality, Account management |
| Personal info > Email address | Yes | No | Required | App functionality, Account management |
| Personal info > Phone number | Yes | No | Optional (only with Passport phone sign-in) | App functionality, Account management |
| Personal info > User IDs | Yes | No | Required | App functionality, Account management |
| Health and fitness > Health info | Yes | No | Required | App functionality |
| Location > Precise location | Yes | No | Optional (user may deny) | App functionality |
| Device or other IDs | Yes | No | Required | App functionality, Fraud prevention, security, and compliance |
| App activity, App info and performance (crash logs, diagnostics), Web browsing, Messages, Photos and videos, Audio, Files and docs, Calendar, Contacts, Financial info | **No** | n/a | n/a | n/a |

Other Play answers
- Independent security review: No. Data is processed ephemerally: No (stored by the product servers).
- Biometrics: not collected (device biometric prompt only).
- Privacy policy URL: https://kiorly.com/privacy (must be a working public page, not a PDF).
- App access: all or some functionality is restricted. Supply demo credentials against the staging API (see STORE_RELEASE.md) and the sign-in instructions.
- Ads: No ads. Target audience: 18 and over only (staff app); not designed for children. News app: No. Government app: No. Financial features: None. COVID-19 app: No.
- **Health apps declaration** (Play Console > App content): the app handles health information for professional use. Answer: it is a healthcare staff/clinic-management tool, not a consumer fitness app; does not use Health Connect or health sensors; does not diagnose, treat or claim to be a medical device; handles health information as a service provider for clinics, pharmacies and labs. Choose the closest category in the form (clinic/healthcare provider tools, not "clinical decision support" and not "disease management") and confirm the exact options in the console.
- Permissions: CAMERA (barcode scan), USE_BIOMETRIC (lock), ACCESS_FINE_LOCATION (foreground only, check-in and safety), POST_NOTIFICATIONS (alerts). No background location, no SMS or call log, so no permission declaration forms are expected beyond the standard ones.
- Foreground service or full-screen intent: none.
- Category Medical; contact email support@kiorly.com; website https://kiorly.com/app.

## 3. Content rating (Google IARC questionnaire)

Category: Utility / Productivity or Reference (professional tool). Answers: violence No; blood or gore No; sexual content or nudity No; profanity No; controlled substances: the app handles pharmacy dispensing workflows for professionals but does not depict or promote drug use, answer No; gambling No; user-generated content shared publicly No; unrestricted internet access No; digital purchases No; location shared with other users: **Yes, limited** (a staff member's location in a safety alert goes to their own team); the staff member can see it before sending. Expected result: Everyone / PEGI 3 (the form decides; confirm in the console and do not change answers to lower it).

## 4. Screenshot shot list

Use the staging API with the demo seed only (never real patients or real staff). One capture set in **light** and one in **dark**, in **Arabic (RTL)** and **English**. Use the simulators' status bars (9:41, full battery). Frame-less raw screens; captions are added as top text in the brand indigo `#3730A3` on `#F4F6FC`, no device mock-up claims.

| Device size (store requirement) | Pixels (portrait) | Store |
|---|---|---|
| iPhone 6.9" (required; scales down to 6.5/6.3/6.1) | 1320 x 2868 | App Store |
| iPhone 6.5" (only if no 6.9" set is given) | 1284 x 2778 | App Store |
| iPad 13" (required because `supportsTablet` is true) | 2064 x 2752 | App Store |
| Android phone (min 2 and max 8; 16:9 to 9:16, side 320 to 3840) | 1080 x 1920 or larger | Google Play |
| Android 7" and 10" tablet (recommended) | 1200 x 1920 / 1600 x 2560 | Google Play |
| Feature graphic (required) | 1024 x 500 | Google Play |
| App icon (Play) | 512 x 512 | Google Play |

Recommended six shots for every size (iPhone and Android phone; reuse the same six on tablets with the tablet layout):

| # | Screen to capture | Caption EN | Caption AR |
|---|---|---|---|
| 1 | Today's schedule (Clinic module) | Your day at a glance | يومك في نظرة واحدة |
| 2 | Patient visit: vitals and notes | Vitals and visit notes in seconds | العلامات الحيوية وملاحظات الزيارة في ثوانٍ |
| 3 | Nurse home-visit round with safety button | Safer home visits | زيارات منزلية أكثر أمانًا |
| 4 | Pharmacy: scan stock / verify prescription | Scan, verify, dispense | امسح وراجع واصرف |
| 5 | Lab: collection round and critical alert | Never miss a critical result | لا تفوّت أي نتيجة حرجة |
| 6 | Biometric lock + devices screen | Locked to you, signed out anywhere | مقفل بك، وتسجّل الخروج من أي مكان |

Optional extras: sign-in with Kiorex Passport (screen 0), offline banner and sync ("Works offline" / "يعمل دون اتصال"), dark mode.

Rules: do not show real names, phone numbers or results; demo names only; no competitor or store logos; the "by Kiorex" lockup may appear only where the app itself shows it (splash, About).
Feature graphic: Kiorex mark with the Kiorly accent from `_brand`, text "Kiorly" and the subtitle in the listing language.
