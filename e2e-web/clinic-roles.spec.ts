import { test, expect } from '@playwright/test';
import { api, apiLogin, bookNow, CLINIC, NA, openWork, signIn, sql, tileIds, watchErrors } from './clinic-helpers';

const NADIA = 'demo_u_na_nadia';
const DALIA = 'demo_p_na_8'; // Dalia Ibrahim (demo patient, asthma)

test.describe('Kiorly Team (Expo web) - clinic roles against the real API and seeded demo data', () => {
  test('doctor Nadia: tiles, schedule queue, patient search + summary, sign a prescription, approve the critical lab result', async ({ page }) => {
    const errors = watchErrors(page);
    const doc = await apiLogin(NA('nadia')), fd = await apiLogin(NA('frontdesk1'));
    // fixture through the clinic web API: a checked-in appointment with a draft prescription for this doctor
    const appt = await bookNow(fd, DALIA, NADIA, CLINIC, 'e2e-web doctor');
    const ci = await api(fd, 'POST', `/front-desk/appointments/${appt}/check-in`, {});
    expect(ci.status).toBe(201);
    const enc = ci.body.openEncounterId as string;
    expect((await api(doc, 'POST', `/encounters/${enc}/medications`, { drugName: 'Cetirizine 10 mg', dosage: '1 tablet daily', route: 'ORAL' })).status).toBe(201);
    sql(`delete from "MobileResultReview" where "tenantId" = 'demo_t_na' and "orderId" = 'demo_co_mobile_crit'`);

    await signIn(page, NA('nadia'));
    await expect(page.getByTestId('home-greeting')).toContainText('Nadia'); // honorific "Dr" is skipped
    await expect(page.getByTestId('kpi-today')).toBeVisible();
    await openWork(page);
    expect(await tileIds(page)).toEqual(['labs', 'patients', 'prescriptions', 'schedule', 'visits', 'vitals']); // no revenue, no home visits
    // schedule: the live queue has the seeded patient we just checked in
    await page.getByTestId('tile-clinic.schedule').click();
    await expect(page.getByTestId('clinic-schedule')).toBeVisible();
    await expect(page.getByTestId(`appt-${appt}`)).toContainText('Dalia Ibrahim');
    await page.goBack();
    // patients: search by name -> seeded demo patient -> summary (active problem from the demo data)
    await page.getByTestId('tile-clinic.patients').click();
    await page.getByTestId('patients-search').fill('Dalia');
    await expect(page.getByTestId(`patient-${DALIA}`)).toContainText('Dalia Ibrahim');
    await page.getByTestId(`patient-${DALIA}`).click();
    await expect(page.getByText('Asthma').first()).toBeVisible();
    await page.goBack(); await page.goBack();
    // prescriptions: pending list shows the draft, sign it in the UI -> FINALIZED on the clinic API (same data as the web app)
    await page.getByTestId('tile-clinic.prescriptions').click();
    await expect(page.getByTestId(`rx-${enc}`)).toContainText('Dalia Ibrahim');
    await page.getByTestId(`rx-${enc}`).click();
    await expect(page.getByTestId('rx-sheet').getByText('Cetirizine 10 mg')).toBeVisible();
    await page.getByTestId('rx-sign').click();
    await page.getByTestId('rx-confirm-yes').click();
    await expect.poll(async () => (await api(doc, 'GET', `/encounters/${enc}`)).body.status, { timeout: 15_000 }).toBe('FINALIZED');
    expect((await api(fd, 'GET', `/appointments/${appt}`)).body.status).toBe('COMPLETED');
    await page.goBack();
    // lab results: the seeded critical potassium result is flagged; approve it in the UI -> recorded once
    await page.getByTestId('tile-clinic.labs').click();
    const lab = page.getByTestId('lab-demo_co_mobile_crit');
    await expect(lab).toBeVisible();
    await lab.click();
    await expect(page.getByText(/critical/i).first()).toBeVisible();
    await page.getByTestId('lab-approve').click();
    await expect.poll(async () => ((await api(doc, 'GET', '/mobile/lab-results?status=reviewed')).body.items ?? []).some((x: any) => x.orderId === 'demo_co_mobile_crit'), { timeout: 15_000 }).toBe(true);
    await page.goBack();
    // vitals screen renders for the doctor too
    await page.getByTestId('tile-clinic.vitals').click();
    await expect(page.getByTestId('clinic-vitals')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('nurse: tiles, quick vitals with a CRITICAL reading raises a safety alert (UI -> API alerts + web trend), home-visit list renders', async ({ page }) => {
    const errors = watchErrors(page);
    const nurse = await apiLogin(NA('nurse'));
    await signIn(page, NA('nurse'));
    await openWork(page);
    expect(await tileIds(page)).toEqual(['homevisits', 'patients', 'schedule', 'vitals']); // no visits, no prescriptions
    await page.getByTestId('tile-clinic.vitals').click();
    await page.getByTestId('vitals-patient-search').fill('Dalia');
    await page.getByTestId(`pick-${DALIA}`).click();
    await expect(page.getByTestId('vitals-patient')).toContainText('Dalia Ibrahim');
    await page.getByTestId('vital-systolic').fill('236');
    await page.getByTestId('vital-diastolic').fill('131');
    await page.getByTestId('vital-pulse').fill('149');
    await page.getByTestId('vital-spo2').fill('81');
    const before = (await api(nurse, 'GET', `/nurse/patients/${DALIA}/vitals/trend`)).body.items.length;
    await page.getByTestId('vitals-submit').click();
    await expect(page.getByTestId('vitals-result')).toBeVisible();
    // the same reading on the web side (vitals trend) is critical, and the safety alert exists
    const trend = (await api(nurse, 'GET', `/nurse/patients/${DALIA}/vitals/trend`)).body.items;
    expect(trend.length).toBeGreaterThanOrEqual(before); // the trend list is capped on a busy dev DB, so check the new reading below instead of an exact count
    const crit = trend.filter((x: any) => x.systolic === 236 && x.spo2 === 81).sort((x: any, y: any) => y.recordedAt.localeCompare(x.recordedAt))[0]; // newest matching reading (earlier runs leave acknowledged ones)
    expect(crit).toMatchObject({ critical: true });
    const alerts = (await api(nurse, 'GET', '/mobile/alerts')).body.items;
    expect(alerts.find((a: any) => a.id === `vit_${crit.id}`)).toMatchObject({ kind: 'CRITICAL_VITALS' });
    // the alert is in the app inbox; acknowledge it there
    await page.goto('/inbox'); // deep link (session restores from storage)
    await page.getByTestId(`alert-vit_${crit.id}`).click();
    await page.getByTestId('alert-ack').click();
    await expect.poll(async () => ((await api(nurse, 'GET', '/mobile/alerts?status=all')).body.items.find((a: any) => a.id === `vit_${crit.id}`) ?? {}).ackedAt, { timeout: 15_000 }).toBeTruthy();
    // home visits list renders (empty state or rows) without errors
    await page.goto('/work');
    await page.getByTestId('tile-clinic.homevisits').click();
    await expect(page.getByTestId('clinic-rounds')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('front desk: tiles (schedule, patients only), check in an appointment from the schedule -> CHECKED_IN with a ticket on the clinic API', async ({ page }) => {
    const errors = watchErrors(page);
    const fd = await apiLogin(NA('frontdesk1'));
    const appt = await bookNow(fd, 'demo_p_na_10', NADIA, CLINIC, 'e2e-web frontdesk');
    await signIn(page, NA('frontdesk1'));
    await openWork(page);
    expect(await tileIds(page)).toEqual(['patients', 'schedule']);
    await page.getByTestId('tile-clinic.schedule').click();
    await page.getByText(/All today/).click();
    const row = page.getByTestId(`appt-${appt}`);
    await expect(row).toContainText('Heba Salah');
    await row.click();
    await page.getByText('Check in', { exact: true }).click();
    await expect.poll(async () => (await api(fd, 'GET', `/appointments/${appt}`)).body.status, { timeout: 15_000 }).toBe('CHECKED_IN');
    const a = (await api(fd, 'GET', `/appointments/${appt}`)).body;
    expect(a.queueTicketNumber).toBeGreaterThan(0);
    await page.goBack();
    await page.getByTestId('tile-clinic.patients').click();
    await page.getByTestId('patients-search').fill('Heba');
    await expect(page.getByTestId('patients-search')).toBeVisible();
    await expect(page.locator('[data-testid^="patient-"]').first()).toContainText('Heba');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('accountant: tiles (schedule, revenue only); the revenue screen shows the figures of /mobile/revenue/snapshot', async ({ page }) => {
    const errors = watchErrors(page);
    const acc = await apiLogin(NA('accountant'));
    await signIn(page, NA('accountant'));
    await openWork(page);
    expect(await tileIds(page)).toEqual(['revenue', 'schedule']);
    await page.getByTestId('tile-clinic.revenue').click();
    await expect(page.getByTestId('rev-today')).toBeVisible();
    const s = (await api(acc, 'GET', '/mobile/revenue/snapshot')).body;
    const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(n);
    await expect(page.getByTestId('clinic-revenue')).toContainText(money(s.last30.net));
    await expect(page.getByTestId('clinic-revenue')).toContainText(money(s.last7.gross));
    // the same totals the clinic web app shows (/revenue/totals) for the same window
    const from = s.daily[0].date, to = s.today.date;
    const web = (await api(acc, 'GET', `/revenue/totals?from=${from}&to=${to}`)).body;
    expect(s.last7.net).toBeCloseTo(web.netTotal, 2);
    await page.goBack();
    await page.getByTestId('tile-clinic.schedule').click();
    await expect(page.getByTestId('clinic-schedule')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('BASIC owner (Corner Family Clinic): upgrade screen, no tiles, the safety-alert inbox still works and can be acknowledged', async ({ page }) => {
    const errors = watchErrors(page);
    sql(`delete from "MobileAlertAck" where "tenantId" = 'demo_t_bs'`); sql(`update "VitalsObservation" set "escalatedAt" = null where id = 'demo_vit_bs_crit'`);
    const owner = await apiLogin('owner.basic@demo.kiorex.test');
    await signIn(page, 'owner.basic@demo.kiorex.test');
    await expect(page).toHaveURL(/upgrade/);
    await expect(page.getByTestId('upgrade-title')).toBeVisible();
    await expect(page.locator('[data-testid^="tile-"]')).toHaveCount(0);
    // every other mobile call is refused on BASIC (server side), alerts still answer
    expect((await api(owner, 'GET', '/mobile/schedule')).body).toMatchObject({ code: 'FEATURE_DISABLED' });
    // alerts stay reachable from the upgrade screen / inbox
    await page.goto('/inbox');
    await expect(page.getByTestId('inbox')).toBeVisible();
    const open = (await api(owner, 'GET', '/mobile/alerts')).body.items.find((a: any) => a.kind === 'CRITICAL_VITALS');
    expect(open).toBeTruthy();
    await page.getByTestId(`alert-${open.id}`).click();
    await page.getByTestId('alert-ack').click();
    await expect.poll(async () => ((await api(owner, 'GET', '/mobile/alerts?status=all')).body.items.find((a: any) => a.id === open.id) ?? {}).ackedAt, { timeout: 15_000 }).toBeTruthy();
    sql(`delete from "MobileAlertAck" where "tenantId" = 'demo_t_bs'`); sql(`update "VitalsObservation" set "escalatedAt" = null where id = 'demo_vit_bs_crit'`); // leave the demo alert open
    expect(errors, errors.join('\n')).toEqual([]);
  });
  test('solo nurse Mona: home-visit round driven in the UI (start travelling, arrived with geolocation, nursing note signed -> FINISHED), alert inbox + web visibility', async ({ page }) => {
    const errors = watchErrors(page);
    const mona = await apiLogin('mona@nurse-demo.kiorly.test');
    // fixture: a fresh confirmed home visit for Mona, booked the way the front desk does (clinic web API)
    let visit: any;
    for (let i = 0; i < 25 && !visit; i++) {
      const d = new Date(Date.now() + (2 + Math.floor(Math.random() * 26)) * 86_400_000); d.setUTCHours(6 + Math.floor(Math.random() * 8), 0, 0, 0);
      const r = await api(mona, 'POST', '/home-visits/bookings', { clinicId: 'demo_c_nsolo', patientId: 'demo_p_nsolo_h1001', clinicianId: 'demo_u_nsolo_mona', appointmentTypeId: 'demo_ty_nsolo_injection', startsAt: d.toISOString(), visitAddress: { district: 'heliopolis', line1: '5 E2E Web Street (invented)', lat: 30.09, lng: 31.32 }, addressConfirmed: true });
      if (r.status === 201) visit = r.body;
    }
    expect(visit, 'a free home slot').toBeTruthy();
    await signIn(page, 'mona@nurse-demo.kiorly.test');
    await openWork(page);
    expect(await tileIds(page)).toEqual(['homevisits', 'patients', 'revenue', 'schedule', 'vitals']); // nurse profession: no visits / prescriptions
    await page.goto(`/clinic/round/${visit.id}`);
    await expect(page.getByTestId('clinic-round')).toContainText('Hoda Mahmoud');
    await page.getByTestId('round-depart').click();
    await expect.poll(async () => (await api(mona, 'GET', `/home-visits/${visit.id}`)).body.state, { timeout: 15_000 }).toBe('ON_MY_WAY');
    await page.getByTestId('round-arrive').click(); // geolocation: Heliopolis (granted in the config)
    await expect.poll(async () => (await api(mona, 'GET', `/home-visits/${visit.id}`)).body.state, { timeout: 15_000 }).toBe('ARRIVED');
    await expect(page.getByTestId('sos-button')).toBeVisible();
    // the nursing note signs the visit record, which finalizes the encounter and closes the visit
    await page.getByTestId('round-note').fill('e2e-web: stable, injection given as ordered');
    await page.getByTestId('round-sign-finish').click();
    await expect.poll(async () => (await api(mona, 'GET', `/home-visits/${visit.id}`)).body.state, { timeout: 15_000 }).toBe('FINISHED');
    expect((await api(mona, 'GET', `/appointments/${visit.appointmentId}`)).body.status).toBe('COMPLETED');
    const rec = (await api(mona, 'GET', `/nurse/visits/${visit.appointmentId}/record`)).body;
    expect(rec).toMatchObject({ status: 'SIGNED', assessment: 'e2e-web: stable, injection given as ordered' });
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
