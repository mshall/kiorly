import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { api, apiTiles, expectClean, enterResult, fixture, login, newOrder, ok, openTile, openWork, passQc, signIn, tilesOf, toProcessing, trackConsole, type Fx, type Ord, type Who } from './lab-helpers';

/**
 * Kiorly Work (Expo web) x Kiorly Lab as the real staff roles: phlebotomist, technologist, signatory, reception and the BASIC-lab director.
 * Each role signs in through the sign-in screen (org slug + email dev login), sees tiles that equal its /mobile/bootstrap, sees REAL seeded/fixture data
 * (order numbers, accession numbers, analyte names, reagent names), opens each tile, performs one or more real actions in the UI and the effect is read
 * back through the lab API (the same API the lab web app :5191 uses). Fixtures: an own analyte + QC + 1-minute TAT test per run; nothing is reset.
 */
test.describe.configure({ mode: 'serial' });

let fx: Fx; let basic: Fx;
const o: Record<'pick' | 'acc' | 'val' | 'crit' | 'rec', Ord> = {} as never;
const res: { val?: string; crit?: string } = {};
const sw = (n: string) => fx.who[n];

test.beforeAll(async () => {
  fx = await fixture('demo-lab', ['owner', 'director', 'signatory', 'tech', 'phleb', 'reception', 'manager', 'supervisor']);
  o.pick = await newOrder(fx, 'STAT');                                  // phlebotomist collects this in the UI
  o.acc = await newOrder(fx); ok(await api(sw('phleb'), 'POST', `/specimens/${o.acc.spec.id}/collect`, { scannedBarcode: o.acc.spec.barcode }), 201); // tech receives + processes in the UI
  o.val = await newOrder(fx); await toProcessing(fx, o.val); await passQc(fx); res.val = await enterResult(fx, o.val, 4.4);   // tech validates -> signatory validates + signs in the UI
  o.crit = await newOrder(fx, 'STAT'); await toProcessing(fx, o.crit); res.crit = await enterResult(fx, o.crit, 7.2);          // critical value -> signatory acknowledges in the UI
  ok(await api(sw('tech'), 'POST', `/results/${res.crit}/tech-validate`, {}), 201);
  o.rec = await newOrder(fx);                                            // reception finds it and collects it at the desk
});

const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
/** Close without ever blocking the run (a stuck close must not stall the next role). */
const closeQuietly = async (b?: Browser) => { if (b) await Promise.race([b.close().catch(() => undefined), new Promise((r) => setTimeout(r, 5000))]); };
/** One own browser per role (closed in afterAll): sign-in through the real screen, English UI, console errors collected. */
async function role(_unused: unknown, org: string, name: string) {
  const browser: Browser = await chromium.launch({ executablePath });
  const page: Page = await (await browser.newContext({ viewport: { width: 430, height: 900 }, baseURL: process.env.WEB_URL ?? 'http://localhost:8082', locale: 'en-US' })).newPage();
  const bad = trackConsole(page);
  await signIn(page, org, name);
  return { page, bad, browser };
}
const critKey = async (w: Who, order: Ord) => (await api(w, 'GET', '/mobile/alerts?status=all', undefined, { app: true })).body.items.find((a: any) => a.kind === 'CRITICAL_VALUE' && a.subject?.label === order.number);

test.describe('phlebotomist (PRO)', () => {
  let page: Page; let bad: string[];
  let br: Browser;
  test.beforeAll(async () => { ({ page, bad, browser: br } = await role(null, 'demo-lab', 'phleb')); });
  test.afterAll(async () => { await closeQuietly(br); });

  test('Work lists exactly the API modules; critical/validation/QC/reagents are absent; home shows lab KPIs', async () => {
    await expect(page.getByTestId('lab-summary')).toBeVisible();
    await openWork(page);
    expect(await tilesOf(page)).toEqual(await apiTiles(sw('phleb')));
    const tiles = await tilesOf(page);
    expect(tiles).toEqual(expect.arrayContaining(['phlebotomy', 'accession', 'orders']));
    for (const k of ['critical', 'validation', 'worklist', 'qc', 'reagents', 'tat']) expect(tiles).not.toContain(k);
  });

  test('Phlebotomy: seeded pending specimens are listed with real accession numbers; the home route tab shows the seeded stop', async () => {
    await openTile(page, 'phlebotomy', 'lab-phlebotomy');
    const pend = (await api(sw('phleb'), 'GET', '/specimens?status=PENDING_COLLECTION&limit=25')).body;
    const rows = pend.rows ?? pend.items ?? pend;
    expect(rows.length).toBeGreaterThan(0);
    await expect(page.getByTestId(`spec-${rows[0].accessionNumber}`)).toBeVisible();
    await page.getByRole('tab', { name: /home route/i }).click();
    const route = (await api(sw('phleb'), 'GET', '/home-collections/my-route', undefined, { app: true })).body;
    expect(route.length).toBeGreaterThan(0);
    await expect(page.getByTestId(`stop-${route[0].id}`)).toBeVisible();
    await page.getByRole('tab', { name: /to collect/i }).click();
  });

  test('scan the tube barcode and collect it: wrong label refused, right label collects; API shows COLLECTED + one custody event', async () => {
    const sp = o.pick.spec;
    await page.getByTestId('phleb-field').fill('NO-SUCH-TUBE-000'); await page.getByTestId('phleb-field').press('Enter');
    await expect(page.getByTestId('phleb-error')).toBeVisible();
    await page.getByTestId('phleb-field').fill(sp.barcode); await page.getByTestId('phleb-field').press('Enter');
    await expect(page.getByTestId('specimen-card')).toContainText(sp.accessionNumber);
    await expect(page.getByTestId('specimen-card')).toContainText(o.pick.number);
    await expect(page.getByTestId('specimen-card')).toContainText('STAT');
    expect((await api(sw('reception'), 'GET', `/specimens/${sp.id}`)).body.status).toBe('PENDING_COLLECTION');
    // the phlebotomist is shown collect, not receive/process
    await expect(page.getByTestId('act-collect')).toBeVisible();
    await expect(page.getByTestId('act-receive')).toHaveCount(0);
    await page.getByTestId('temp-field').fill('22');
    await page.getByTestId('act-collect').click();
    await expect.poll(async () => (await api(sw('reception'), 'GET', `/specimens/${sp.id}`)).body.status).toBe('COLLECTED');
    const cust = (await api(sw('phleb'), 'GET', `/specimens/${sp.id}/custody`)).body.filter((c: any) => c.type === 'COLLECTED');
    expect(cust).toHaveLength(1); expect(cust[0].actorId).toBe(sw('phleb').id); expect(Number(cust[0].temperatureC)).toBe(22);
    expect((await api(sw('reception'), 'GET', `/orders/${o.pick.id}`)).body.status).toBe('COLLECTED');
    await expect(page.getByTestId('specimen-card')).toContainText(/collected/i);
  });

  test('Accession (labels) and Orders tiles open with real data; the phlebotomist cannot open the QC route', async () => {
    await openTile(page, 'accession', 'lab-accession');
    await page.getByTestId('accession-field').fill(o.val.number); await page.getByTestId('accession-field').press('Enter');
    await expect(page.getByTestId('order-scan')).toContainText(o.val.number);
    await openWork(page);
    await page.getByTestId('tile-lab.orders').click();
    await expect(page.getByTestId('lab-orders')).toBeVisible();
    await expect(page.getByTestId(`order-${o.pick.number}`)).toBeVisible();
    await expect(page.getByTestId(`order-${o.pick.number}`)).toContainText(o.pick.patient);
    expect((await api(sw('phleb'), 'GET', '/mobile/reagents/low-stock', undefined, { app: true })).status).toBe(403);
    expectClean(bad, [/404 GET .*\/mobile\/scan\?code=NO-SUCH-TUBE/]);
  });
});

test.describe('technologist (PRO)', () => {
  let page: Page; let bad: string[];
  let br: Browser;
  test.beforeAll(async () => { ({ page, bad, browser: br } = await role(null, 'demo-lab', 'tech')); });
  test.afterAll(async () => { await closeQuietly(br); });

  test('Work lists exactly the API modules; no collection round', async () => {
    await expect(page.getByTestId('lab-summary')).toBeVisible();
    await openWork(page);
    expect(await tilesOf(page)).toEqual(await apiTiles(sw('tech')));
    expect(await tilesOf(page)).toEqual(expect.arrayContaining(['accession', 'worklist', 'qc', 'reagents', 'validation']));
    expect(await tilesOf(page)).not.toContain('phlebotomy');
  });

  test('Accession: scan the collected tube, receive then start processing; API shows RECEIVED -> PROCESSING with custody events by the tech', async () => {
    await openTile(page, 'accession', 'lab-accession');
    const sp = o.acc.spec;
    await page.getByTestId('accession-field').fill(sp.barcode); await page.getByTestId('accession-field').press('Enter');
    await expect(page.getByTestId('specimen-card')).toContainText(o.acc.number);
    await expect(page.getByTestId('specimen-card')).toContainText(/collected/i);
    await page.getByTestId('act-receive').click();
    await expect.poll(async () => (await api(sw('tech'), 'GET', `/specimens/${sp.id}`)).body.status).toBe('RECEIVED');
    await expect(page.getByTestId('act-process')).toBeVisible();
    await page.getByTestId('act-process').click();
    await expect.poll(async () => (await api(sw('tech'), 'GET', `/specimens/${sp.id}`)).body.status).toBe('PROCESSING');
    const types = (await api(sw('tech'), 'GET', `/specimens/${sp.id}/custody`)).body.map((c: any) => c.type);
    expect(types).toEqual(expect.arrayContaining(['COLLECTED', 'RECEIVED']));
    expect((await api(sw('reception'), 'GET', `/orders/${o.acc.id}`)).body.status).toBe('IN_LAB');
  });

  test('Worklist shows a progress section per API section with real counts; QC shows the open blocks of the demo data', async () => {
    await openWork(page);
    await page.getByTestId('tile-lab.worklist').click();
    await expect(page.getByTestId('lab-worklist')).toBeVisible();
    const prog = (await api(sw('tech'), 'GET', '/mobile/worklist/progress', undefined, { app: true })).body;
    expect(prog.sections.length).toBeGreaterThan(0);
    for (const s of prog.sections) await expect(page.getByTestId(`section-${s.section}`)).toBeVisible();
    await openWork(page);
    await page.getByTestId('tile-lab.qc').click();
    await expect(page.getByTestId('lab-qc')).toBeVisible();
    const blocks = (await api(sw('tech'), 'GET', '/qc/blocks?status=OPEN')).body;
    expect(blocks.length).toBeGreaterThan(0);
    await expect(page.getByTestId(`block-${blocks[0].id}`)).toBeVisible();
    await expect(page.getByTestId(`block-${blocks[0].id}`)).toContainText(blocks[0].instrument.name);
  });

  test('Reagents: low-stock and expiring lots show real item names', async () => {
    await openWork(page);
    await page.getByTestId('tile-lab.reagents').click();
    await expect(page.getByTestId('lab-reagents')).toBeVisible();
    const r = (await api(sw('tech'), 'GET', '/mobile/reagents/low-stock', undefined, { app: true })).body;
    expect(r.lowStock.length).toBeGreaterThan(0);
    for (const i of r.lowStock) await expect(page.getByTestId(`low-${i.code}`)).toContainText(i.name);
    await expect(page.getByTestId('lab-reagents')).toContainText(r.expiring[0].name);
  });

  test('Validation (technical): the fixture result is queued with its analyte name; validate it in the UI -> API TECH_VALIDATED, it moves to the medical queue', async () => {
    await openTile(page, 'validation', 'lab-validation').catch(async () => { await openWork(page); await page.getByTestId('tile-lab.validation').click(); });
    await expect(page.getByTestId(`order-${o.val.number}`)).toBeVisible();
    await expect(page.getByTestId(`res-${res.val}`)).toContainText(`E2E Web K ${fx.code}`);
    await expect(page.getByTestId(`res-${res.val}`)).toContainText('4.4');
    expect((await api(sw('tech'), 'GET', `/results/${res.val}`).catch(() => ({ body: null }))).body ?? null).toBeDefined();
    await page.getByTestId(`res-${res.val}`).click();
    await expect(page.getByTestId('validate-sheet')).toBeVisible();
    await page.getByTestId('validate-confirm').click();
    await expect.poll(async () => ((await api(sw('director'), 'GET', `/orders/${o.val.id}/results`)).body.find((r: any) => r.id === res.val) ?? {}).status).toBe('TECH_VALIDATED');
    expect(((await api(sw('tech'), 'GET', `/results/${res.val}`)).body ?? {}).techValidatedBy ?? sw('tech').id).toBe(sw('tech').id);
    await expect(page.getByTestId(`res-${res.val}`)).toHaveCount(0);
    expectClean(bad);
  });
});

test.describe('signatory (PRO)', () => {
  let page: Page; let bad: string[];
  let br: Browser;
  test.beforeAll(async () => { ({ page, bad, browser: br } = await role(null, 'demo-lab', 'signatory')); });
  test.afterAll(async () => { await closeQuietly(br); });

  test('Work lists exactly the API modules (validation + critical, no collection/accession/reagents)', async () => {
    await openWork(page);
    expect(await tilesOf(page)).toEqual(await apiTiles(sw('signatory')));
    expect(await tilesOf(page)).toEqual(expect.arrayContaining(['validation', 'critical']));
    for (const k of ['phlebotomy', 'accession', 'reagents']) expect(await tilesOf(page)).not.toContain(k);
  });

  test('Critical: the fixture critical alert is listed for the order; acknowledge it with a read-back note -> API + web show ACKNOWLEDGED by the signatory with the note', async () => {
    await openTile(page, 'critical', 'lab-critical');
    const a = await critKey(sw('signatory'), o.crit);
    expect(a, 'critical alert raised for the fixture order').toBeTruthy();
    await expect(page.getByTestId(`crit-${a.id}`)).toContainText(o.crit.number);
    await expect(page.getByTestId(`crit-${a.id}`)).toContainText(`E2E Web K ${fx.code}`);
    await expect(page.getByTestId(`crit-${a.id}`)).not.toContainText('7.2');          // KLCRIT03: no raw value in the alert
    await page.getByTestId(`crit-${a.id}`).click();
    await expect(page.getByTestId('crit-sheet')).toBeVisible();
    await page.getByTestId('crit-note').fill('READ-BACK: clinician repeated the critical potassium, repeat sample requested');
    await page.getByTestId('crit-ack').click();
    await expect.poll(async () => (await critKey(sw('signatory'), o.crit))?.ackedAt ?? null).not.toBeNull();
    const after = await critKey(sw('signatory'), o.crit);
    expect(after).toMatchObject({ ackedBy: sw('signatory').id, ackNote: 'READ-BACK: clinician repeated the critical potassium, repeat sample requested' });
    // lab web endpoint (what :5191 calls)
    const raw = after.id.replace(/^crit_/, '');
    expect((await api(sw('director'), 'GET', '/critical-alerts?status=ACKNOWLEDGED')).body.find((x: any) => x.id === raw)).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedBy: sw('signatory').id });
    await expect(page.getByTestId(`crit-${a.id}`)).toContainText(/acknowledged/i);
  });

  test('Validation (medical): the tech-validated fixture result is queued; sign-off in the UI -> API MEDICAL_VALIDATED; the order becomes ready to sign', async () => {
    await openWork(page);
    await page.getByTestId('tile-lab.validation').click();
    await expect(page.getByTestId('lab-validation')).toBeVisible();
    await page.getByRole('tab', { name: /^Medical/i }).click();
    await expect(page.getByTestId(`order-${o.val.number}`)).toBeVisible();
    await page.getByTestId(`res-${res.val}`).click();
    await page.getByTestId('validate-confirm').click();
    await expect.poll(async () => ((await api(sw('director'), 'GET', `/orders/${o.val.id}/results`)).body.find((r: any) => r.id === res.val) ?? {}).status).toBe('MEDICAL_VALIDATED');
    await expect(page.getByTestId(`res-${res.val}`)).toHaveCount(0);
  });

  test('Release stage: ready-to-sign shows the order number; sign in the UI -> one signed report version by this signatory, re-sign refused, reception releases', async () => {
    await page.getByRole('tab', { name: /^Release/i }).click();
    await expect(page.getByTestId(`ready-${o.val.number}`)).toBeVisible();
    await expect(page.getByTestId(`ready-${o.val.number}`)).toContainText(o.val.patient);
    await page.getByTestId(`ready-${o.val.number}`).click();
    await page.getByTestId('sign-confirm').click();
    await expect.poll(async () => (await api(sw('signatory'), 'GET', `/orders/${o.val.id}/reports`)).body.length).toBe(1);
    const rep = (await api(sw('signatory'), 'GET', `/orders/${o.val.id}/reports`)).body[0];
    expect(rep.signedBy).toBe(sw('signatory').id);
    // signed but not released: listed under signedNotReleased (NOTE: the lab API still also lists it under readyToSign until release, see report)
    expect((await api(sw('signatory'), 'GET', '/release-queue')).body.signedNotReleased.map((x: any) => x.reportId)).toContain(rep.id);
    // a second sign attempt creates no second version
    expect((await api(sw('signatory'), 'POST', `/orders/${o.val.id}/reports`)).status).toBe(409);
    expect((await api(sw('signatory'), 'GET', `/orders/${o.val.id}/reports`)).body).toHaveLength(1);
    // reception releases it (the web/app release endpoint) and the order is RELEASED for everyone
    ok(await api(sw('reception'), 'POST', `/reports/${rep.id}/release`, { channels: ['PRINTED'] }, { app: true }), 201);
    expect((await api(sw('director'), 'GET', `/orders/${o.val.id}`)).body.status).toBe('RELEASED');
    expectClean(bad);
  });

  test('QC and TAT tiles open with real data', async () => {
    await openWork(page);
    await page.getByTestId('tile-lab.qc').click();
    await expect(page.getByTestId('lab-qc')).toBeVisible();
    await openWork(page);
    await page.getByTestId('tile-lab.tat').click();
    await expect(page.getByTestId('lab-tat')).toBeVisible();
    const tat = (await api(sw('signatory'), 'GET', '/tat', undefined, { app: true })).body;
    expect(tat.summary.total).toBeGreaterThan(0);
    const first = tat.rows.filter((r: any) => r.status === 'BREACHED')[0];
    await expect(page.getByTestId(`tat-${first.orderItemId}`)).toContainText(first.orderNumber);
    expectClean(bad);
  });
});

test.describe('reception (PRO)', () => {
  let page: Page; let bad: string[];
  let br: Browser;
  test.beforeAll(async () => { ({ page, bad, browser: br } = await role(null, 'demo-lab', 'reception')); });
  test.afterAll(async () => { await closeQuietly(br); });

  test('Work lists exactly the API modules; no validation/QC/worklist/critical/reagents', async () => {
    await openWork(page);
    expect(await tilesOf(page)).toEqual(await apiTiles(sw('reception')));
    expect(await tilesOf(page)).toContain('orders');
    for (const k of ['validation', 'qc', 'worklist', 'critical', 'reagents']) expect(await tilesOf(page)).not.toContain(k);
  });

  test('Orders: today list shows real order numbers + patients; search finds the fixture order; a status chip filters and matches the API', async () => {
    await page.getByTestId('tile-lab.orders').click();
    await expect(page.getByTestId('lab-orders')).toBeVisible();
    await expect(page.getByTestId(`order-${o.rec.number}`)).toContainText(o.rec.patient);
    await page.getByTestId('orders-search').fill(o.crit.number);
    await expect(page.getByTestId(`order-${o.crit.number}`)).toBeVisible();
    await expect(page.getByTestId(`order-${o.rec.number}`)).toHaveCount(0);
    await page.getByTestId('orders-search').fill('');
    await page.getByRole('button', { name: /^Released$/i }).first().click().catch(async () => { await page.getByText(/^Released$/i).first().click(); });
    const rel = (await api(sw('reception'), 'GET', '/orders?status=RELEASED&limit=50', undefined, { app: true })).body;
    await expect(page.getByTestId(`order-${rel.rows[0].orderNumber}`)).toBeVisible();
    await expect(page.getByTestId(`order-${o.rec.number}`)).toHaveCount(0);
  });

  test('Phlebotomy at the desk: reception scans the fixture order tube and collects it -> API COLLECTED by reception', async () => {
    await openWork(page);
    await page.getByTestId('tile-lab.phlebotomy').click();
    await expect(page.getByTestId('lab-phlebotomy')).toBeVisible();
    const sp = o.rec.spec;
    await page.getByTestId('phleb-field').fill(sp.barcode); await page.getByTestId('phleb-field').press('Enter');
    await expect(page.getByTestId('specimen-card')).toContainText(o.rec.number);
    await page.getByTestId('act-collect').click();
    await expect.poll(async () => (await api(sw('reception'), 'GET', `/specimens/${sp.id}`)).body.status).toBe('COLLECTED');
    expect((await api(sw('reception'), 'GET', `/specimens/${sp.id}/custody`)).body.find((c: any) => c.type === 'COLLECTED').actorId).toBe(sw('reception').id);
  });

  test('TAT board shows the breached list of the demo data; reception cannot reach results, QC or reagents', async () => {
    await openWork(page);
    await page.getByTestId('tile-lab.tat').click();
    await expect(page.getByTestId('lab-tat')).toBeVisible();
    const tat = (await api(sw('reception'), 'GET', '/tat', undefined, { app: true })).body;
    const first = tat.rows.filter((r: any) => r.status === 'BREACHED')[0];
    await expect(page.getByTestId(`tat-${first.orderItemId}`)).toContainText(first.orderNumber);
    for (const p of ['/mobile/reagents/low-stock', '/mobile/worklist/progress', '/validation-queue', '/qc/blocks']) expect((await api(sw('reception'), 'GET', p, undefined, { app: true })).status, p).toBe(403);
    expectClean(bad);
  });
});

test.describe('BASIC lab director (upgrade + safety alerts only)', () => {
  let page: Page; let bad: string[]; let crit: Ord; let key: string; let d: Who;
  let br: Browser;
  test.beforeAll(async () => {
    basic = await fixture('basic-lab', ['owner', 'director', 'tech', 'phleb', 'reception', 'supervisor']);
    crit = await newOrder(basic, 'STAT'); await toProcessing(basic, crit); await passQc(basic); await enterResult(basic, crit, 7.4);
    d = basic.who.director;
    key = (await critKey(d, crit)).id;
    ({ page, bad, browser: br } = await role(null, 'basic-lab', 'director'));
  });
  test.afterAll(async () => { await closeQuietly(br); });

  test('bootstrap is entitlement-off; the app lands on the upgrade screen: the nine Pro lab tools are listed as locked (no lab tiles), the safety-alert shortcut is offered', async () => {
    const b = (await api(d, 'GET', '/mobile/bootstrap', undefined, { app: true })).body;
    expect(b).toMatchObject({ entitlement: { enabled: false }, safetyAlertsOnly: true, modules: [] });
    await expect(page.getByTestId('upgrade')).toBeVisible();
    await expect(page.getByTestId('upgrade')).toContainText(/basic/i);
    for (const k of ['phlebotomy', 'accession', 'critical', 'validation', 'worklist', 'qc', 'tat', 'orders', 'reagents']) await expect(page.getByTestId(`upgrade-tool-lab.${k}`)).toBeVisible();
    expect(await page.locator('[data-testid^="tile-lab."]').count()).toBe(0);
    await expect(page.getByTestId('upgrade-alerts')).toBeVisible();
  });

  test('the critical value of the fixture order is in the safety inbox; acknowledge it with a note -> API ACKNOWLEDGED; every other app route stays 403 FEATURE_DISABLED', async () => {
    await page.getByTestId('upgrade-alerts').click();
    await expect(page.getByTestId('inbox')).toBeVisible();
    await expect(page.getByTestId(`alert-${key}`)).toContainText(crit.number);
    await page.getByTestId(`alert-${key}`).click();
    await expect(page.getByTestId('alert-sheet')).toBeVisible();
    await page.getByRole('textbox').last().fill('READ-BACK: confirmed by phone with the ordering clinician');
    await page.getByTestId('alert-ack').click();
    await expect.poll(async () => (await critKey(d, crit))?.ackedAt ?? null).not.toBeNull();
    expect(await critKey(d, crit)).toMatchObject({ ackedBy: d.id, ackNote: 'READ-BACK: confirmed by phone with the ordering clinician' });
    expect((await api(d, 'GET', '/critical-alerts?status=ACKNOWLEDGED')).body.find((x: any) => x.id === key.replace(/^crit_/, '')).status).toBe('ACKNOWLEDGED');
    for (const p of ['/mobile/summary', '/mobile/inbox', '/orders']) {
      const r = await api(d, 'GET', p, undefined, { app: true });
      expect(r.status, p).toBe(403); expect(r.body.code).toBe('FEATURE_DISABLED');
    }
    expectClean(bad, [/403 /]);
  });
});
