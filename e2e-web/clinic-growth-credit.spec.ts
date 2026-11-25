import { test, expect } from '@playwright/test';
import { api, apiLogin, NA, openWork, signIn, sql, watchErrors } from './clinic-helpers';

/** GRW-P2-W / P2-S: the Kiorex credit card and the sponsored promotions card in the Clinic Growth module (Expo web) against the real Clinic API and the seeded demo tenant (Nile Care). */
test.describe('Kiorly (Expo web) - Growth credit and promotion cards against the real Clinic API', () => {
  test('owner sees the credit balance and what it can pay for, lists a promotion and pauses and resumes it; the bearer hits the real endpoints', async ({ page }) => {
    const errors = watchErrors(page);
    const owner = await apiLogin(NA('owner'));
    const wallet = await api(owner, 'GET', '/credits/wallet?pageSize=1');
    expect(wallet.status, JSON.stringify(wallet.body)).toBe(200);
    // one ACTIVE promotion for the demo tenant (created through the API, activated by the test database only: the two Kiorex review decisions are not part of this smoke)
    const types = (await api(owner, 'GET', '/appointment-types')).body;
    const list = await api(owner, 'GET', '/promotions');
    let id: string | undefined = (list.body as { id: string; version: { nameEn: string } }[]).find((p) => p.version.nameEn === 'Smoke offer')?.id;
    if (!id) {
      const created = await api(owner, 'POST', '/promotions', {
        nameAr: 'عرض تجريبي', nameEn: 'Smoke offer', patientCopyAr: 'خصم على سعر الكشف برعاية العيادة', patientCopyEn: 'A discount on the visit fee, sponsored by the clinic',
        scope: { appointmentTypeIds: Array.isArray(types) && types[0] ? [types[0].id] : [], careTypes: ['IN_CLINIC'] }, discount: { kind: 'FIXED_MINOR', value: 10000 }, budgetCapMinor: 70000, perPatientLimit: 1,
        eligibility: { newPatientsOnly: false, firstBookingOnly: false, minLeadHours: 0, kiorexOnly: true }, startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() + 30 * 86400_000).toISOString(), fundingMode: 'WALLET_ONLY',
      });
      expect([200, 201], JSON.stringify(created.body)).toContain(created.status);
      id = created.body.id as string;
    }
    sql(`UPDATE "SponsoredPromotion" SET status='ACTIVE', "pausedAt"=NULL WHERE id='${id}';`);

    await signIn(page, NA('owner'));
    await openWork(page);
    await page.getByTestId('tile-clinic.growth').click();
    const credit = page.getByTestId('growth-credit');
    await expect(credit).toBeVisible();
    await expect(credit).toContainText('Kiorex credit');
    await expect(credit).toContainText('Kiorex fees');
    await expect(credit).toContainText('not cash');
    const promo = page.getByTestId(`growth-promo-${id}`);
    await expect(promo).toBeVisible();
    await expect(promo).toContainText('Smoke offer');
    await expect(promo).toContainText('Active');
    await page.getByTestId(`growth-promo-pause-${id}`).click();
    await expect(page.getByTestId(`growth-promo-resume-${id}`)).toBeVisible();
    await expect(promo).toContainText('Paused');
    await page.getByTestId(`growth-promo-resume-${id}`).click();
    await expect(page.getByTestId(`growth-promo-pause-${id}`)).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('a clinician without owner or finance access sees the Growth tab without the two cards and without an error', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, NA('nadia'));
    await openWork(page);
    const tile = page.getByTestId('tile-clinic.growth');
    if (await tile.count()) {
      await tile.click();
      await expect(page.getByTestId('clinic-growth')).toBeVisible();
      await expect(page.getByTestId('growth-credit')).toHaveCount(0);
      await expect(page.getByTestId('growth-promos')).toHaveCount(0);
    }
    expect(errors.filter((e) => !/403|404/.test(e)), errors.join('\n')).toEqual([]);
  });
});
