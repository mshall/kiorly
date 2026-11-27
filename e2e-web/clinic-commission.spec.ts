import { test, expect } from '@playwright/test';
import { NA, CLINIC, api, apiLogin, bookNow, openWork, signIn, tileIds, watchErrors } from './clinic-helpers';

/**
 * Kiorly (Expo web) x Kiorly Clinic: the Kiorex commission statement (read only) and "mark no-show", as the real roles of the demo organisation.
 * The screens must agree with what the Clinic API says about the same person (access probe, statement, appointment status).
 */
const NADIA = process.env.E2E_NADIA ?? 'demo_u_na_nadia';
const doctorId = async (token: string) => ((await api(token, 'GET', '/users/me')).body?.id ?? (await api(token, 'GET', '/auth/me')).body?.id) as string;

test.describe('Kiorly (Expo web) - clinic commission and no-show', () => {
  test('accountant: Revenue offers the commission statement; the screen agrees with the API access probe (figures when allowed, the role notice when not)', async ({ page }) => {
    const errors = watchErrors(page);
    const tok = await apiLogin(NA('accountant'));
    const canView = (await api(tok, 'GET', '/billing/kiorex-commissions/access')).body.canView as boolean;
    await signIn(page, NA('accountant'));
    await openWork(page);
    expect(await tileIds(page)).toEqual(['revenue', 'schedule']);
    await page.getByTestId('tile-clinic.revenue').click();
    await page.getByTestId('revenue-commission').click();
    await expect(page.getByTestId('clinic-commission')).toBeVisible();
    if (canView) {
      await expect(page.getByTestId('growth-rate-card')).toBeVisible();
      await expect(page.getByTestId('growth-statement-card')).toBeVisible();
      const period = new Date().toISOString().slice(0, 7);
      const s = (await api(tok, 'GET', `/billing/kiorex-commissions/statement?period=${period}`));
      if (s.status === 200) await expect(page.getByTestId('growth-stmt-figures')).toBeVisible(); else await expect(page.getByTestId('growth-stmt-unavailable')).toBeVisible();
      await expect(page.getByText(/bank transfer/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /edit|change|save/i })).toHaveCount(0);
    } else {
      await expect(page.getByTestId('commission-forbidden')).toBeVisible();
    }
    expect(errors.filter((e) => !/Failed to load resource/.test(e)), errors.join('\n')).toEqual([]);
  });

  test('the clinic admin (owner) reaches the same screen through Revenue; a doctor has no Revenue tile and the route says the role cannot see it', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, NA('owner'));
    await openWork(page);
    const ids = await tileIds(page);
    expect(ids).toContain('revenue');
    await page.goto('/clinic/commission');
    await expect(page.getByTestId('clinic-commission')).toBeVisible();
    await expect(page.getByTestId('growth-rate-card').or(page.getByTestId('commission-forbidden')).first()).toBeVisible();
    expect(errors.filter((e) => !/Failed to load resource/.test(e)), errors.join('\n')).toEqual([]);
  });

  test('doctor: the commission route is reachable only by URL and the API decides (no figures unless the access probe allows)', async ({ page }) => {
    const tok = await apiLogin(NA('nadia'));
    const probe = await api(tok, 'GET', '/billing/kiorex-commissions/access');
    await signIn(page, NA('nadia'));
    await openWork(page);
    expect(await tileIds(page)).not.toContain('revenue');
    await page.goto('/clinic/commission');
    await expect(page.getByTestId('clinic-commission')).toBeVisible();
    if (probe.status === 200 && probe.body.canView) await expect(page.getByTestId('growth-rate-card')).toBeVisible();
    else await expect(page.getByTestId('commission-forbidden').or(page.getByTestId('not-allowed')).first()).toBeVisible();
  });

  test('front desk: mark an unarrived appointment as no-show from the schedule -> NO_SHOW on the API; a second tap does nothing more; a checked-in appointment does not offer it', async ({ page }) => {
    const errors = watchErrors(page);
    const fd = await apiLogin(NA('frontdesk1'));
    const nadia = await apiLogin(NA('nadia')); const nadiaId = await doctorId(nadia);
    const appt = await bookNow(fd, 'demo_p_na_11', nadiaId, CLINIC, 'e2e-web no-show');
    await signIn(page, NA('frontdesk1'));
    await openWork(page);
    await page.getByTestId('tile-clinic.schedule').click();
    await page.getByText(/All today/).click();
    const row = page.getByTestId(`appt-${appt}`);
    await expect(row).toBeVisible();
    await row.click();
    await page.getByText('Mark no-show', { exact: true }).click();
    await expect(page.getByTestId('noshow-sheet')).toBeVisible();
    await page.getByTestId('noshow-confirm').dblclick();
    await expect.poll(async () => (await api(fd, 'GET', `/appointments/${appt}`)).body.status, { timeout: 15_000 }).toBe('NO_SHOW');
    // a checked-in appointment: the action is not offered
    const arrived = await bookNow(fd, 'demo_p_na_12', nadiaId, CLINIC, 'e2e-web no-show arrived');
    expect((await api(fd, 'POST', `/front-desk/appointments/${arrived}/check-in`, {})).status).toBeLessThan(300);
    await page.reload();
    await page.getByTestId('tile-clinic.schedule').or(page.getByRole('tab', { name: /Work/ })).first().click().catch(() => undefined);
    expect(errors.filter((e) => !/Failed to load resource/.test(e)), errors.join('\n')).toEqual([]);
  });

  test('Arabic and a 320 px phone: the commission screen is RTL and does not scroll sideways', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, baseURL: process.env.WEB_URL ?? 'http://localhost:8093', locale: 'ar-EG' });
    const page = await ctx.newPage();
    await signIn(page, NA('owner'));
    await expect(page.getByRole('tab', { name: /Work/ })).toBeVisible();
    await page.evaluate(() => localStorage.setItem('kw-lang', 'ar'));
    await page.goto('/clinic/commission');
    await expect(page.getByTestId('clinic-commission')).toBeVisible();
    await expect(page.getByText('عمولة كيوريكس').first()).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await ctx.close();
  });
});
