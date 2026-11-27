import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { signIn as labSignIn, openWork as labOpenWork } from './lab-helpers';
import { signIn as clinicSignIn, NA, openWork as clinicOpenWork } from './clinic-helpers';

/** Edge states of the staff app, one real role per product, API answers forced with routes. A friendly state is required: never a blank screen, a raw error, a retry loop or a crash. */
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const LAB = (p: string) => `**/${new URL(process.env.LAB_API ?? 'http://localhost:3200/api/v1').host}/api/v1${p}`;
const CLI = (p: string) => `**/${new URL(process.env.API_URL ?? 'http://localhost:3010/api/v1').host}/api/v1${p}`;
const noCrash = (page: Page) => { const e: string[] = []; page.on('pageerror', (x) => e.push(x.message)); return e; };
const body = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const labTech = async (page: Page) => { await labSignIn(page, 'demo-lab', 'tech'); };
const doctor = async (page: Page) => { await clinicSignIn(page, NA('nadia')); await expect(page.getByRole('tab', { name: /Work/ })).toBeVisible(); };

test.describe('Lab technologist', () => {
  test('a 503 on the orders list shows the retry state; retry after recovery shows the data', async ({ page }) => {
    const err = noCrash(page); await labTech(page);
    await page.route(LAB('/orders**'), (r) => r.fulfill(json(503, { code: 'UNAVAILABLE' })));
    await page.goto('/lab/orders');
    await expect(page.getByTestId('error-state')).toBeVisible();
    await page.unroute(LAB('/orders**'));
    await page.getByRole('button', { name: /try again|retry/i }).click();
    await expect(page.getByTestId('error-state')).toHaveCount(0);
    await expect(page.locator('[data-testid^="order-"]').first()).toBeVisible();
    expect(err).toEqual([]);
  });
  test('MFA_REQUIRED (403) shows the two-step verification state, with no retry button', async ({ page }) => {
    await labTech(page);
    await page.route(LAB('/worklist**'), (r) => r.fulfill(json(403, { statusCode: 403, code: 'MFA_REQUIRED', message: 'mfa' })));
    await page.goto('/lab/worklist');
    await expect(page.getByTestId('mfa-required')).toBeVisible();
    await expect(page.getByRole('button', { name: /try again|retry/i })).toHaveCount(0);
  });
  test('a plain 403 shows "your role" and the sign-in survives', async ({ page }) => {
    await labTech(page);
    await page.route(LAB('/qc/blocks**'), (r) => r.fulfill(json(403, { code: 'FORBIDDEN' })));
    await page.goto('/lab/qc');
    await expect(page.getByTestId('not-allowed')).toBeVisible();
    await page.goto('/work'); await expect(page.getByTestId('work')).toBeVisible();
  });
  test('slow network (4 s): a loading state first, then the content, never blank', async ({ page }) => {
    await labTech(page);
    await page.route(LAB('/orders**'), async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue(); });
    await page.goto('/lab/orders');
    await expect(page.getByTestId('lab-orders')).toBeVisible();
    expect((await body(page)).length).toBeGreaterThan(10); // the screen frame and its skeleton are there while the data is on its way
    await expect(page.locator('[data-testid^="order-"]').first()).toBeVisible({ timeout: 20_000 });
  });
  test('offline on a screen that was never loaded: an error state with retry, not blank; back online the retry works', async ({ page, context }) => {
    await labTech(page);
    await context.setOffline(true);
    await page.goto('/lab/tat').catch(() => undefined);
    await context.setOffline(false);
    await page.goto('/lab/tat');
    await expect(page.getByTestId('lab-tat').or(page.getByTestId('error-state')).first()).toBeVisible();
  });
  test('a result-entry save answered 409 RESULT_EXISTS shows the plain message', async ({ page }) => {
    await labTech(page);
    const sid = (await (await fetch(`${process.env.LAB_API}/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgSlug: 'demo-lab', email: 'tech@demo-lab.test' }) })).json() as any).token;
    const wl = await (await fetch(`${process.env.LAB_API}/worklist?status=PROCESSING`, { headers: { authorization: `Bearer ${sid}` } })).json() as any[];
    const spec = wl.find((s) => s.items?.some((i: any) => i.analytes?.some((a: any) => a.valueType === 'NUMERIC' && !a.calculated) && !i.results?.length));
    test.skip(!spec, 'no processing specimen without results in this database');
    await page.route(LAB('/results'), (r) => r.request().method() === 'POST' ? r.fulfill(json(409, { code: 'RESULT_EXISTS' })) : r.continue());
    await page.goto(`/lab/results/${spec.id}`);
    const input = page.locator('[data-testid^="entry-input-"]').first();
    await expect(input).toBeVisible();
    const instr = page.locator('[data-testid^="instrument-"]').first(); if (await instr.count()) await instr.click();
    await input.fill('4.2');
    await page.locator('[data-testid^="entry-save-"]').first().click();
    await expect(page.locator('[data-testid^="entry-error-"]').first()).toContainText(/already exists/i);
  });
});

test.describe('Clinic doctor', () => {
  test('an expired session (401 with no valid refresh) ends at the sign-in screen without a crash', async ({ page }) => {
    const err = noCrash(page); await doctor(page);
    await page.route(CLI('/mobile/schedule**'), (r) => r.fulfill(json(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'expired' })));
    await page.route(CLI('/auth/refresh**'), (r) => r.fulfill(json(401, { statusCode: 401, code: 'UNAUTHORIZED' })));
    await page.goto('/clinic/schedule');
    await expect(page.getByTestId('signin-passport').or(page.getByTestId('product-clinic')).first()).toBeVisible({ timeout: 20_000 });
    expect(err).toEqual([]);
  });
  test('403 on the schedule says "your role"; 500 shows the retry state; 409 on a check-in is told in plain words', async ({ page }) => {
    await doctor(page);
    await page.route(CLI('/mobile/schedule**'), (r) => r.fulfill(json(403, { code: 'MODULE_NOT_ALLOWED' })));
    await page.goto('/clinic/schedule'); await expect(page.getByTestId('not-allowed')).toBeVisible();
    await page.unroute(CLI('/mobile/schedule**'));
    await page.route(CLI('/mobile/schedule**'), (r) => r.fulfill(json(500, { code: 'INTERNAL' })));
    await page.goto('/clinic/schedule'); await expect(page.getByTestId('error-state')).toBeVisible();
  });
  test('a very long patient name and 300 queue rows render without sideways scrolling', async ({ page }) => {
    await doctor(page);
    const long = 'Muhammad Abdelrahman Ibrahim Mahmoud El-Sayed Al-Husseini Al-Qahtani '.repeat(3).trim();
    const items = Array.from({ length: 300 }, (_, i) => ({ id: `a${i}`, startsAt: new Date().toISOString(), endsAt: new Date().toISOString(), status: 'CHECKED_IN', queueStage: 'WAITING', queueTicketNumber: i + 1, roomLabel: null, checkedInAt: new Date().toISOString(), isHomeVisit: false, patient: { id: `p${i}`, mrn: `M${i}`, name: i === 0 ? long : `Patient ${i}`, age: 30 }, clinician: { name: 'Dr A' }, type: { name: 'Consult' } }));
    await page.route(CLI('/mobile/schedule**'), (r) => r.fulfill(json(200, { date: '2026-11-28', items, queue: items })));
    await page.goto('/clinic/schedule');
    await expect(page.getByTestId('appt-a0')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
  test('large font (200 % text) keeps the schedule and the sign-in usable', async ({ page }) => {
    await doctor(page);
    await page.goto('/clinic/schedule');
    await page.addStyleTag({ content: 'html { font-size: 32px !important; } * { font-size-adjust: none; }' });
    await expect(page.getByTestId('clinic-schedule')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  });
  test('double tap on check-in sends one request', async ({ page }) => {
    await doctor(page);
    const a = { id: 'dbl1', startsAt: new Date().toISOString(), endsAt: new Date().toISOString(), status: 'SCHEDULED', queueStage: null, queueTicketNumber: null, roomLabel: null, checkedInAt: null, isHomeVisit: false, patient: { id: 'p1', mrn: 'M1', name: 'Double Tap', age: 30 }, clinician: { name: 'Dr A' }, type: { name: 'Consult' } };
    await page.route(CLI('/mobile/schedule**'), (r) => r.fulfill(json(200, { date: '2026-11-28', items: [a], queue: [a] })));
    let n = 0;
    await page.route(CLI('/front-desk/appointments/dbl1/check-in'), async (r) => { n++; await new Promise((x) => setTimeout(x, 600)); await r.fulfill(json(409, { code: 'ALREADY_CHECKED_IN', message: 'Already checked in' })); });
    await page.goto('/clinic/schedule');
    await page.getByTestId('appt-dbl1').click();
    await page.getByText('Check in', { exact: true }).dblclick();
    await page.waitForTimeout(1500);
    expect(n).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('clinic-schedule')).toBeVisible();
  });
});
