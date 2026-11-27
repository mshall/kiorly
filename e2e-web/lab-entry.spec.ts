import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { api, expectClean, fixture, newOrder, ok, openWork, passQc, signIn, tilesOf, toProcessing, trackConsole, type Fx, type Ord, type Who } from './lab-helpers';

/**
 * Kiorly (Expo web) x Kiorly Lab: bench RESULT ENTRY and dual-control second entry as the real roles (technologist, supervisor, reception).
 * The UI writes the result; the effect is read back through the Lab API. Fixtures: an own analyte + QC + test per run; nothing is reset.
 */
test.describe.configure({ mode: 'serial' });
let fx: Fx; const o: Record<'normal' | 'crit' | 'recep', Ord> = {} as never; const sw = (n: string) => fx.who[n];

test.beforeAll(async () => {
  fx = await fixture('demo-lab', ['owner', 'tech', 'supervisor', 'reception', 'phleb', 'signatory']);
  o.normal = await newOrder(fx); await toProcessing(fx, o.normal);
  o.crit = await newOrder(fx, 'STAT'); await toProcessing(fx, o.crit);
  o.recep = await newOrder(fx); await toProcessing(fx, o.recep);
  await passQc(fx);
});

const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const closeQuietly = async (b?: Browser) => { if (b) await Promise.race([b.close().catch(() => undefined), new Promise((r) => setTimeout(r, 5000))]); };
async function role(name: string, viewport = { width: 430, height: 900 }) {
  const browser: Browser = await chromium.launch({ executablePath });
  const ctx = await browser.newContext({ viewport, baseURL: process.env.WEB_URL ?? 'http://localhost:8082', locale: 'en-US' });
  const page: Page = await ctx.newPage(); const bad = trackConsole(page);
  await signIn(page, 'demo-lab', name);
  return { page, bad, browser };
}
const results = async (w: Who, ord: Ord) => (await api(w, 'GET', `/orders/${ord.id}/results`)).body as any[];
const open = async (page: Page, ord: Ord) => { await page.goto(`/lab/results/${ord.spec.id}`); await expect(page.getByTestId('entry-specimen')).toBeVisible(); };
const pickBench = async (page: Page) => { const chip = page.getByTestId(`instrument-${fx.bench}`); if (await chip.count()) await chip.click(); };

test.describe('technologist: enters results', () => {
  let page: Page; let bad: string[]; let br: Browser;
  test.beforeAll(async () => { ({ page, bad, browser: br } = await role('tech')); });
  test.afterAll(async () => { await closeQuietly(br); });

  test('the work list shows the processing specimens and a row opens the entry screen', async () => {
    await openWork(page);
    expect(await tilesOf(page)).toContain('worklist');
    await page.getByTestId('tile-lab.worklist').click();
    await expect(page.getByTestId('lab-worklist')).toBeVisible();
    await expect(page.locator('[data-testid^="worklist-specimen-"]').first()).toBeVisible();
    await page.locator('[data-testid^="worklist-specimen-"]').first().click();
    await expect(page.getByTestId('lab-result-entry')).toBeVisible();
  });

  test('enter a normal value in the UI: the API holds one ENTERED NORMAL result for that order item and the screen shows it', async () => {
    await open(page, o.normal); await pickBench(page);
    const input = page.getByTestId(`entry-input-${fx.analyteId}`);
    await expect(page.getByTestId(`entry-save-${fx.analyteId}`)).toBeDisabled();
    await input.fill('4.4');
    await page.getByTestId(`entry-save-${fx.analyteId}`).click();
    await expect(page.getByTestId(`entry-value-${fx.analyteId}`)).toContainText('4.4');
    const rs = await results(sw('tech'), o.normal);
    expect(rs).toHaveLength(1); expect(rs[0]).toMatchObject({ status: 'ENTERED', flag: 'NORMAL', source: 'MANUAL', secondEntryBy: null });
    await expect(page.getByTestId(`entry-flag-${fx.analyteId}`)).toBeVisible();
    await expect(page.getByTestId(`entry-confirm-${fx.analyteId}`)).toBeVisible(); // the technologist role also holds results.second_entry: the server refuses the SAME person (next test)
  });

  test('a second save for the same analyte is not possible (the field is gone) and the API still holds one result', async () => {
    await open(page, o.normal);
    await expect(page.getByTestId(`entry-input-${fx.analyteId}`)).toHaveCount(0);
    expect(await results(sw('tech'), o.normal)).toHaveLength(1);
  });

  test('the entering person cannot confirm their own entry: the server refusal is explained, nothing changes', async () => {
    await open(page, o.normal);
    await page.getByTestId(`entry-confirm-${fx.analyteId}`).click();
    await page.getByTestId('entry-second-input').fill('4.4');
    await page.getByTestId('entry-second-confirm').click();
    await expect(page.getByTestId('entry-second-error')).toContainText(/different person/i);
    expect((await results(sw('tech'), o.normal))[0].secondEntryBy).toBeNull();
  });

  test('a critical value shows the critical notice and raises the alert on the API', async () => {
    await open(page, o.crit); await pickBench(page);
    await page.getByTestId(`entry-input-${fx.analyteId}`).fill('7.2');
    await page.getByTestId(`entry-save-${fx.analyteId}`).click();
    await expect(page.getByTestId(`entry-critical-${fx.analyteId}`)).toBeVisible();
    const rs = await results(sw('tech'), o.crit);
    expect(rs[0].flag).toMatch(/CRITICAL/);
    const alerts = (await api(sw('tech'), 'GET', '/mobile/alerts?status=all', undefined, { app: true })).body.items;
    expect(alerts.some((a: any) => a.kind === 'CRITICAL_VALUE' && a.subject?.label === o.crit.number)).toBe(true);
  });

  test('Arabic: the entry screen is RTL with Arabic labels', async () => {
    await page.goto(`/lab/results/${o.recep.spec.id}`);
    await page.evaluate(() => localStorage.setItem('kw-lang', 'ar'));
    await page.reload();
    await expect(page.getByTestId('entry-specimen')).toBeVisible();
    await expect(page.getByText('حفظ النتيجة').first()).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl');
    await page.evaluate(() => localStorage.setItem('kw-lang', 'en')); await page.reload();
  });
  test('no console errors or 5xx; the only 4xx are the deliberate refusal', () => { expectClean(bad, [/second-entry/]); });
});

test.describe('supervisor: confirms (dual control)', () => {
  let page: Page; let bad: string[]; let br: Browser;
  test.beforeAll(async () => { ({ page, bad, browser: br } = await role('supervisor')); });
  test.afterAll(async () => { await closeQuietly(br); });

  test('a wrong re-key is refused with a plain message; the right value confirms; the API then accepts technical validation', async () => {
    await open(page, o.normal);
    await page.getByTestId(`entry-confirm-${fx.analyteId}`).click();
    await page.getByTestId('entry-second-input').fill('4.9');
    await page.getByTestId('entry-second-confirm').click();
    await expect(page.getByTestId('entry-second-error')).toContainText(/does not match/i);
    expect((await results(sw('supervisor'), o.normal))[0].secondEntryBy).toBeNull();
    await page.getByTestId('entry-second-input').fill('4.4');
    await page.getByTestId('entry-second-confirm').click();
    await expect(page.getByTestId('entry-second-sheet')).toBeHidden();
    const r = (await results(sw('supervisor'), o.normal))[0];
    expect(r.secondEntryBy).toBeTruthy();
    ok(await api(sw('tech'), 'POST', `/results/${r.id}/tech-validate`, {}), 201);
  });
  test('no console errors or 5xx; the only 4xx is the deliberate mismatch', () => { expectClean(bad, [/second-entry/]); });
});

test.describe('reception: no result entry', () => {
  let page: Page; let bad: string[]; let br: Browser;
  test.beforeAll(async () => { ({ page, bad, browser: br } = await role('reception')); });
  test.afterAll(async () => { await closeQuietly(br); });

  test('there is no work-list tile and the entry route says the role cannot do this; the API refuses the same action', async () => {
    await openWork(page);
    expect(await tilesOf(page)).not.toContain('worklist');
    await page.goto(`/lab/results/${o.recep.spec.id}`);
    await expect(page.getByTestId('not-allowed')).toBeVisible();
    await expect(page.getByTestId(`entry-input-${fx.analyteId}`)).toHaveCount(0);
    const r = await api(sw('reception'), 'POST', '/results', { orderItemId: o.recep.itemId, analyteId: fx.analyteId, instrumentId: fx.bench, value: 4 });
    expect(r.status).toBe(403);
    expect(await results(sw('tech'), o.recep)).toHaveLength(0);
  });
  test('small phone (320 px): the entry screen has no horizontal scroll for a role that may open it', async () => {
    const t = await role('tech', { width: 320, height: 640 });
    await open(t.page, o.recep);
    expect(await t.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await closeQuietly(t.browser);
  });
  test('no console errors', () => { expectClean(bad, [/\/worklist/, /\/instruments/, /\/results/, /\/mobile\/worklist/]); });
});
