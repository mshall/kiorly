import { test, expect } from '@playwright/test';
import { api, apiLogin, signIn, openWork } from './pharmacy-helpers';

/** GRW-P4-B3: Pharmacy Growth tab in the Kiorly staff app (Expo web) against the real Pharmacy API and the seeded demo tenant (owner: ENTERPRISE, connected). */
/** Page errors and any failing /mobile/growth call (other home-screen calls are outside this tab). */
const watch = (page: import('@playwright/test').Page) => { const bad: string[] = []; page.on('pageerror', (e) => bad.push(`pageerror: ${e.message.slice(0, 200)}`)); page.on('response', (r) => { if (r.url().includes('/mobile/growth') && r.status() >= 400) bad.push(`HTTP ${r.status()} ${r.url()}`); }); return bad; };

test.describe('Kiorly (Expo web) - Pharmacy Growth tab (GRW-P4-B3)', () => {
  test('owner: tab opens, profile link, QR rendered from the server JSON, create a link, pause it', async ({ page }) => {
    const bad = watch(page);
    const owner = await apiLogin('owner');
    const boot = (await api(owner, 'GET', '/mobile/bootstrap')).body.modules.find((m: { key: string }) => m.key === 'pharmacy.growth');
    expect(boot).toMatchObject({ enabled: true, screens: ['growth.links', 'growth.create'] });
    await signIn(page, 'owner');
    await expect(page.getByRole('tab', { name: /work/i })).toBeVisible();
    await openWork(page);
    await page.getByTestId('tile-pharmacy.growth').click();
    await expect(page.getByTestId('pharmacy-growth')).toBeVisible();
    await expect(page.getByTestId('growth-profile-url')).toBeVisible();
    const label = `Smoke ${Date.now().toString(36)}`;
    await page.getByTestId('growth-new-link').click();
    await page.getByTestId('growth-create-label').fill(label);
    await page.getByTestId('growth-channel-WHATSAPP_SHARE').click();
    await page.getByTestId('growth-create-save').click();
    await expect(page.getByText(label)).toBeVisible();
    await expect(page.getByTestId('growth-qr').locator('svg').first()).toBeVisible();
    await page.getByText(label).click();
    await page.getByText('Pause link').click();
    await expect(page.getByText('Paused').first()).toBeVisible();
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('cashier: read-only (no create button), and the API refuses a create with GROWTH_FORBIDDEN', async ({ page }) => {
    const cashier = await apiLogin('cashier');
    expect((await api(cashier, 'POST', '/mobile/growth/links', { label: 'Nope nope', ownerScope: 'ORG' })).body.code).toBe('GROWTH_FORBIDDEN');
    await signIn(page, 'cashier');
    await expect(page.getByRole('tab', { name: /work/i })).toBeVisible();
    await openWork(page);
    await page.getByTestId('tile-pharmacy.growth').click();
    await expect(page.getByTestId('growth-read-only')).toBeVisible();
    await expect(page.getByTestId('growth-new-link')).toHaveCount(0);
  });
});
