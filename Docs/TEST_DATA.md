# Test data (DEV ONLY, fictional)

Run the three APIs (clinic 3010, pharmacy 3100, lab 3200, or alternates with `EXPO_PUBLIC_*_API`) with the demo seeds applied (`clinics-management`: `db:seed:demo` + `db:seed:mobile`; `kiorly-pharmacy`: `seed:mobile`; `kiorly-lab`: `db:seed:mobile`; or `scripts/seed-all.sh`). Staff password `Demo@12345`. The sign-in screen has demo chips in dev builds.

| Product | Plan | Login | Shows |
|---|---|---|---|
| Clinic Nile Care | PRO | `nadia.na@demo.kiorex.test` (doctor) / `nurse.na@` / `owner.na@` / `accountant.na@` / `frontdesk1.na@` / `manager.na@` (`@demo.kiorex.test`) | schedule/queue, sign prescription, approve a critical lab result, vitals, revenue (owner) |
| Clinic Nurse solo | PRO (NURSE_PRO) | `mona@nurse-demo.kiorly.test` | home-visit rounds, SOS, sample collection |
| Clinic agency | ENTERPRISE | `owner@nurse-demo.kiorly.test`, `admin@kiorly.com` | |
| Clinic Corner Family Clinic | **BASIC** | `owner.basic@`, `doctor.basic@`, `nurse.basic@demo.kiorex.test` | upgrade screen + safety alert inbox |
| Pharmacy Demo (CHAIN) | ENTERPRISE | `owner@`, `pharmacist@`, `manager@`, `cashier@`, `assistant@demo.kiorly.local` | Rx queue + override, barcode, receiving, count, expiry, witness countersign (reporter `pharmacist@`, witness `manager@`) |
| Pharmacy Solo | PRO | `solo.owner@`, `solo.pharmacist@`, `solo.manager@`, `solo.cashier@demo.kiorly.local` | |
| Pharmacy Corner (Lite) | **BASIC** | `owner.basic@`, `pharmacist.basic@`, `cashier.basic@demo.kiorly.local` | upgrade + alerts |
| Lab `demo-lab` | PRO | org `demo-lab`, `owner|director|signatory|tech|phleb|reception|manager|supervisor@demo-lab.test` | phlebotomy, accession, critical values, validation (`signatory@` = pathologist) |
| Lab `chain-lab` | ENTERPRISE | same pattern `@chain-lab.test` | |
| Lab `basic-lab` | **BASIC** | org `basic-lab`, `director@basic-lab.test` | upgrade + alerts |
Lab sign-in uses org slug + email (dev login, no password).
