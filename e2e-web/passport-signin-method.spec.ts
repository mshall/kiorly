import { test, expect, type Page } from '@playwright/test';

/**
 * Founder decisions, 24 Nov 2026 (Expo web build, no backend needed):
 *  - the sign-in screen offers exactly two methods: Kiorex Passport (default, first) and Password, on the same screen; the last method that
 *    signed this device in is preselected next time;
 *  - LIGHT is the default theme (a dark OS does not change it); an explicit Dark / System choice is stored (`kx-theme`) and restored on reload.
 */
const METHOD_KEY = 'kiorly.signin.method'; const THEME_KEY = 'kx-theme';
const openSignIn = async (page: Page) => { await page.goto('/sign-in'); await expect(page.getByTestId('signin-method')).toBeVisible({ timeout: 30_000 }); await page.getByTestId('language-menu').click(); await page.getByTestId('language-menu-en').click(); /* one language control: open the menu, pick English */ };
/** Colour of the first opaque ancestor behind the sign-in card (the screen background). */
const groundColour = (page: Page) => page.evaluate(() => {
  let el: Element | null = document.elementFromPoint(8, window.innerHeight - 8);
  while (el) { const c = getComputedStyle(el).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; el = el.parentElement; }
  return 'none';
});
const LIGHT_GROUND = 'rgb(244, 246, 252)'; // _brand Ground #F4F6FC
const DARK_GROUND = 'rgb(12, 13, 31)'; // _brand dark bg #0C0D1F

test.describe('sign-in: Kiorex Passport default, Password toggle, last-method memory', () => {
  test('two options only, Passport first and selected; Password is behind the toggle on the same screen', async ({ page }) => {
    await openSignIn(page);
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab').first()).toHaveAttribute('data-testid', 'signin-method-passport');
    await expect(page.getByTestId('signin-method-passport')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('signin-passport')).toBeVisible();
    await expect(page.getByText('Sign in with Kiorex Passport')).toBeVisible();
    await expect(page.getByTestId('signin-email')).toHaveCount(0);
    await page.getByTestId('signin-method-password').click();
    await expect(page.getByTestId('signin-email')).toBeVisible();
    await expect(page.getByTestId('signin-passport')).toHaveCount(0);
    expect(page.url()).toContain('/sign-in'); // same screen
  });

  test('the last method used is preselected after a reload; garbage falls back to Passport', async ({ page }) => {
    await openSignIn(page);
    await page.evaluate((k) => localStorage.setItem(k, 'password'), METHOD_KEY);
    await page.reload(); await expect(page.getByTestId('signin-method')).toBeVisible();
    await expect(page.getByTestId('signin-method-password')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('signin-email')).toBeVisible();
    await page.evaluate((k) => localStorage.setItem(k, 'telepathy'), METHOD_KEY);
    await page.reload(); await expect(page.getByTestId('signin-method')).toBeVisible();
    await expect(page.getByTestId('signin-method-passport')).toHaveAttribute('aria-selected', 'true');
  });

  test('no test-user chips or demo hints are rendered, and typed credentials fill the password form', async ({ page }) => {
    await openSignIn(page);
    await expect(page.locator('[data-testid^="demo-"]')).toHaveCount(0);
    await expect(page.getByText(/Test users|demo/i)).toHaveCount(0);
    await page.getByTestId('signin-method-password').click();
    await page.getByTestId('signin-email').fill('someone@example.com');
    await page.getByTestId('signin-password').fill('typed-by-hand');
    await expect(page.getByTestId('signin-email')).toHaveValue('someone@example.com');
  });
});

test.describe('theme: light by default, an explicit choice is persisted', () => {
  test.use({ colorScheme: 'dark' }); // a dark OS must NOT turn the app dark
  test('light on a first visit even on a dark OS; a stored Dark choice is restored after a reload', async ({ page }) => {
    await openSignIn(page);
    // the ground is now a light brand gradient over a white root: assert it is LIGHT (every channel >= 240), not the single flat Ground token
    expect((await groundColour(page)).match(/\d+/g)!.slice(0, 3).map(Number).every((n) => n >= 240), `light ground, got ${await groundColour(page)} (brand Ground ${LIGHT_GROUND})`).toBe(true);
    expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBeNull(); // nothing stored for a plain visit
    await page.evaluate((k) => localStorage.setItem(k, 'dark'), THEME_KEY);
    await page.reload(); await expect(page.getByTestId('signin-method')).toBeVisible();
    await expect.poll(() => groundColour(page)).toBe(DARK_GROUND);
    await page.evaluate((k) => localStorage.setItem(k, 'light'), THEME_KEY);
    await page.reload(); await expect(page.getByTestId('signin-method')).toBeVisible();
    await expect.poll(() => groundColour(page)).toBe(LIGHT_GROUND);
  });
});
