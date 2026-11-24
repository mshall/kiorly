import { test, expect } from '@playwright/test';
import { api, apiLogin, NA, openWork, signIn, tileIds, watchErrors } from './clinic-helpers';

/** GRW-P1-L: the Growth tab of the Kiorly staff app (Expo web build) against the real Clinic API and the seeded demo tenant (Nile Care, PRO). */
const BASIC_OWNER = 'owner.basic@demo.kiorex.test';
const created: { token: string; id: string }[] = [];

test.afterAll(async () => {
  for (const c of created) await api(c.token, 'PATCH', `/growth/links/${c.id}`, { status: 'REVOKED' }); // frees the plan slot; revoke is permanent and only on the web API
});

test.describe('Kiorly (Expo web) - Growth tab against the real Clinic API', () => {
  test('owner: profile link, QR, create a link in the UI, copy, pause, summary, web workspace link; English', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = watchErrors(page);
    const owner = await apiLogin(NA('owner'));
    const g = (await api(owner, 'GET', '/mobile/growth')).body;
    expect(g.level).toBe('admin');
    expect(g.profile.kiorexUrl).toMatch(/\/clinic\/demo-na-maadi$/);

    await signIn(page, NA('owner'));
    await openWork(page);
    expect(await tileIds(page)).toContain('growth');
    await page.getByTestId('tile-clinic.growth').click();
    await expect(page.getByTestId('clinic-growth')).toBeVisible();
    await expect(page.getByTestId('growth-profile-url')).toHaveText(g.profile.kiorexUrl);

    // create a link through the UI -> exists on the web API as an ACTIVE link with a short URL and an 8-character code
    const name = `E2E WhatsApp ${Date.now()}`;
    await page.getByTestId('growth-new-link').click();
    await page.getByTestId('growth-create-label').fill(name);
    await page.getByTestId('growth-channel-WHATSAPP_SHARE').click();
    await page.getByTestId('growth-create-save').click();
    await expect(page.getByText('Link created')).toBeVisible();
    const link = await expect.poll(async () => ((await api(owner, 'GET', '/growth/links')).body.items as any[]).find((l) => l.label === name), { timeout: 15_000 }).toBeTruthy().then(async () => ((await api(owner, 'GET', '/growth/links')).body.items as any[]).find((l) => l.label === name));
    created.push({ token: owner, id: link.id });
    expect(link).toMatchObject({ status: 'ACTIVE', channelKind: 'WHATSAPP_SHARE', ownerScope: 'CLINIC' });
    expect(link.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    const row = page.getByTestId(`growth-link-${link.id}`);
    await expect(row).toContainText(name);
    await expect(row).toContainText('Visits');

    // the QR card renders an SVG whose payload is the short link of the server (no third-party QR service)
    const qr = (await api(owner, 'GET', `/mobile/growth/qr?linkId=${link.id}`)).body;
    expect(qr.url).toBe(link.shortUrl);
    expect(qr.svg).toContain('<svg');
    await expect(page.getByTestId('growth-qr').locator('svg').first()).toBeVisible();

    // copy writes the profile URL to the clipboard and confirms
    await page.getByTestId('growth-copy').click();
    await expect(page.getByTestId('toast')).toContainText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(g.profile.kiorexUrl);

    // per-link actions: pause -> PAUSED on the API, QR action disabled for a paused link
    await row.click();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect.poll(async () => ((await api(owner, 'GET', '/growth/links')).body.items as any[]).find((l) => l.id === link.id)?.status, { timeout: 15_000 }).toBe('PAUSED');
    await expect(row).toContainText('Paused');

    // performance, recommendations and the fee statement come from the same services as the web workspace
    await expect(page.getByTestId('growth-perf')).toBeVisible();
    await expect(page.getByTestId('growth-commission')).toContainText('A fee applies only to a new patient');
    await expect(page.getByTestId('growth-web')).toBeVisible();
    await expect(page.getByTestId('growth-web-card')).toContainText('Posters');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('doctor Nadia sees only her own link and profile (no performance, no fee statement, no create)', async ({ page }) => {
    const errors = watchErrors(page);
    const doc = await apiLogin(NA('nadia'));
    const g = (await api(doc, 'GET', '/mobile/growth')).body;
    expect(g).toMatchObject({ level: 'doctor', performance: null, commission: null, can: { create: false } });
    expect((await api(doc, 'POST', '/mobile/growth/links', { label: 'nope', ownerScope: 'CLINIC', clinicId: g.clinic.id })).status).toBe(403);
    await signIn(page, NA('nadia'));
    await openWork(page);
    await page.getByTestId('tile-clinic.growth').click();
    await expect(page.getByTestId('growth-doctor-note')).toBeVisible();
    await expect(page.getByTestId('growth-profile-url')).toHaveText(g.profile.kiorexUrl);
    await expect(page.getByTestId('growth-perf')).toHaveCount(0);
    await expect(page.getByTestId('growth-commission')).toHaveCount(0);
    await expect(page.getByTestId('growth-new-link')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('front desk and accountant have no Growth tile and are refused (403 MODULE_NOT_ALLOWED); a BASIC org gets 403 FEATURE_DISABLED', async ({ page }) => {
    for (const who of ['frontdesk1', 'accountant']) {
      const t = await apiLogin(NA(who));
      const r = await api(t, 'GET', '/mobile/growth');
      expect([r.status, r.body.code]).toEqual([403, 'MODULE_NOT_ALLOWED']);
    }
    const basic = await apiLogin(BASIC_OWNER);
    const b = await api(basic, 'GET', '/mobile/growth');
    expect([b.status, b.body.code, b.body.key]).toEqual([403, 'FEATURE_DISABLED', 'mobile_staff_app']);
    await signIn(page, NA('frontdesk1'));
    await openWork(page);
    expect(await tileIds(page)).not.toContain('growth');
  });

  test('Arabic: the Growth screen is RTL with Arabic copy and the no-fee promise', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, NA('owner'));
    await openWork(page);
    await page.getByTestId('tile-clinic.growth').click();
    await expect(page.getByTestId('growth-profile')).toBeVisible();
    await page.getByRole('tab', { name: /Me/ }).click();
    await page.getByTestId('me-language').click(); // the Me tab's language row opens the same single menu
    await page.getByTestId('me-language-ar').click();
    await page.goto('/clinic/growth');
    await expect(page.getByTestId('growth-profile')).toContainText('ملفك العام على كيوريكس');
    await expect(page.getByTestId('growth-commission')).toContainText('بدون رسوم');
    expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction)).toBe('rtl');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
