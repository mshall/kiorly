import { test, expect } from '@playwright/test';
import { api, login, signIn, openWork } from './lab-helpers';

/** GRW-P4-B3: Lab Growth tab in the Kiorly staff app (Expo web) against the real Lab API and the seeded demo-lab tenant. */
/** Page errors and any failing /mobile/growth call (other home-screen calls are outside this tab). */
const watch = (page: import('@playwright/test').Page) => { const bad: string[] = []; page.on('pageerror', (e) => bad.push(`pageerror: ${e.message.slice(0, 200)}`)); page.on('response', (r) => { if (r.url().includes('/mobile/growth') && r.status() >= 400) bad.push(`HTTP ${r.status()} ${r.url()}`); }); return bad; };

test.describe('Kiorly (Expo web) - Lab Growth tab (GRW-P4-B3)', () => {
  test('owner: tab opens, profile link, create a link, QR from the server JSON, pause', async ({ page }) => {
    const bad = watch(page);
    const owner = await login('demo-lab', 'owner');
    const mod = ((await api(owner, 'GET', '/mobile/bootstrap', undefined, { app: true })).body.modules as { key: string; enabled: boolean }[]).find((m) => m.key === 'lab.growth');
    expect(mod?.enabled).toBe(true);
    await signIn(page, 'demo-lab', 'owner');
    await openWork(page);
    await page.getByTestId('tile-lab.growth').click();
    await expect(page.getByTestId('lab-growth')).toBeVisible();
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

  test('phlebotomist: no Growth module, no tile, and the API answers GROWTH_FORBIDDEN', async ({ page }) => {
    const phleb = await login('demo-lab', 'phleb');
    expect((await api(phleb, 'GET', '/mobile/growth', undefined, { app: true })).body.code).toBe('GROWTH_FORBIDDEN');
    await signIn(page, 'demo-lab', 'phleb');
    await openWork(page);
    await expect(page.getByTestId('tile-lab.growth')).toHaveCount(0);
  });
});
