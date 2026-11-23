import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Kiorly staff app (Expo web) x the REAL Kiorex Passport dev IdP and the REAL product APIs: "Sign in with Kiorex Passport" for the Clinic,
 * Pharmacy and Lab entries with the linked demo staff. Passport OTP 000000 is typed into the real Passport pages in the sign-in popup.
 * Asserts: the Passport access token is the bearer each product API accepts (/mobile/bootstrap 200), the app lands in Work, and sign-out
 * ends the Passport session (the next "Sign in with Kiorex Passport" asks for the phone again).
 */
const IDP = process.env.PASSPORT_URL ?? 'http://localhost:4400';
const CASES = [
  { entry: 'clinic', phone: '+201000002001', api: ':3010', who: 'owner.na' },
  { entry: 'pharmacy', phone: '+201000002004', api: ':3100', who: 'pharmacist' },
  { entry: 'lab', phone: '+201000002005', api: ':3200', who: 'tech' },
] as const;

async function passportPopup(page: Page, context: BrowserContext, phone: string, expectPhoneAsked: boolean) {
  const popupP = context.waitForEvent('page', { timeout: 30_000 });
  await page.getByTestId('signin-passport').click();
  const popup = await popupP;
  if (expectPhoneAsked) {
    await popup.waitForURL(/\/interaction\//);
    await popup.locator('#phone').fill(phone);
    await popup.locator('form[action$="/phone"] button[type=submit]').click();
    await popup.locator('#code').fill('000000');
    await popup.locator('form[action$="/verify"] button[type=submit]').first().click();
    const skip = popup.locator('form[action$="/finish"] button');
    if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  }
  await popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
}

for (const c of CASES) {
  test(`${c.entry}: Sign in with Kiorex Passport -> bearer accepted by the ${c.entry} API -> bootstrap -> sign-out ends the Passport session`, async ({ page, context }) => {
    await fetch(`${IDP}/dev/reset-rate-limits`, { method: 'POST' }).catch(() => undefined);
    const boots: { url: string; status: number; bearer: boolean }[] = [];
    page.on('response', (r) => { if (r.url().includes('/mobile/bootstrap')) boots.push({ url: r.url(), status: r.status(), bearer: /^Bearer ey/.test(r.request().headers().authorization ?? '') }); });
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await page.getByTestId(`product-${c.entry}`).click();
    await passportPopup(page, context, c.phone, true);
    await expect(page.getByRole('tab', { name: /Work/ })).toBeVisible({ timeout: 30_000 });
    const boot = boots.find((b) => b.url.includes(c.api));
    expect(boot, JSON.stringify(boots)).toBeTruthy();
    expect(boot!.status).toBe(200); expect(boot!.bearer).toBe(true);
    expect(page.url()).not.toContain('code=');
    expect(await page.evaluate(() => Object.keys(sessionStorage).some((k) => k.startsWith('kw-session')))).toBe(true);

    await page.getByRole('tab', { name: /Me/ }).click();
    await page.getByTestId('signout-all').click();
    await page.getByTestId('signout-confirm-btn').click();
    await expect(page.getByTestId('signin-passport')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('kw-session')))).toEqual([]);

    // the Passport session is gone: signing in again goes to the phone step instead of silently succeeding
    await page.getByTestId(`product-${c.entry}`).click();
    // the sign-out popup (RP-initiated logout, loads the whole app) closes itself a moment after the sign-in screen is back; a person needs longer than this to click
    await expect.poll(() => context.pages().length, { timeout: 30_000 }).toBe(1);
    const popupP = context.waitForEvent('page', { timeout: 30_000 });
    await page.getByTestId('signin-passport').click();
    const popup = await popupP;
    await popup.waitForURL(/\/interaction\//);
    await expect(popup.locator('#phone')).toBeVisible();
    await popup.close();
  });
}
