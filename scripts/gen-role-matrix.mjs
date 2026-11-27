#!/usr/bin/env node
// Regenerates src/__tests__/fixtures/role-modules.json: which mobile modules and screens every staff role gets from the Pharmacy and Lab APIs, evaluated from THEIR source
// (kiorly-pharmacy mobile-plan.ts + permissions.ts, kiorly-lab mobile-modules.ts + rbac.ts), so the app tests never drift from the servers. The Clinic table lives in a Prisma-bound file
// and is mirrored by hand in the same JSON (`clinic`, source noted there); suites 16 to 18 of the workspace e2e prove the live servers. Read only on the product repos. No secrets, no data.
//   node scripts/gen-role-matrix.mjs            (needs Node 23.6+ for type stripping)
import { register } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
register("./ts-resolve-hook.mjs", import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ph = await import(`${root}/kiorly-pharmacy/apps/api/src/modules/mobile/mobile-plan.ts`);
const pp = await import(`${root}/kiorly-pharmacy/apps/api/src/auth/permissions.ts`);
const pg = await import(`${root}/kiorly-pharmacy/apps/api/src/modules/growth/growth-access.ts`);
const lm = await import(`${root}/kiorly-lab/apps/api/src/modules/mobile/mobile-modules.ts`);
const lr = await import(`${root}/kiorly-lab/apps/api/src/auth/rbac.ts`);
const lg = await import(`${root}/kiorly-lab/apps/api/src/modules/growth/growth-access.ts`);
const enabled = (mods) => Object.fromEntries(mods.filter((m) => m.enabled).map((m) => [m.key, m.screens]));
const pharmacy = Object.fromEntries(Object.keys(pp.ROLE_PERMISSIONS).map((role) => [role, enabled(ph.modulesFor(new Set(pp.ROLE_PERMISSIONS[role]), true, pg.growthLevel(role)))]));
const lab = Object.fromEntries(Object.keys(lr.ROLE_PERMISSIONS).map((role) => [role, { licence: enabled(lm.modulesForRole(role, "LIC-1")), noLicence: enabled(lm.modulesForRole(role, null)), permissions: [...lr.ROLE_PERMISSIONS[role]] }]));
const out = { generatedFrom: "kiorly-pharmacy and kiorly-lab API sources (see scripts/gen-role-matrix.mjs)", pharmacy, lab };
const file = path.join(root, "kiorly/src/__tests__/fixtures/role-modules.generated.json");
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${file}: pharmacy roles ${Object.keys(pharmacy).length}, lab roles ${Object.keys(lab).length}`);
