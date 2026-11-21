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
* Server enforcement: a request with `X-Kiorly-Client: kiorly-work/*` (and every `/mobile/*` route) from an org without the entitlement gets `403 {code:"FEATURE_DISABLED", key:"mobile_staff_app", scope:"org"}`. **Exempt on every plan:** `/auth/*`, `GET /mobile/bootstrap`, `/mobile/alerts*`, `POST /mobile/upgrade-request`, `DELETE /mobile/devices/:id`. Web traffic (no client header) is untouched.
* App: a 403 FEATURE_DISABLED for this key refreshes bootstrap, shows the notice and the upgrade screen.

## Safety alerts on every plan
Clinic (`HOME_VISIT_SOS`, `HOME_VISIT_MISSED_CHECKIN`, `NURSE_SAFETY`, `CRITICAL_VITALS`, `CRITICAL_LAB_RESULT`), Pharmacy (`CONTROLLED_DRUG_DISCREPANCY`, `CONTROLLED_WITNESS_PENDING`, `RECALLED_LOT_IN_STOCK`, `COLD_CHAIN_EXCURSION`, `EXPIRED_STOCK`), Lab (`CRITICAL_VALUE`, `TAT_BREACH_CRITICAL`, `QC_FAILURE`, `HOME_COLLECTION_SAFETY`). Read-only inbox + acknowledge (idempotent, audited). Each backend has a unit test forbidding entitlement/flag references in its alert module. Non-safety push messages are only stored for entitled orgs.

## The Lite experience (Basic / Starter orgs)
Lite is a real slice, not a dead end: safety alerts keep working and the person can see, per role, what Pro would add and ask for it.

**What the slice includes:** the safety-alert inbox (read, open, acknowledge), remote sign-out by an admin, language/theme, and the upgrade request. All product modules (schedule, Rx, worklists...) are Pro.

**Locked tiles per role.** Bootstrap on a non-entitled org carries `upgrade: { lockedModules, myRequest, openRequests, canApprove }` (null on Pro). `lockedModules` is computed by each backend with the *same role rules as the Pro bootstrap* (`modulesFor`), so a nurse, a doctor and an owner each see only the tools they would get. The app (`src/lite/logic.ts::lockedTilesFor`) maps those keys onto the shared registry (`src/modules/registry.ts`), product-scoped, in registry order. Shown only when the reason is the plan (`PLAN_BELOW_PRO`); a `FLAG_OFF` switch-off shows the admin notice instead (an upgrade would not fix it). An older server without the block falls back to the product's registry tiles. Tapping a tile opens a bottom sheet (or `/upgrade?product=&feature=`): what it does for *your role* (`lite.benefit.<tile>.<roleGroup>`, falling back to `.default`; AR + EN), the plan needed, the safety note and one action. Never a blocking modal.

**Upgrade request.** `POST /mobile/upgrade-request {featureKey?, note?}` (see each product's MOBILE.md): idempotent per (user, feature) for 24h, records requester/role/org/feature/note/time, notifies the owner(s) through the existing mock push inbox (OPS), audited. Owner/admin roles (server `canApprove`; clinic GROUP_ADMIN/CLINIC_ADMIN or tenant owner, pharmacy/lab OWNER) see **Upgrade plan**; everyone else sees **Ask your admin to upgrade** (the request still goes to the owner). Button states (`src/lite/machine.ts`, pure and unit-tested): idle, sending, requested (with date), queued (offline, via the existing offline queue, turns into requested once the op leaves the queue), error (retry). The requested state persists locally (`kw-lite-v1`) and is also restored from `bootstrap.upgrade.myRequest` on a new device; it expires with the 24h window.

**Highlights.** Home shows a calm upgrade card (what you tapped last + request status) with up to four locked tiles; Work shows an "Included on Lite" card (safety alerts entry, prominent) then every locked tool for the role; Me shows a **Lite** badge and a "See what Pro adds" button; Inbox notes that alerts are included. Light/dark, AR/EN (RTL), 44px targets and accessibility labels throughout; no timers, no pop-ups.

**Owner view of requests (Home card).** The in-app inbox stays Pro-only, so owners/admins (`canApprove`) learn about staff requests from Home. The bootstrap `upgrade` block also carries `openRequestItems`: up to 10 newest open requests from *other* people `{id, featureKey, requesterRole, requesterName (display name only), requestedAt, note?}` (`[]` for non-approvers; `openRequests` stays the total). Home shows an **Upgrade requests** section under the upgrade card (`UpgradeRequestsSection`, `src/components/lite.tsx`): count badge, up to 3 rows ("Nadia asked for Quick vitals", role and date, optional note), "N more" line; a row opens `/upgrade?product=&feature=` (the plan page, which lists up to 10). The same count shows on the Me account card's Lite badge and as the Me tab badge (`useOpenRequestTotal`, summed over Lite products). A server that sends only the count gets one count row; staff roles keep the "ask your admin" state and see none of this. Pure rules: `openRequestsFor` / `openRequestCount` / `requestFeature` in `src/lite/logic.ts`. Strings: `lite.req.*` (AR + EN).

**Known limits.** On a Basic org the owner cannot read the OPS push in the app inbox (`/mobile/inbox` is Pro-only); the owner sees the requests on Home (above) and in the audit trail. Nothing changes the plan: that stays a Billing action on the web.
