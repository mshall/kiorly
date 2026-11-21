# Kiorly Work (staff mobile app): demo data and manual test guide (DEV ONLY)

> **DEV ONLY / synthetic.** Kiorly Work is one Expo app for the staff of Kiorly Clinic, Pharmacy and Lab. It owns **no data**: everything comes from the three product APIs (`/mobile/*`), so the demo is "the three product demos + the mobile seeds". Workspace index: [../DEMO_DATA.md](../DEMO_DATA.md) · shared tables: [../TEST_DATA.md](../TEST_DATA.md) · seed notes: [Docs/TEST_DATA.md](Docs/TEST_DATA.md) · design: [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md), [Docs/ENTITLEMENTS.md](Docs/ENTITLEMENTS.md), [Docs/OFFLINE_SYNC.md](Docs/OFFLINE_SYNC.md).
> Matrices below come from `GET /mobile/bootstrap` called for every demo login against the running APIs on 21 Nov 2026 (clinic :3010, pharmacy :3100, lab :3200), not from documentation. Passwords are local development values (`Demo@12345`); lab uses dev-login without a password.

## 1. What this demo is for

* Plan gating: the entitlement `mobile_staff_app` is ON for PRO and ENTERPRISE, OFF for BASIC (Lite). A BASIC org sees an **upgrade screen**, but the **safety-alert inbox keeps working on every plan** (ADR-025: safety controls are never commercial flags).
* Role gating: the modules (tiles) a person sees are the bootstrap `modules[].enabled` for their role.
* Real work on the phone: schedule and queue, sign a prescription, approve a critical lab result, vitals, home-visit rounds with SOS; Rx queue with override, barcode, receiving, stock count, expiry, controlled-drug countersign; phlebotomy, accessioning, critical values, validation, QC, TAT; offline queue with conflict handling; device management with remote sign-out; mock push + inbox; global search; barcode/QR scan.

## 2. Start and seed

```bash
e2e/scripts/up.sh [--build] [--seed]            # workspace root: the three APIs (+ Passport, Kiorex) the app talks to
scripts/seed-all.sh                             # base demo data first (idempotent)
cd clinics-management/apps/api && npm run db:seed:mobile       # Clinic: Basic clinic, mobile alerts, pending Rx + critical result (needs db:seed:demo first)
cd kiorly-pharmacy/apps/api    && npm run seed:mobile          # Pharmacy: Solo (PRO) + Corner (BASIC) tenants + alerts (also in seed:all)
cd kiorly-lab/apps/api         && npm run db:seed:mobile       # Lab: chain-lab (ENTERPRISE) + basic-lab (BASIC) tenants + alerts
```
All three are idempotent and guarded (`DEMO_SEED_ALLOWED=true`, non-production). Re-running re-opens the demo alerts.

Run the app (`cd kiorly-work && npm install` once; own lockfile and `.npmrc` with `legacy-peer-deps`):

| Target | Command | Notes |
|---|---|---|
| **Expo web** | `npm run web` -> `http://localhost:8082` | open at a phone-sized window (about 390 px). The APIs already allow the 8082 origin (verified with a CORS preflight on the clinic API; pharmacy/lab default `CORS_ORIGINS` include it). Native-only features (biometric lock, camera scan, push tokens, location) degrade on web. |
| **iOS Simulator** | `npm run ios` (= `expo start --ios`) | `localhost` reaches the Mac, so the default API URLs work. Xcode and an iPhone simulator exist on this Mac; the docs state a native run was not exercised, treat it as untested. Face ID, camera and push need a real device or dev client. |
| **Android emulator** | `npm run android` (= `expo start --android`) | In the emulator `localhost` is the emulator itself: set `EXPO_PUBLIC_CLINIC_API=http://10.0.2.2:3010/api/v1`, `EXPO_PUBLIC_PHARMACY_API=http://10.0.2.2:3100/api/v1`, `EXPO_PUBLIC_LAB_API=http://10.0.2.2:3200/api/v1` (10.0.2.2 reaches the Mac's loopback). Android Studio / `adb` are not installed on this Mac. |
| **Physical phone** | `npm start`, scan the QR in Expo Go (or an EAS dev client) | use the Mac's LAN IP in the three `EXPO_PUBLIC_*_API` variables; pharmacy (`:3100`) and lab (`:3200`) APIs listen on `127.0.0.1` only, so start them with a LAN bind first. Push is mock. |

* Defaults come from `.env.example` (3010 / 3100 / 3200). **`kiorly-work/.env.local` currently points at 3011 / 3190 / 3250** (an alternate stack): delete it or edit it, otherwise sign-in will hit nothing on the standard stack.
* The sign-in screen has **demo chips** (dev builds) that fill the e-mail, password and lab org slug for you.
* Bundle ids `com.kiorly.work` are placeholders until the store accounts exist (NEEDS_HUMAN).

## 3. Personas (sign-in screen: pick the product tab, then the chip or type e-mail + password; Lab: org slug + e-mail)

Sign-in is **per product**: the app keeps one session per product, so one person can be signed in to several. All logins below were checked against `/mobile/bootstrap` on 21 Nov 2026.

### Clinic (API `:3010`, password `Demo@12345`)

| Login | Name | Role | Org / plan | Shows |
|---|---|---|---|---|
| `nadia.na@demo.kiorex.test` | Dr Nadia Fouad | PHYSICIAN | Nile Care / PRO | schedule + live queue (today: 4 visits, 1 waiting, 3 completed), prescription **awaiting signature** (`demo_enc_mobile_rx`, Cetirizine 10 mg, patient Hoda), a **critical potassium 6.9 mmol/L** result to approve (`demo_co_mobile_crit`) + a normal result, 1 SOS alert on a home visit |
| `nurse.na@demo.kiorex.test` | Nurse Nile Care | NURSE | Nile Care / PRO | schedule, patients, lab results (view), vitals, home visits |
| `owner.na@`, `accountant.na@`, `frontdesk1.na@`, `manager.na@`, `callcenter.na@demo.kiorex.test` | Ahmed Fawzy etc. | GROUP_ADMIN / FINANCE_OFFICER / RECEPTIONIST / BRANCH_MANAGER / CALL_CENTER | Nile Care / PRO | per matrix; owner and accountant see the **revenue snapshot** |
| `mona@nurse-demo.kiorly.test` | Mona Adel | PHYSICIAN (solo nurse) | Demo Home Nursing (Mona) / PRO (NURSE_PRO) | home-visit round (route, depart / arrive / finish / SOS), lab samples, **12 open safety alerts** (SOS, missed check-in, unsafe abort) |
| `owner@nurse-demo.kiorly.test` | Agency Owner | CLINIC_ADMIN | Demo Care Agency / ENTERPRISE (NURSE_AGENCY) | every module; sees every device and every agency alert |
| `dispatch@` (Dina), `nurse1@` (Heba), `aide@` (Aya) `nurse-demo.kiorly.test` | | RECEPTIONIST (dispatcher) / PHYSICIAN (nurse) / PHYSICIAN (aide) | Demo Care Agency / ENTERPRISE | per matrix |
| `admin@kiorly.com` (password `demo`) | Group Administrator | GROUP_ADMIN | Kiorly Clinic Group (Demo) / ENTERPRISE | all clinical modules + device management |
| `owner.basic@`, `doctor.basic@`, `nurse.basic@demo.kiorex.test` | Ramy Hafez / Dr Heba Lotfy / Mervat Adel | GROUP_ADMIN / PHYSICIAN / NURSE | Corner Family Clinic / **BASIC** | upgrade screen + 1 open critical-vitals alert to acknowledge |

### Pharmacy (API `:3100`, password `Demo@12345`)

| Login | Role | Tenant / plan | Shows |
|---|---|---|---|
| `owner@`, `manager@`, `pharmacist@`, `pharmacist2@`, `cashier@`, `assistant@`, `chain@demo.kiorly.local` | OWNER / BRANCH_MANAGER / PHARMACIST / PHARMACIST / CASHIER / ASSISTANT / CHAIN_OPS | Kiorly Demo Pharmacy / ENTERPRISE (CHAIN) | per matrix; the **controlled-drug discrepancy** (Morphicure 10 mg (DEMO): expected 40, counted 38) awaiting a witness |
| `solo.owner@`, `solo.pharmacist@`, `solo.manager@`, `solo.cashier@`, `solo.assistant@demo.kiorly.local` | OWNER / PHARMACIST / BRANCH_MANAGER / CASHIER / ASSISTANT | Kiorly Solo Pharmacy (DEMO) / PRO (STANDALONE) | per matrix; no Kiorex orders |
| `owner.basic@`, `pharmacist.basic@`, `cashier.basic@demo.kiorly.local` | OWNER / PHARMACIST / CASHIER | Kiorly Corner Pharmacy (DEMO, Lite) / **BASIC** | upgrade screen + the safety inbox (controlled-drug discrepancy) |

### Lab (API `:3200`, dev login: slug + `<role>@<slug>.test`, no password)

| Org slug | Plan | Roles available | Shows |
|---|---|---|---|
| `demo-lab` | PRO | owner, director, signatory (Dr. Salma, pathologist), tech (Omar), phleb (Nour), reception (Mona), manager, supervisor, finance | full app. Open alerts for the signatory right now: 5 escalated critical values (HB x3, K, positive blood culture), 4 TAT breaches (3 STAT, 1 URGENT), 1 QC failure (TSH `1_3s`) |
| `chain-lab` | ENTERPRISE (CHAIN) | the same 9 roles at `@chain-lab.test` | Delta Diagnostics Group: a pending phlebotomy order, an in-lab specimen, an order awaiting sign-off, 1 escalated critical HB, 2 STAT TAT breaches |
| `basic-lab` | BASIC | the same 9 roles at `@basic-lab.test` | upgrade screen + safety inbox (1 critical HB, 2 STAT TAT breaches) |

## 4. Role x module matrix (Y = tile shown; "-" = module OFF for that role)

**Clinic** (bootstrap `clinic.*`)

| Login (role, plan) | schedule | patients | visits | prescriptions | labs | vitals | homevisits | revenue |
|---|---|---|---|---|---|---|---|---|
| `nadia.na@` (PHYSICIAN, PRO) | Y | Y | Y | Y | Y | Y | - | - |
| `nurse.na@` (NURSE, PRO) | Y | Y | - | - | Y | Y | Y | - |
| `owner.na@` (GROUP_ADMIN, PRO) | Y | Y | Y | Y | Y | Y | - | Y |
| `accountant.na@` (FINANCE_OFFICER, PRO) | Y | - | - | - | - | - | - | Y |
| `manager.na@` (BRANCH_MANAGER, PRO) | Y | Y | - | - | - | Y | - | Y |
| `frontdesk1.na@` (RECEPTIONIST, PRO) | Y | Y | - | - | - | - | - | - |
| `callcenter.na@` (CALL_CENTER, PRO) | Y | Y | - | - | - | - | - | - |
| `mona@nurse-demo` (solo nurse, PRO) | Y | Y | - | - | Y | Y | Y | Y |
| `owner@nurse-demo` (CLINIC_ADMIN, ENTERPRISE) | Y | Y | Y | Y | Y | Y | Y | Y |
| `nurse1@`, `aide@nurse-demo` (ENTERPRISE) | Y | Y | - | - | Y | Y | Y | - |
| `dispatch@nurse-demo` (RECEPTIONIST, ENTERPRISE) | Y | Y | - | - | - | - | - | - |
| `admin@kiorly.com` (GROUP_ADMIN, ENTERPRISE) | Y | Y | Y | Y | Y | Y | - | Y |
| `owner.basic@`, `doctor.basic@`, `nurse.basic@` (BASIC) | - | - | - | - | - | - | - | - (safety inbox only) |

**Pharmacy** (bootstrap `pharmacy.*`: rx, barcode, receiving, stockcount, expiry, controlled, shift, customers, orders, search)

| Login (role, plan) | rx | barcode | receiving | stockcount | expiry | controlled | shift | customers | orders | search |
|---|---|---|---|---|---|---|---|---|---|---|
| `owner@`, `pharmacist@`, `pharmacist2@`, `manager@` (ENTERPRISE) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| `cashier@` (CASHIER, ENTERPRISE) | Y | Y | - | - | Y | - | Y | Y | - | Y |
| `assistant@` (ASSISTANT, ENTERPRISE) | Y | Y | Y | Y | Y | - | Y | Y | - | Y |
| `chain@` (CHAIN_OPS, ENTERPRISE) | - | Y | - | - | Y | - | - | Y | Y | Y |
| `solo.owner@`, `solo.pharmacist@`, `solo.manager@` (PRO, STANDALONE) | Y | Y | Y | Y | Y | Y | Y | Y | - | Y |
| `solo.cashier@` (PRO) | Y | Y | - | - | Y | - | Y | Y | - | Y |
| `solo.assistant@` (PRO) | Y | Y | Y | Y | Y | - | Y | Y | - | Y |
| `owner.basic@`, `pharmacist.basic@`, `cashier.basic@` (BASIC) | - | - | - | - | - | - | - | - | - | - (safety inbox only) |

**Lab** (bootstrap `lab.*`: identical for `demo-lab` PRO and `chain-lab` ENTERPRISE)

| Role | phlebotomy | accession | critical | validation | worklist | qc | tat | orders | reagents |
|---|---|---|---|---|---|---|---|---|---|
| owner, director, supervisor | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| signatory (pathologist) | - | - | Y | Y | Y | Y | Y | Y | - |
| tech | - | Y | Y | Y | Y | Y | Y | Y | Y |
| phleb | Y | Y | - | - | - | - | - | Y | - |
| reception | Y | Y | - | - | - | - | Y | Y | - |
| manager | - | - | Y | - | Y | Y | Y | Y | Y |
| finance | - | - | - | - | - | - | Y | Y | Y |
| every role of `basic-lab` (BASIC) | - | - | - | - | - | - | - | - | - (safety inbox only) |

## 5. Manual test scripts

**W1. Sign in and the product bootstrap.** 1) Start Expo web (`npm run web`) at phone width. 2) Sign-in -> Clinic tab -> chip "Doctor (Nile Care) · PRO". 3) Sign in. *Expected:* Home with quick actions (schedule, vitals), Work tab with the 6 doctor tiles, Inbox with a welcome message and safety items. 4) Me -> add Pharmacy: chip "Pharmacist · ENTERPRISE". *Expected:* Home now aggregates both products; Work lists Clinic and Pharmacy tiles.

**W2. Sign a prescription (Dr Nadia).** 1) Work -> Prescriptions -> pending: Cetirizine 10 mg for Hoda Mahmoud. 2) Open, review, Sign. *Expected:* it moves to signed (last 7 days); signing is online-only (never queued offline). As `nurse.na@` the Prescriptions tile does not exist.

**W3. Approve a critical lab result (Dr Nadia).** 1) Work -> Lab results -> pending: potassium **6.9 mmol/L, CRITICAL_HIGH** (Hoda) with a normal result next to it. 2) Approve with a note. *Expected:* moves to reviewed and is audited; approving again is idempotent.

**W4. Vitals with a critical value (nurse.na).** 1) Work -> Vitals -> pick a patient, enter a dangerous value (for example systolic 220 or SpO2 80). *Expected:* saved; a CRITICAL_VITALS alert is raised and appears in the Inbox and the Home alert strip for clinical roles; acknowledge it (first acknowledger wins).

**W5. Home-visit round (Mona).** 1) Sign in `mona@nurse-demo.kiorly.test`. 2) Work -> Home visits (round): today's route. 3) Depart, Arrive (location stamp; web degrades), Finish. 4) Press SOS on a visit. *Expected:* an SOS alert (CRITICAL) in her inbox and in the agency owner's inbox; 12 open alerts are already seeded (SOS, missed check-in, unsafe abort).

**W6. Owner revenue and devices (owner.na, agency owner).** 1) `owner.na@` -> Revenue: today / last 7 / last 30 days. 2) Me -> Devices: the device list; the agency owner (`owner@nurse-demo`) sees every device in the org. 3) Remote sign-out one device. *Expected:* that device's next call returns 401 / `DEVICE_REVOKED` and it wipes its session.

**W7. Rx queue and override (pharmacist).** 1) Pharmacy tab -> Rx: queue (received / validating). 2) Open one: safety checks; an override requires a reason (pharmacist only). 3) As `cashier@` the Rx tile exists but override and sign-off are refused.

**W8. Barcode, receiving, count, expiry (manager/assistant).** 1) Barcode: scan or type a barcode `DM...` lot; the lot sheet shows status (a recalled or expired lot is flagged). 2) Receiving: open a SENT PO, scan lines. 3) Stock count: count lines (queueable offline). 4) Expiry: near-expiry (<= 30 d) and low-stock dashboards. *Expected:* `cashier@` has no Receiving or Count tile.

**W9. Controlled-drug countersign (witness rule).** 1) As `pharmacist@` (reporter) Controlled: balances + the Morphicure discrepancy (expected 40, counted 38). 2) Try to countersign it yourself: refused (a different person must witness). 3) Sign in as `manager@` (or `pharmacist2@`) -> Controlled -> pending witness -> countersign. *Expected:* the discrepancy closes with the witness name.

**W10. Lab phlebotomy and accession (phleb, tech).** 1) `demo-lab` / `phleb@demo-lab.test`: Phlebotomy round -> collect a specimen (queueable offline). 2) `tech@demo-lab.test`: Accession -> scan `DEMO-NL3-EDTA` -> received (the nurse-collected sample). 3) Worklist / QC / Reagents tiles visible.

**W11. Critical values, validation, QC (signatory).** 1) `signatory@demo-lab.test`: Critical -> the escalated HB 5.9 / K 6.8 / blood-culture alerts -> acknowledge. 2) Validation -> medically validate and release an order awaiting sign-off (online-only). 3) QC: the TSH `1_3s` failure is listed. 4) TAT: the 3 STAT + 1 URGENT breaches. *Expected:* `phleb@` has none of these tiles.

**W12. BASIC / Lite walkthrough (all three products).** 1) Clinic: `owner.basic@demo.kiorex.test`; Pharmacy: `owner.basic@demo.kiorly.local`; Lab: org `basic-lab`, `director@basic-lab.test`. 2) After sign-in each lands on the **upgrade screen** (entitlement `mobile_staff_app` disabled, requires PRO) and the Home shows an upgrade card; Work shows no module tiles. 3) Open the **Inbox / alerts**: clinic shows the open critical-vitals alert, pharmacy the controlled-drug discrepancy, lab the critical HB / STAT breaches. 4) Acknowledge one. *Expected:* it works on every plan. 5) With curl confirm the gate: `GET /mobile/schedule` (clinic) or `/mobile/pharmacy/controlled/pending-witness` with header `X-Kiorly-Client: kiorly-work` returns **403 `FEATURE_DISABLED` key `mobile_staff_app`**, while `GET /mobile/bootstrap` and `GET /mobile/alerts` return 200 (`entitlement.enabled=false`, `safetyAlertsOnly=true`).

**W13. Flag off for a PRO org.** In the Kiorex ops console (super admin) switch `mobile_staff_app` OFF at org scope (Nile Care or `org_demo_kiorly`). *Expected:* that org's bootstrap returns `reason: FLAG_OFF`, the app shows the same notice + upgrade screen, safety alerts still work. A plan below PRO can never be switched ON by a flag.

**W14. Offline queue and conflict.** 1) With a signed-in nurse, stop the network (browser devtools offline). 2) Save quick vitals and mark an alert read. *Expected:* "Saved offline", sync chip shows "Offline (n waiting)". 3) Go online. *Expected:* queue replays, chip returns to "All synced". 4) Edit a visit draft offline, change the same draft in Kiorly web, go online. *Expected:* the op is parked as a **conflict** and never overwrites. Prescription sign, lab approve, SOS/arrive and money actions are never queued.

**W15. Search, scan, language, theme, lock.** Global search (patients by name / phone / MRN, Rx, orders); scan screen with manual entry on web; switch Arabic (default, RTL) and English; light/dark; on a real device enable the biometric lock. Mock push: Me -> send a test push -> it arrives in the Inbox as DELIVERED.

## 6. What each role should and should not see (checklist)

| Role | Should see | Should NOT see |
|---|---|---|
| Physician | schedule, patients, visits, prescriptions, labs, vitals | revenue; home visits (nurse tile) |
| Nurse (clinic) | schedule, patients, labs (view), vitals, home visits | prescriptions, visits; cannot sign (profession NURSE) |
| Owner / group admin | all clinical + revenue, devices of the whole org | home-visit tile (not a nurse) |
| Finance officer | schedule + revenue only | patients, any clinical module |
| Front desk / call centre / dispatcher | schedule, patients | clinical, revenue |
| Pharmacist / manager | all 10 pharmacy modules (INTEGRATED), controlled countersign | n/a (a reporter cannot witness themselves) |
| Cashier | rx, barcode, expiry, shift, customers, search | receiving, count, controlled, orders |
| Chain ops | barcode, expiry, customers, orders, search | rx, receiving, count, controlled, shift |
| Lab phlebotomist | phlebotomy, accession, orders | critical, validation, qc, worklist |
| Lab signatory | critical, validation, worklist, qc, tat, orders | phlebotomy, accession, reagents |
| Lab finance | tat, orders, reagents | all bench modules |
| **BASIC (any product, any role)** | upgrade screen + safety-alert inbox | every module; every other `/mobile/*` call is 403 `FEATURE_DISABLED` |

## 7. Known limitations and inconsistencies found

* Providers are mocked: push is `MOBILE_PUSH_MODE=mock` (stored as inbox rows); real push/Expo tokens are refused until the provider go-live pass. Lab login is dev-login (no password); clinic and pharmacy use product login (e-mail + password), not Passport (Passport public-client flow is backlog).
* Native paths (biometrics, camera, push tokens, expo-location) are unit-tested with mocks and degrade on web; no simulator or device run is documented. Offline queue is stored unencrypted in AsyncStorage (backlog in `Docs/SECURITY.md`).
* `kiorly-work/.env.local` points at an alternate stack (3011 / 3190 / 3250), not at `.env.example` defaults.
* There is **no `README.md`** in this repo (every other repo has one); one pointer file was added only to link this document.
* Pharmacy and Lab web ports (5190 / 5191) clash with the Clinic *main* checkout; this app's 8082 and the patient app's 8081 do not.
* Matrix note: for `demo-lab` a `signatory` also has no `reagents`, and the lab alerts (critical values) are already ESCALATED by the scheduler, so a freshly-seeded "open, not escalated" state is only visible right after a seed.
* `admin@kiorly.com` still uses the legacy password `demo`; every other demo clinic login uses `Demo@12345`.
