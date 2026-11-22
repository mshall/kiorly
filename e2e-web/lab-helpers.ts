import { expect, type Page, type ConsoleMessage } from '@playwright/test';

export const API = process.env.LAB_API ?? 'http://localhost:3200/api/v1';
export type Who = { token: string; id: string; role: string; email: string };

export async function login(org: string, role: string): Promise<Who> {
  const email = `${role}@${org}.test`;
  const r = await fetch(`${API}/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgSlug: org, email }) });
  if (!r.ok) throw new Error(`dev-login ${org}/${role}: ${r.status}`);
  const j = (await r.json()) as { token: string; user: { id: string; role: string } };
  return { token: j.token, id: j.user.id, role: j.user.role, email };
}
/** Lab REST call; `app` adds the staff-app client header (what the Expo build sends), plain calls are what the lab web app (:5191) sends. */
export async function api(w: Who, method: string, path: string, body?: unknown, o: { app?: boolean; headers?: Record<string, string> } = {}) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${w.token}`, ...(o.app ? { 'x-kiorly-client': 'kiorly-work/e2e-web' } : {}), ...o.headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
}
export const ok = (r: { status: number; body: any }, ...codes: number[]) => { expect(codes.length ? codes : [200, 201], JSON.stringify(r.body)).toContain(r.status); return r.body; };
export const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase();

/** Console messages that are not a defect: web-only Expo library notices and dev-server chatter. */
const BENIGN = [/expo-notifications/i, /not yet fully supported on web/i, /Download the React DevTools/i, /\[HMR\]/i, /shadow\*|pointerEvents is deprecated|props\.pointerEvents|useNativeDriver/i, /favicon/i];
export function trackConsole(page: Page, extraBenign: RegExp[] = []) {
  const bad: string[] = [];
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error' && ![...BENIGN, ...extraBenign].some((r) => r.test(m.text()))) bad.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => { bad.push(`pageerror: ${e.message.slice(0, 300)}`); });
  const failed: string[] = [];
  page.on('response', (r) => { if (r.url().startsWith(API) && r.status() >= 500) bad.push(`HTTP ${r.status()} ${r.url()}`); else if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
  (bad as any).failed = failed;
  return bad;
}

/** Sign in through the real sign-in screen (Lab product: org slug + email, dev login, no password). English UI. */
export async function signIn(page: Page, org: string, role: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByTestId('product-lab').click();
  await page.getByTestId('signin-email').fill(`${role}@${org}.test`);
  await page.getByTestId('signin-org').fill(org);
  await page.getByTestId('signin-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'));
  // PRO/ENTERPRISE land on the tabs; a BASIC org lands on the upgrade screen (no tab bar)
  await expect(page.getByRole("tab", { name: /work/i }).or(page.getByTestId("upgrade")).first()).toBeVisible();
}
export async function openWork(page: Page) {
  // module screens are stack screens above the tab bar: go back to the tabs first when a screen is open
  if (!['/', '/work', '/inbox', '/me'].includes(new URL(page.url()).pathname)) await page.goBack();
  await page.getByRole('tab', { name: /work/i }).click();
  await expect(page.getByTestId('work')).toBeVisible();
}
export const tilesOf = async (page: Page) => (await page.locator('[data-testid^="tile-lab."]').evaluateAll((e) => e.map((x) => x.getAttribute('data-testid')!.replace('tile-lab.', '')))).sort();
export const apiTiles = async (w: Who) => ((await api(w, 'GET', '/mobile/bootstrap', undefined, { app: true })).body.modules as any[]).filter((m) => m.enabled).map((m) => m.key.replace('lab.', '')).sort();
export async function openTile(page: Page, key: string, screenId: string) {
  await openWork(page);
  await page.getByTestId(`tile-lab.${key}`).click();
  await expect(page.getByTestId(screenId)).toBeVisible();
}
export const back = async (page: Page) => { await page.goBack(); await expect(page.getByTestId('work')).toBeVisible(); };

// ───────────── fixtures (own analyte, QC levels, 1-minute TAT test; created through the owner's web endpoints) ─────────────
export type Fx = { org: string; who: Record<string, Who>; code: string; analyteId: string; bench: string; matIds: string[]; patient: { id: string; fullName: string } };
export async function fixture(org: string, roles: string[]): Promise<Fx> {
  const who: Record<string, Who> = {};
  for (const r of roles) who[r] = await login(org, r);
  const code = `E2EW${rnd()}`, o = who.owner;
  const a = ok(await api(o, 'POST', '/catalogue/analytes', { code, nameEn: `E2E Web K ${code}`, unit: 'mmol/L', precision: 1, valueType: 'NUMERIC' }), 201);
  ok(await api(o, 'POST', `/catalogue/analytes/${a.id}/reference-intervals`, { sex: null, ageMinDays: 0, ageMaxDays: null, low: 3.5, high: 5.1 }), 201);
  ok(await api(o, 'PUT', `/analytes/${a.id}/critical-rule`, { criticalLow: 2.5, criticalHigh: 6.5, ackWithinMinutes: 30 }), 200);
  const matIds: string[] = [];
  for (const [lvl, mean] of [['LEVEL_1', 4], ['LEVEL_2', 6]] as const) matIds.push(ok(await api(o, 'POST', '/qc/materials', { analyteId: a.id, level: lvl, materialLot: `E2EW-${code}-${lvl}`, targetMean: mean, targetSd: 0.2 }), 201).id);
  ok(await api(o, 'POST', '/catalogue/tests', { code, nameEn: `E2E Web test ${code}`, specimenType: 'blood', price: 50, tatMinutes: 1, analyteCodes: [code] }), 201);
  const bench = (await api(who.tech ?? o, 'GET', '/instruments')).body.find((i: any) => i.kind === 'MANUAL_BENCH').id;
  const pts = (await api(o, 'GET', '/patients?limit=5')).body;
  return { org, who, code, analyteId: a.id, bench, matIds, patient: (pts.rows ?? pts.items ?? pts)[0] };
}
export async function passQc(fx: Fx) { for (const [i, mean] of [[0, 4], [1, 6]] as const) expect(ok(await api(fx.who.tech ?? fx.who.owner, 'POST', '/qc/runs', { instrumentId: fx.bench, materialId: fx.matIds[i], value: mean }), 201).run.status).toBe('PASS'); }
export type Ord = { id: string; number: string; itemId: string; spec: { id: string; barcode: string; accessionNumber: string }; patient: string };
export async function newOrder(fx: Fx, priority: 'ROUTINE' | 'STAT' = 'ROUTINE'): Promise<Ord> {
  const c = ok(await api(fx.who.reception ?? fx.who.owner, 'POST', '/orders', { patientId: fx.patient.id, testCodes: [fx.code], priority, source: 'WALK_IN', accession: 'AUTO', identifiersChecked: ['dateOfBirth', 'phone'], consentChannels: ['PRINTED'] }), 201);
  return { id: c.id, number: c.orderNumber, itemId: c.items[0].id, spec: c.specimens[0], patient: fx.patient.fullName };
}
export async function toProcessing(fx: Fx, o: Ord) {
  const { phleb, tech, owner } = fx.who; const sp = o.spec;
  ok(await api(phleb ?? owner, 'POST', `/specimens/${sp.id}/collect`, { scannedBarcode: sp.barcode }), 201);
  ok(await api(tech ?? owner, 'POST', `/specimens/${sp.id}/receive`, { scannedBarcode: sp.barcode }), 201);
  ok(await api(tech ?? owner, 'POST', `/specimens/${sp.id}/process`, { scannedBarcode: sp.barcode }), 201);
}
/** Enter (+ dual-control second entry by the director) a result; returns the result id. */
export async function enterResult(fx: Fx, o: Ord, value: number) {
  const e = ok(await api(fx.who.tech ?? fx.who.owner, 'POST', '/results', { orderItemId: o.itemId, analyteId: fx.analyteId, instrumentId: fx.bench, value }), 201);
  ok(await api(fx.who.supervisor ?? fx.who.director, 'POST', `/results/${e.id}/second-entry`, { value }), 201);
  return e.id as string;
}

/** No console errors / page errors / 5xx. Browser "Failed to load resource" lines carry no URL, so 4xx are checked from the response log: every one must match `allowed` (the deliberate negative checks of the test). */
export function expectClean(bad: string[], allowed: RegExp[] = []) {
  const real = bad.filter((m) => !/^Failed to load resource/.test(m));
  const failed = ((bad as any).failed as string[]).filter((f) => !allowed.some((r) => r.test(f)));
  if (real.length || failed.length) console.log('UNEXPECTED', JSON.stringify([...real, ...failed]));
  expect([...real, ...failed], 'console / network errors').toEqual([]);
}
