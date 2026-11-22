import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, apiLogin, signIn, openWork, trackConsole, PASSWORD } from './pharmacy-helpers';

/**
 * Kiorly Team (Expo web) x Kiorly Pharmacy, as the real staff roles: pharmacist, manager, cashier, BASIC owner.
 * Each role signs in through the sign-in screen, sees tiles that match its /mobile/bootstrap, sees REAL seeded data (drug names, Rx ids, lots,
 * customers), opens every tile and performs one real action whose effect is then read back from the API (the same API the web app :5190 uses).
 * Fixtures are created per run through the owner API (drugs "E2E-Web-*"); nothing is reset.
 */
test.describe.configure({ mode: 'serial' });

const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const isoDate = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const ok = (r: { status: number; body: any }, ...codes: number[]) => { expect(codes.length ? codes : [200, 201], JSON.stringify(r.body)).toContain(r.status); return r.body; };

let T: Record<string, string> = {}; let branchId = '';
const fx: { patient: string; rxValidateId: string; rxInteractId: string; rxMgrId: string; warf: any; ibu: any; nearLot: string; farLot: string; discId: string; discDrug: string; poId: string; poNumber: string; gtin: string; gtinDrug: string; bdId: string; tag: string } = {} as never;

async function drug(o: { name: string; ingredient?: string; strength?: string; rx?: boolean; schedule?: string; gtin?: string; price?: string }) {
  return ok(await api(T.owner, 'POST', '/catalogue/drugs', { brandName: o.name, activeIngredient: o.ingredient ?? `e2e-${rnd()}`, strength: o.strength ?? '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: o.rx ?? false, controlledSchedule: o.schedule, gtin: o.gtin, price: o.price ?? '40.00' }), 201);
}
async function lot(drugId: string, lotNumber: string, qty: number, expDays: number) {
  return ok(await api(T.owner, 'POST', '/inventory/receipts', { branchId, invoiceNo: `E2EW-${rnd()}`, idempotencyKey: `e2ew-${randomUUID()}`, lines: [{ drugId, lotNumber, expiryDate: isoDate(expDays), quantity: qty, unitCost: '20.00' }] }), 201).lines[0].lotId as string;
}
async function paperRx(drugIds: string[], patient: string, validate = false) {
  const id = ok(await api(T.pharmacist, 'POST', '/prescriptions/paper', { patient: { displayName: patient, allergies: [] }, prescriberName: 'Dr E2E Web', prescriberLicenceNo: 'MD-E2EW', lines: drugIds.map((d) => ({ drugId: d, quantity: 1, directions: 'daily' })) }), 201).id as string;
  if (validate) ok(await api(T.pharmacist, 'POST', `/prescriptions/${id}/validate`));
  return id;
}

test.beforeAll(async () => {
  for (const u of ['owner', 'pharmacist', 'manager', 'cashier', 'owner.basic']) T[u] = await apiLogin(u);
  branchId = (await api(T.pharmacist, 'GET', '/mobile/bootstrap')).body.user.branchId;
  const tag = rnd(); fx.patient = `E2E Web Patient ${tag}`;
  // plain Rx the pharmacist validates in the UI
  const otc = await drug({ name: `E2E-Web-Plain-${tag}`, rx: true }); await lot(otc.id, `P-${tag}`, 10, 300);
  fx.rxValidateId = await paperRx([otc.id], fx.patient);
  // warfarin + ibuprofen (BLOCK interaction) with two lots: the nearer-expiry lot must be the one decremented
  fx.warf = await drug({ name: `E2E-Web-Warfarin-${tag}`, ingredient: 'warfarin', strength: '5 mg', rx: true }); fx.ibu = await drug({ name: `E2E-Web-Ibuprofen-${tag}`, ingredient: 'ibuprofen', strength: '400 mg', rx: true });
  fx.nearLot = await lot(fx.warf.id, `WN-${tag}`, 5, 40); fx.farLot = await lot(fx.warf.id, `WF-${tag}`, 5, 300); await lot(fx.ibu.id, `I-${tag}`, 10, 300);
  fx.rxInteractId = await paperRx([fx.warf.id, fx.ibu.id], `E2E Web Interaction ${tag}`);
  fx.rxMgrId = await paperRx([otc.id], `E2E Web Manager-view ${tag}`);
  // controlled drug with a discrepancy reported by the pharmacist, witness still pending (the manager countersigns in the UI)
  const cd = await drug({ name: `E2E-Web-Morphine-${tag}`, ingredient: 'morphine', strength: '10 mg', rx: true, schedule: 'SCHEDULE_2' }); fx.discDrug = cd.brandName; await lot(cd.id, `CD-${tag}`, 40, 300);
  const au = ok(await api(T.pharmacist, 'POST', '/controlled/audits', { branchId, drugId: cd.id, countedQty: 37, notes: 'E2E web: 3 short', witness: { email: 'owner@demo.kiorly.local', password: PASSWORD } }), 201);
  fx.discId = au.discrepancy.id;
  // a barcode product, also the line of a SENT purchase order (received through the UI by the manager)
  fx.gtin = `6226${String(Date.now()).slice(-9)}`; fx.gtinDrug = `E2E-Web-Barcode-${tag}`;
  const bd = await drug({ name: fx.gtinDrug, gtin: fx.gtin, price: '42.50' }); await lot(bd.id, `BC-${tag}`, 12, 200);
  const sup = ok(await api(T.owner, 'POST', '/suppliers', { name: `E2E Web Supplier ${tag}`, phone: '01000000008', email: 'e2e-web-supplier@demo.kiorly.local' }), 201);
  const po = ok(await api(T.owner, 'POST', '/purchase-orders', { branchId, supplierId: sup.id, lines: [{ drugId: bd.id, qtyOrdered: 12, unitCost: '9.00' }] }), 201);
  ok(await api(T.owner, 'POST', `/purchase-orders/${po.id}/send`, { via: 'EMAIL' })); fx.poId = po.id; fx.poNumber = po.poNumber; fx.bdId = bd.id; fx.tag = tag;
});

const tilesOf = async (page: Page) => (await page.locator('[data-testid^="tile-"]').evaluateAll((e) => e.map((x) => x.getAttribute('data-testid')!.replace('tile-pharmacy.', '')))).sort();
const apiTiles = async (user: string) => ((await api(T[user], 'GET', '/mobile/bootstrap')).body.modules as any[]).filter((m) => m.enabled && m.key !== 'pharmacy.search').map((m) => m.key.replace('pharmacy.', '')).sort();   // search is the global search, not a tile
async function openTile(page: Page, key: string, screenId: string) {
  await openWork(page);
  await page.getByTestId(`tile-pharmacy.${key}`).click();
  await expect(page.getByTestId(screenId)).toBeVisible();
}
const back = async (page: Page) => { await page.goBack(); await expect(page.getByTestId('work')).toBeVisible(); };

test.describe('pharmacist (CHAIN / ENTERPRISE)', () => {
  let page: Page; let bad: string[];
  test.beforeAll(async ({ browser }) => { page = await (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage(); bad = trackConsole(page); await signIn(page, 'pharmacist'); });
  test.afterAll(async () => { await page.context().close(); });

  test('home shows real KPIs and the Work tab lists exactly the API modules', async () => {
    await expect(page.getByTestId('pharmacy-summary')).toBeVisible({ timeout: 90_000 });   // first load of a cold Metro bundle can take a while
    const total = (await api(T.pharmacist, 'GET', '/prescriptions/verification-queue')).body.total;
    await expect(page.getByTestId('kpi-rx')).toContainText(String(total));
    await expect(page.getByTestId('kpi-cash')).toContainText(/EGP|ج\.م/);
    await openWork(page);
    expect(await tilesOf(page)).toEqual(await apiTiles('pharmacist'));
    expect((await tilesOf(page)).length).toBe(9);
  });

  test('Rx queue shows seeded and fixture prescriptions with patient names', async () => {
    await openTile(page, 'rx', 'rx-queue');
    const q = (await api(T.pharmacist, 'GET', '/prescriptions/verification-queue')).body;
    const first = q.items[0];
    await expect(page.getByTestId(`rx-${first.id}`)).toContainText(first.patient.displayName);
    await expect(page.getByTestId(`rx-${fx.rxValidateId}`)).toContainText(fx.patient);
    await expect(page.getByTestId(`rx-${fx.rxInteractId}`)).toBeVisible();
  });

  test('validate an Rx through the UI: API shows VALIDATED and it leaves the verification queue', async () => {
    await page.getByTestId(`rx-${fx.rxValidateId}`).click();
    await expect(page.getByTestId('rx-detail')).toBeVisible();
    await expect(page.getByTestId('rx-detail')).toContainText(fx.patient);
    expect((await api(T.pharmacist, 'GET', `/prescriptions/${fx.rxValidateId}`)).body.status).toBe('RECEIVED');
    await page.getByTestId('rx-validate').click();
    await expect.poll(async () => (await api(T.owner, 'GET', `/prescriptions/${fx.rxValidateId}`)).body.status).toBe('VALIDATED');
    await expect(page.getByTestId('rx-validate')).toHaveCount(0);
    await expect(page.getByTestId('rx-run-checks')).toBeVisible();                  // a validated Rx must stay dispensable from the app (it left the queue)
    expect((await api(T.pharmacist, 'GET', '/prescriptions/verification-queue')).body.items.map((i: any) => i.id)).not.toContain(fx.rxValidateId);
  });

  test('interaction BLOCK -> override with a reason -> sign off -> dispensed from the FEFO lot (checked through the API)', async () => {
    await page.goBack(); await expect(page.getByTestId('rx-queue')).toBeVisible();
    await page.getByTestId(`rx-${fx.rxInteractId}`).click();
    await expect(page.getByTestId('rx-detail')).toContainText('E2E Web Interaction');
    await page.getByTestId('rx-run-checks').click();                                // validates the Rx first, then creates the draft with its safety checks
    await expect(page.getByTestId('check-INTERACTION')).toBeVisible();
    expect((await api(T.owner, 'GET', `/prescriptions/${fx.rxInteractId}`)).body.status).toBe('VALIDATED');
    await expect(page.getByTestId('check-INTERACTION')).toContainText(/warfarin/i);
    await expect(page.getByTestId('rx-signoff')).toBeDisabled();                     // a BLOCK stops sign-off until overridden
    await page.getByTestId('override-INTERACTION').click();
    await expect(page.getByTestId('override-confirm')).toBeDisabled();              // a reason is mandatory
    await page.getByTestId('override-reason').fill('Prescriber confirmed, INR monitored (e2e web)');
    await page.getByTestId('override-confirm').click();
    await expect(page.getByTestId('rx-signoff')).toBeEnabled();
    const disp = (await api(T.pharmacist, 'GET', `/dispensings?prescriptionId=${fx.rxInteractId}`)).body;
    const d = (Array.isArray(disp) ? disp : disp.items)[0];
    const full = (await api(T.pharmacist, 'GET', `/dispensings/${d.id}`)).body;
    expect(full.safetyChecks.find((c: any) => c.kind === 'INTERACTION')).toMatchObject({ outcome: 'OVERRIDDEN_BY_PHARMACIST', overrideReason: 'Prescriber confirmed, INR monitored (e2e web)' });
    await page.getByTestId('rx-signoff').click();
    // the pharmacist's sign-off lands; the counter sale is then paid and completed at the till (POST complete with a payment, as the web POS does)
    await expect.poll(async () => (await api(T.owner, 'GET', `/dispensings/${d.id}`)).body.status, { timeout: 30_000 }).toBe('SIGNED_OFF');
    await expect(page.getByTestId('rx-signoff')).toBeDisabled();
    const key = `e2e-web-${randomUUID()}`;
    ok(await api(T.cashier, 'POST', `/dispensings/${d.id}/complete`, { idempotencyKey: key, payments: [{ method: 'CASH', amount: '200.00' }] }), 201);
    ok(await api(T.cashier, 'POST', `/dispensings/${d.id}/complete`, { idempotencyKey: key, payments: [{ method: 'CASH', amount: '200.00' }] }), 200, 201);   // replay = one effect
    expect((await api(T.owner, 'GET', `/dispensings/${d.id}`)).body.status).toBe('DISPENSED');
    const lots = (await api(T.owner, 'GET', `/inventory/lots?drugId=${fx.warf.id}&branchId=${branchId}`)).body.items as any[];
    expect(Object.fromEntries(lots.map((l) => [l.id, l.qtyOnHand]))).toEqual({ [fx.nearLot]: 4, [fx.farLot]: 5 });   // FEFO: the 40-day lot, not the 300-day lot
    expect((await api(T.owner, 'GET', `/prescriptions/${fx.rxInteractId}`)).body.status).toMatch(/DISPENSED/);
  });

  test('barcode lookup of the fixture GTIN shows drug, price and lots', async () => {
    await page.goto('/work'); await expect(page.getByTestId('work')).toBeVisible();
    await page.getByTestId('tile-pharmacy.barcode').click();
    await page.getByTestId('barcode-input').fill(fx.gtin); await page.getByTestId('barcode-input').press('Enter');
    await expect(page.getByTestId('barcode-result')).toContainText(fx.gtinDrug);
    await expect(page.getByTestId('barcode-result')).toContainText(/42\.50|42,50|٤٢[.,٫]٥٠/);
    await expect(page.locator('[data-testid^="lot-BC-"]')).toHaveCount(1);
  });

  test('expiry, controlled (same-user rule), customers, shift, receiving and orders screens show real data', async () => {
    // expiry: the soonest API item is on screen
    await openTile(page, 'expiry', 'expiry');
    const ex = (await api(T.pharmacist, 'GET', '/mobile/pharmacy/expiry-lowstock')).body;
    await expect(page.getByTestId(`exp-${ex.expiry.items[0].lotId}`)).toContainText(ex.expiry.items[0].lotNumber);
    if (ex.blocked?.items?.length) await expect(page.getByTestId(`blocked-${ex.blocked.items[0].lotId}`)).toContainText(ex.blocked.items[0].lotNumber);
    await back(page);
    // controlled: the reporter (pharmacist) sees the discrepancy but may not countersign it
    await openTile(page, 'controlled', 'controlled');
    await expect(page.getByTestId(`disc-${fx.discId}`)).toContainText(fx.discDrug);
    await page.getByTestId(`disc-${fx.discId}`).click();
    await expect(page.getByTestId('witness-rule')).toBeVisible();
    await expect(page.getByTestId('countersign-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await back(page);
    // customers: search a seeded customer by name
    const c = (await api(T.pharmacist, 'GET', '/customers?pageSize=1')).body.items[0];
    await openTile(page, 'customers', 'customers');
    await page.getByTestId('customer-search').fill(c.displayName);
    await expect(page.getByTestId(`cust-${c.id}`)).toContainText(c.displayName);
    await back(page);
    // shift: expected cash matches the API X-report
    await openTile(page, 'shift', 'shift');
    const sh = (await api(T.pharmacist, 'GET', '/mobile/pharmacy/shift-summary')).body;
    await expect(page.getByTestId('expected-cash')).toContainText(Math.floor(Number(sh.report.expectedCash)).toLocaleString('en-US'));
    await back(page);
    // receiving: the fixture PO is listed (the manager posts a receipt against it below)
    await openTile(page, 'receiving', 'receiving');
    await expect(page.getByTestId(`po-${fx.poId}`)).toContainText(fx.poNumber);
    await back(page);
    // orders (INTEGRATED tenant)
    await openTile(page, 'orders', 'kx-orders');
    await back(page);
    // stock count list
    await openTile(page, 'stockcount', 'stockcount');
  });

  test('no console errors / 5xx during the pharmacist session', () => { expect(bad).toEqual([]); });
});

test.describe('cashier (CHAIN): till work only', () => {
  let page: Page; let bad: string[];
  test.beforeAll(async ({ browser }) => { page = await (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage(); bad = trackConsole(page); await signIn(page, 'cashier'); });
  test.afterAll(async () => { await page.context().close(); });

  test('tiles are the cashier modules only (no receiving, stock count, controlled register or online orders)', async () => {
    await expect(page.getByTestId('pharmacy-summary')).toBeVisible();
    await expect(page.getByTestId('kpi-cash')).toBeVisible();
    await openWork(page);
    const tiles = await tilesOf(page);
    expect(tiles).toEqual(await apiTiles('cashier'));
    expect(tiles).toEqual(['barcode', 'customers', 'expiry', 'rx', 'shift']);
  });

  test('barcode lookup of the fixture product, customer lookup of a seeded customer, shift cash', async () => {
    await openTile(page, 'barcode', 'barcode');
    await page.getByTestId('barcode-input').fill(fx.gtin); await page.getByTestId('barcode-input').press('Enter');
    await expect(page.getByTestId('barcode-result')).toContainText(fx.gtinDrug);
    await expect(page.getByTestId('barcode-result')).toContainText(/42\.50|42,50|٤٢[.,٫]٥٠/);
    await back(page);
    const c = (await api(T.cashier, 'GET', '/customers?pageSize=1')).body.items[0];
    await openTile(page, 'customers', 'customers');
    await page.getByTestId('customer-search').fill(c.displayName);
    await expect(page.getByTestId(`cust-${c.id}`)).toContainText(c.displayName);
    await back(page);
    await openTile(page, 'shift', 'shift');
    const sh = (await api(T.cashier, 'GET', '/mobile/pharmacy/shift-summary')).body;
    await expect(page.getByTestId('expected-cash')).toContainText(Math.floor(Number(sh.report.expectedCash)).toLocaleString('en-US'));
    await back(page);
    await openTile(page, 'expiry', 'expiry');
  });

  test('Rx screen is read-only for the cashier: no validate / reject / run-checks, and the API refuses the same actions', async () => {
    await back(page);
    await openTile(page, 'rx', 'rx-queue');
    await page.getByTestId(`rx-${fx.rxMgrId}`).click();
    await expect(page.getByTestId('rx-detail')).toContainText('E2E Web Manager-view');
    for (const id of ['rx-validate', 'rx-reject', 'rx-run-checks', 'rx-signoff']) await expect(page.getByTestId(id)).toHaveCount(0);
    expect((await api(T.cashier, 'POST', `/prescriptions/${fx.rxMgrId}/validate`)).status).toBe(403);
    expect((await api(T.owner, 'GET', `/prescriptions/${fx.rxMgrId}`)).body.status).toBe('RECEIVED');
  });

  test('no console errors', () => { expect(bad).toEqual([]); });
});

test.describe('manager (CHAIN): witness countersign, receiving, validation without sign-off', () => {
  let page: Page; let bad: string[];
  test.beforeAll(async ({ browser }) => { page = await (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage(); bad = trackConsole(page); await signIn(page, 'manager'); });
  test.afterAll(async () => { await page.context().close(); });

  test('tiles match the manager bootstrap (all nine screens incl. orders)', async () => {
    await expect(page.getByTestId('pharmacy-summary')).toBeVisible();
    await openWork(page);
    expect(await tilesOf(page)).toEqual(await apiTiles('manager'));
    expect((await tilesOf(page)).length).toBe(9);
  });

  test('witness countersign through the UI (a different user than the reporter): API records one countersign and clears the witness-pending state', async () => {
    await openTile(page, 'controlled', 'controlled');
    const card = page.getByTestId(`disc-${fx.discId}`);
    await expect(card).toContainText(fx.discDrug);
    const before = (await api(T.manager, 'GET', '/mobile/pharmacy/controlled/pending-witness')).body.items.find((i: any) => i.id === fx.discId);
    expect(before).toMatchObject({ witnessPending: true, canCountersign: true });
    await card.click();
    await expect(page.getByTestId('countersign-confirm')).toBeEnabled();
    await expect(page.getByTestId('witness-rule')).toHaveCount(0);
    page.once('dialog', (d) => void d.accept());
    await page.getByTestId('countersign-confirm').click();
    await expect.poll(async () => (await api(T.manager, 'GET', '/mobile/pharmacy/controlled/pending-witness')).body.items.find((i: any) => i.id === fx.discId)?.witnessPending).toBe(false);
    const cs = (await api(T.manager, 'GET', '/mobile/pharmacy/controlled/pending-witness')).body.items.find((i: any) => i.id === fx.discId).countersigns;
    expect(cs).toHaveLength(1);
    const kinds = ((await api(T.manager, 'GET', '/mobile/alerts')).body.items as any[]).filter((a) => a.subject?.id === fx.discId).map((a) => a.kind);
    expect(kinds).toEqual(['CONTROLLED_DRUG_DISCREPANCY']);                         // witness-pending alert gone, discrepancy still open
    await back(page);
  });

  test('receiving: scan a GS1 pack against the PO, post a partial receipt (5 of 12) -> PARTIALLY_RECEIVED with the lot in stock', async () => {
    await openTile(page, 'receiving', 'receiving');
    await page.getByTestId(`po-${fx.poId}`).click();
    await expect(page.getByTestId('receive-po')).toBeVisible();
    const exp = isoDate(365).slice(2).replace(/-/g, '');
    const scan = page.getByTestId('receive-scan'); await scan.fill(`(01)${fx.gtin.padStart(14, '0')}(17)${exp}(10)RCV-${fx.tag}`); await scan.press('Enter');
    await expect(page.getByTestId('receive-lot')).toHaveValue(`RCV-${fx.tag}`);
    await page.getByTestId('receive-qty').fill('5');
    await page.getByTestId('receive-add').click();
    await page.getByTestId('post-receipt').click();
    await expect.poll(async () => (await api(T.manager, 'GET', `/purchase-orders/${fx.poId}`)).body.status).toBe('PARTIALLY_RECEIVED');
    const po = (await api(T.owner, 'GET', `/purchase-orders/${fx.poId}`)).body;
    expect(po.lines[0]).toMatchObject({ qtyOrdered: 12, qtyReceived: 5 });
    const lots = (await api(T.owner, 'GET', `/inventory/lots?drugId=${fx.bdId}&branchId=${branchId}`)).body.items as any[];
    expect(lots.find((l) => l.lotNumber === `RCV-${fx.tag}`)).toMatchObject({ qtyOnHand: 5 });
  });

  test('Rx: the manager has no run-checks / sign-off / override; validate is offered when the API grants the rx.validate screen', async () => {
    await page.goto('/work'); await expect(page.getByTestId('work')).toBeVisible();
    await page.getByTestId('tile-pharmacy.rx').click();
    await page.getByTestId(`rx-${fx.rxMgrId}`).click();
    await expect(page.getByTestId('rx-detail')).toContainText('E2E Web Manager-view');
    for (const id of ['rx-run-checks', 'rx-signoff']) await expect(page.getByTestId(id)).toHaveCount(0);
    const screens = ((await api(T.manager, 'GET', '/mobile/bootstrap')).body.modules as any[]).find((m) => m.key === 'pharmacy.rx').screens as string[];
    expect(screens).not.toContain('rx.override');
    if (screens.includes('rx.validate')) {
      await expect(page.getByTestId('rx-validate')).toBeVisible(); await expect(page.getByTestId('rx-reject')).toBeVisible();
      await page.getByTestId('rx-validate').click();
      await expect.poll(async () => (await api(T.owner, 'GET', `/prescriptions/${fx.rxMgrId}`)).body.status).toBe('VALIDATED');
    } else {
      console.warn('[pharmacy-staff] running API build predates the rx.validate screen: manager validation button not exercised (rebuild + restart :3100)');
      await expect(page.getByTestId('rx-validate')).toHaveCount(0);
    }
  });

  test('stock count, expiry and orders screens open with data', async () => {
    await page.goto('/work'); await expect(page.getByTestId('work')).toBeVisible();
    await page.getByTestId('tile-pharmacy.stockcount').click(); await expect(page.getByTestId('stockcount')).toBeVisible(); await back(page);
    await openTile(page, 'expiry', 'expiry'); await back(page);
    await openTile(page, 'orders', 'kx-orders');
  });

  test('no console errors', () => { expect(bad).toEqual([]); });
});

test.describe('BASIC owner (Corner pharmacy): upgrade screen + safety alerts only', () => {
  let page: Page; let bad: string[];
  test.beforeAll(async ({ browser }) => { page = await (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage(); bad = trackConsole(page); await signIn(page, 'owner.basic'); });
  test.afterAll(async () => { await page.context().close(); });

  test('lands on the upgrade screen: no tiles, the alert inbox is reachable and shows the real open alerts', async () => {
    await expect(page.getByTestId('upgrade')).toBeVisible();
    await expect(page.locator('[data-testid^="tile-"]')).toHaveCount(0);
    const boot = (await api(T['owner.basic'], 'GET', '/mobile/bootstrap')).body;
    expect(boot).toMatchObject({ safetyAlertsOnly: true, modules: [], entitlement: { enabled: false } });
    const alerts = (await api(T['owner.basic'], 'GET', '/mobile/alerts')).body.items as any[];
    expect(alerts.length).toBeGreaterThan(0);
    await expect(page.getByTestId('upgrade-alerts')).toContainText(String(alerts.length));
    // every other product route is refused by the API for this client, so the app cannot show any pharmacy workflow
    expect((await api(T['owner.basic'], 'GET', '/prescriptions/verification-queue')).body).toMatchObject({ code: 'FEATURE_DISABLED' });
    await page.getByTestId('upgrade-alerts').click();
    await expect(page.locator('body')).toContainText(alerts[0].title);
  });

  test('no console errors', () => { expect(bad).toEqual([]); });
});
