import { expect, type Page, type ConsoleMessage } from '@playwright/test';

export const API = process.env.PHARMACY_API ?? 'http://localhost:3100/api/v1';
export const PASSWORD = 'Demo@12345';

export async function apiLogin(user: string): Promise<string> {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${user}@demo.kiorly.local`, password: PASSWORD }) });
  if (!r.ok) throw new Error(`login ${user}: ${r.status}`);
  return ((await r.json()) as { accessToken: string }).accessToken;
}
export async function api(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-kiorly-client': 'kiorly/e2e-web' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
}

/** Console messages that are not a defect: web-only Expo library notices and dev-server chatter. */
const BENIGN = [/expo-notifications/i, /not yet fully supported on web/i, /Download the React DevTools/i, /\[HMR\]/i, /shadow\*|pointerEvents is deprecated|props\.pointerEvents|useNativeDriver/i, /favicon/i,
  /status of 402 \(Payment Required\)/i];   // expected: the app tries to complete a sign-off; a counter sale is paid at the till (PAYMENT_REQUIRED is handled, see rx/[id].tsx)
export function trackConsole(page: Page) {
  const bad: string[] = [];
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error' && !BENIGN.some((r) => r.test(m.text()))) bad.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => { bad.push(`pageerror: ${e.message.slice(0, 300)}`); });
  page.on('response', (r) => { const u = r.url(); if (u.includes('localhost:3100') && r.status() >= 500) bad.push(`HTTP ${r.status()} ${u}`); });
  return bad;
}

/** Sign in through the real sign-in screen (Pharmacy product, product login). English UI. */
export async function signIn(page: Page, user: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByTestId('product-pharmacy').click();
  await page.getByTestId('signin-method-password').click(); // Kiorex Passport is the default method, the password form is behind the toggle
  await page.getByTestId('signin-email').fill(`${user}@demo.kiorly.local`);
  await page.getByTestId('signin-password').fill(PASSWORD);
  await page.getByTestId('signin-submit').click();
}
export async function openWork(page: Page) {
  const tab = page.getByRole('tab', { name: /work/i });
  if (await tab.isVisible().catch(() => false)) await tab.click(); else await page.goto('/work');   // (tab bar now persists on detail screens)
  await expect(page.getByTestId('work')).toBeVisible();
}
