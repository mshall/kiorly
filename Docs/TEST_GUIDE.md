# Kiorly staff app test guide (DEV ONLY)

> **DEV ONLY / synthetic.** All names, phones, e-mails, passwords, OTPs and TOTP seeds below are fake values for the local stack; they are refused when `NODE_ENV=production` and the sign-in quick-pick ("Test users (dev only)") is not in production builds. Providers are mocked (dev inbox / logs, PSP `sandbox-fake`, video `mock`). No tax-authority integration.
> This guide is the repo's slice of the workspace guide `TEST_GUIDE.md` (parent folder `kiorex-v2/`, not part of this repository). Facts verified against the seeds and dev databases on 23 Nov 2026.

## Run the stack and seed it

```bash
# from the workspace root (kiorex-v2/): Postgres :5433 + the five APIs (Passport :4400, Kiorly :3010, Kiorex :4000, Pharmacy :3100, Lab :3200)
e2e/scripts/up.sh --build --seed      # first time; later just e2e/scripts/up.sh (stop: e2e/scripts/down.sh)
scripts/seed-all.sh                   # idempotent demo data in dependency order (--reset re-creates demo rows only)
```
One service only: `e2e/scripts/up.sh --restart --only=passport|kiorly|kiorex|pharmacy|lab > /tmp/up.log 2>&1`. Never touch ports 3000 / 5173 / 5175. Tests you run change data (a cancel stays cancelled): re-seed for the starting state.

```bash
cd kiorly-team
npm run web                 # Expo web :8082 (use phone width)
npx jest                    # incl. src/__tests__/devTestUsersBundle.test.ts
npm run check:dev-test-users
```

The app talks to Clinic :3010, Pharmacy :3100 and Lab :3200 (`.env.local` wins over `.env.example`). Seeds: the three `*:mobile` seeds, already part of `scripts/seed-all.sh`.

## The Test users (dev only) panel

`src/dev/DevTestUsers.tsx` + `src/dev/demoAccounts.ts`, loaded behind `__DEV__ && EXPO_PUBLIC_DEV_TEST_USERS !== "false"`. Per product tile (Clinic, Nurse, Pharmacy, Lab) a chip fills the credentials (and the org for Lab), then press Sign in. Absent from production exports (`scripts/check-no-dev-test-users.mjs`).

Dev-only secrets: Passport OTP for every seeded phone **`000000`**; staff password **`Demo@12345`** (older Clinic accounts `admin@kiorly.com`, `superadmin@kiorly.com`, `admin@drahmedshall.com`: **`demo`**); Lab dev-login has no password; Postgres `postgres` / `postgres`.

## Test users: 3.6 Kiorly staff app (:8082)

The sign-in has four tiles: Clinic, Nurse, Pharmacy, Lab; the chips are per tile. Clinic: Dr Nadia, nurse.na, owner.na, receptionist, accountant, Basic owner / doctor / nurse. Nurse: Mona (solo), Heba (agency), Aya (aide), Dina (dispatcher), agency owner, nurse.na. Pharmacy: owner, pharmacist, manager (witness), cashier, solo owner, Basic owner. Lab: owner, signatory, tech, phleb, reception, Basic-lab director (org field is filled by the chip).

## Flows

### 4.8 Kiorly staff app (W1-W15)

Run `cd kiorly-team && npm run web` and open http://localhost:8082 at phone width.

1. **Bootstrap.** Clinic tile, chip **Doctor (Nile Care)**, Sign in. *Expected:* Home with quick actions and the Work tab tiles.
2. **Sign a prescription (Dr Nadia).** Work -> Prescriptions -> pending Cetirizine 10 mg for Hoda -> Sign: moves to signed; signing is online-only; `nurse.na@` sees no sign action.
3. **Critical lab result.** Work -> Lab results: potassium 6.9 CRITICAL_HIGH for Hoda; approve with a note: reviewed and audited, idempotent.
4. **Flag off / Basic.** Chips **Owner (Basic clinic)**, Basic pharmacy, Basic lab: each lands on the upgrade screen with only the safety-alert inbox; with `mobile_staff_app` OFF for an org (workspace guide 4.4 step 6) the bootstrap returns `FLAG_OFF`.
5. **Nurse round.** Nurse tile, chip **Solo nurse Mona** (lands on rounds): depart, arrive, finish, SOS.
6. **Vitals.** `nurse.na@`: enter systolic 220 or SpO2 80: a CRITICAL_VITALS alert shows in Inbox and the Home strip.
7. **Pharmacy.** Pharmacist: Rx queue and override with reason; manager: barcode, receiving, stock count, expiry; witness rule for the controlled discrepancy (workspace guide 4.6 step 6).
8. **Lab.** Phlebotomist collects a specimen; Technologist accessions; Signatory acknowledges criticals and validates/releases.
9. **Offline queue.** Go offline in devtools, save vitals and mark an alert read: "Saved offline (n waiting)"; go online: the queue syncs.
10. **Owner revenue and devices.** `owner.na@`: Revenue today / 7 / 30 days; Me -> Devices, remote sign-out.
11. **Language, theme, sign-out.** Arabic default (RTL) and English; light and dark; Sign out asks for confirmation from Home and Me.

More: `DEMO_DATA.md` (W1-W15).
