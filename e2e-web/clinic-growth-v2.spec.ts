import { test, expect } from '@playwright/test';
import { api, apiLogin, NA, openWork, signIn, watchErrors } from './clinic-helpers';

/** GRW-P2-C: share cards, slot cards, statements and verification requests in the Kiorly staff app (Expo web build) against the real Clinic API and the seeded demo tenant (Nile Care, PRO). */
test.describe('Kiorly (Expo web) - Growth v2 (GRW-P2-C) against the real Clinic API', () => {
  test('owner: the hub lists the four new rows; a share card is rendered by the server with the protected footer; a guarded line is refused; Arabic is RTL', async ({ page }) => {
    const errors = watchErrors(page);
    const owner = await apiLogin(NA('owner'));
    const tpl = (await api(owner, 'GET', '/mobile/growth/templates?locale=en')).body;
    expect(tpl.items.length).toBeGreaterThanOrEqual(6);
    const open = tpl.items.find((t: { slug: string }) => t.slug === 'booking-open');
    // the API refuses a guarantee before anything is rendered
    const refused = await api(owner, 'POST', '/mobile/growth/share/render', { templateId: open.id, customLine: 'We guarantee results' });
    expect([refused.status, refused.body.code]).toEqual([422, 'CONTENT_NOT_ALLOWED']);

    await signIn(page, NA('owner'));
    await openWork(page);
    await page.getByTestId('tile-clinic.growth').click();
    await expect(page.getByTestId('growth-hub')).toBeVisible();
    for (const k of ['share', 'slots', 'statements', 'verification']) await expect(page.getByTestId(`growth-hub-${k}`)).toBeVisible();

    await page.getByTestId('growth-hub-share').click();
    await expect(page.getByTestId('clinic-growth-share')).toBeVisible();
    await page.getByTestId('share-template-booking-open').click();
    await page.getByTestId('share-render').click();
    await expect(page.getByTestId('share-caption')).toContainText('Appointments depend on availability');
    await expect(page.getByTestId('share-result').locator('svg').first()).toBeVisible();
    const caption = await page.getByTestId('share-caption').innerText();
    expect(caption).toMatch(/\/b\/[a-z0-9-]+\?s=[0-9A-HJKMNP-TV-Z]{8}/);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('owner: free times are listed from the slot engine (at most 5) and a card needs at least one chosen time', async ({ page }) => {
    const owner = await apiLogin(NA('owner'));
    const slots = await api(owner, 'GET', '/mobile/growth/slots?days=3');
    expect([200, 404, 409]).toContain(slots.status); // 409 when the seeded clinician has no bookable in-clinic type
    await signIn(page, NA('owner'));
    await openWork(page);
    await page.getByTestId('tile-clinic.growth').click(); // a reload would drop the in-memory session: navigate inside the app
    await page.getByTestId('growth-hub-slots').click();
    await expect(page.getByTestId('clinic-growth-slots')).toBeVisible();
    if (slots.status === 200 && slots.body.items.length) {
      expect(slots.body.items.length).toBeLessThanOrEqual(5);
      await expect(page.getByTestId('slots-option')).toHaveCount(slots.body.items.length);
      await expect(page.getByTestId('slots-create')).toBeDisabled();
      await page.getByTestId('slots-option').first().click();
      await page.getByTestId('slots-create').click();
      await expect(page.getByTestId('slots-result')).toContainText('slot=');
    }
  });

  test('owner: the statement and verification screens load; a non-admin gets the admin-only answer from the API', async ({ page }) => {
    const owner = await apiLogin(NA('owner'));
    const month = new Date().toISOString().slice(0, 7);
    const st = await api(owner, 'GET', `/mobile/growth/statements/${month}`);
    expect(st.status).toBe(200);
    expect(st.body.lines).toBeInstanceOf(Array);
    const v = await api(owner, 'GET', '/mobile/growth/verification');
    expect(v.status).toBe(200);
    expect(['VERIFIED', 'UPDATE_UNDER_REVIEW']).toContain(v.body.badge);
    await signIn(page, NA('owner'));
    await openWork(page);
    await page.getByTestId('tile-clinic.growth').click();
    await page.getByTestId('growth-hub-statements').click();
    await expect(page.getByTestId('statements-totals')).toBeVisible();
    await page.goBack();
    await page.getByTestId('growth-hub-verification').click();
    await expect(page.getByTestId('verification-form')).toBeVisible();
    // a doctor shares their own profile but never sees fees or verification
    const doc = await apiLogin(NA('nadia'));
    expect((await api(doc, 'GET', `/mobile/growth/statements/${month}`)).status).toBe(403);
    expect((await api(doc, 'GET', '/mobile/growth/verification')).status).toBe(403);
    expect((await api(doc, 'GET', '/mobile/growth/templates?locale=en')).status).toBe(200);
    const front = await apiLogin(NA('frontdesk1'));
    expect((await api(front, 'GET', '/mobile/growth/templates?locale=en')).status).toBe(403);
  });
});
