import { test, expect, type Page } from '@playwright/test';

/**
 * Founder decisions, 24 Nov 2026 (Expo web build, no backend needed):
 *  - the sign-in screen offers exactly two methods: Kiorex Passport (default, first) and Password, on the same screen; the last method that
 *    signed this device in is preselected next time;
 *  - LIGHT is the default theme (a dark OS does not change it); an explicit Dark / System choice is stored (`kx-theme`) and restored on reload.
 */
const METHOD_KEY = 'kiorly.signin.method'; const THEME_KEY = 'kx-theme';
const openSignIn = async (page: Page) => { await page.goto('/sign-in'); await expect(page.getByTestId('signin-method')).toBeVisible({ timeout: 30_000 }); await page.getByTestId('language-menu').click(); await page.getByTestId('language-menu-en').click(); // one language control: open the menu, pick English };
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

  test('a dev test-user chip switches to the password form (it fills the credentials)', async ({ page }) => {
    await openSignIn(page);
    const chip = page.locator('[data-testid^="demo-"]').first();
    test.skip(!(await chip.isVisible().catch(() => false)), 'dev test users are not in this build');
    await chip.click();
    await expect(page.getByTestId('signin-method-password')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('signin-email')).not.toHaveValue('');
  });
});

test.describe('theme: light by default, an explicit choice is persisted', () => {
  test.use({ colorScheme: 'dark' }); // a dark OS must NOT turn the app dark
  test('light on a first visit even on a dark OS; a stored Dark choice is restored after a reload', async ({ page }) => {
    await openSignIn(page);
    expect(await groundColour(page)).toBe(LIGHT_GROUND);
    expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBeNull(); // nothing stored for a plain visit
    await page.evaluate((k) => localStorage.setItem(k, 'dark'), THEME_KEY);
    await page.reload(); await expect(page.getByTestId('signin-method')).toBeVisible();
    await expect.poll(() => groundColour(page)).toBe(DARK_GROUND);
    await page.evaluate((k) => localStorage.setItem(k, 'light'), THEME_KEY);
    await page.reload(); await expect(page.getByTestId('signin-method')).toBeVisible();
    await expect.poll(() => groundColour(page)).toBe(LIGHT_GROUND);
  });
});
