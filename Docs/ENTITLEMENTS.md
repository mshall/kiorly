# Entitlements: `mobile_staff_app`

Kiorly Work is a **commercial entitlement**, ON for **PRO and ENTERPRISE**, OFF for Basic/Starter. It is *not* a safety control (ADR-025).

| Product | Plan source | BASIC (off) | PRO / ENTERPRISE (on) |
|---|---|---|---|
| Clinic | `PlanEntitlement` key in `src/entitlements/plans-matrix.ts` (+ per-tenant override, Kiorex flag snapshot) | `LITE`, `NURSE_LITE` | `PRO`, `CLINIC`, `ENTERPRISE`, `NURSE_PRO`, `NURSE_AGENCY` |
| Pharmacy | `Tenant.edition` + `FeatureFlagsService.evaluate("mobile_staff_app")` | `LITE` | `PRO`, `CHAIN`, `ENTERPRISE` (not when subscription SUSPENDED) |
| Lab | `Tenant.edition` + `evaluateEntitlement` | `LITE` | `PRO`, `CHAIN` |

The app sees a normalised plan (`BASIC|PRO|ENTERPRISE`, with `rawPlan`).

## Control plane
Kiorex super admin can switch it OFF at global/market/org scope (snapshot value `OFF` => `reason: "FLAG_OFF"`); a plan below PRO can never be switched ON by the flag layer. **TODO (cross-repo, NEEDS_HUMAN review):** add `mobile_staff_app` (class Module, scopes global/market/org, no dependencies, not launch-locked) to `kiorex-contracts` `flags/catalogue.json` and the `kiorex-platform` flag catalogue; until then the Clinic/Lab/Pharmacy snapshot path never fires and plan-based gating is the only control. (Those repos' catalogues are pinned by tests, so the change belongs in a contracts release.)

## Enforcement
* Bootstrap tells the app (`entitlement`, `safetyAlertsOnly`, `modules`).
* Server enforcement: a request with `X-Kiorly-Client: kiorly-work/*` (and every `/mobile/*` route) from an org without the entitlement gets `403 {code:"FEATURE_DISABLED", key:"mobile_staff_app", scope:"org"}`. **Exempt on every plan:** `/auth/*`, `GET /mobile/bootstrap`, `/mobile/alerts*`, `DELETE /mobile/devices/:id`. Web traffic (no client header) is untouched.
* App: a 403 FEATURE_DISABLED for this key refreshes bootstrap, shows the notice and the upgrade screen.

## Safety alerts on every plan
Clinic (`HOME_VISIT_SOS`, `HOME_VISIT_MISSED_CHECKIN`, `NURSE_SAFETY`, `CRITICAL_VITALS`, `CRITICAL_LAB_RESULT`), Pharmacy (`CONTROLLED_DRUG_DISCREPANCY`, `CONTROLLED_WITNESS_PENDING`, `RECALLED_LOT_IN_STOCK`, `COLD_CHAIN_EXCURSION`, `EXPIRED_STOCK`), Lab (`CRITICAL_VALUE`, `TAT_BREACH_CRITICAL`, `QC_FAILURE`, `HOME_COLLECTION_SAFETY`). Read-only inbox + acknowledge (idempotent, audited). Each backend has a unit test forbidding entitlement/flag references in its alert module. Non-safety push messages are only stored for entitled orgs.
