import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://localhost:3010/api/v1';
export const PW = 'Demo@12345';
const APP = { 'x-kiorly-client': 'kiorly/1.0-e2e-web' };

export async function api(token: string | undefined, method: string, path: string, body?: unknown) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...APP, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
}
export async function apiLogin(email: string) {
  const r = await api(undefined, 'POST', '/auth/login', { email, password: PW });
  expect(r.status, `API login ${email}`).toBe(200);
  return r.body.accessToken as string;
}

/** Dev-DB reset for demo rows the flows consume (alerts, result review). Best effort: skipped when psql is not available. */
export function sql(statement: string) {
  try { execFileSync(process.env.PSQL ?? '/Users/postgres/bin/psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'kiorly', '-c', statement], { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'pipe' }); return true; } catch { return false; }
}

/** Collects console errors / uncaught page errors so each test can assert there were none. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  return errors;
}

/** Sign in through the real sign-in screen (English), clinic product. */
export async function signIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByTestId('signin-email').fill(email);
  await page.getByTestId('signin-password').fill(PW);
  await page.getByTestId('signin-submit').click();
}
export async function openWork(page: Page) { await page.getByRole('tab', { name: /Work/ }).click(); await expect(page.getByTestId('work')).toBeVisible(); }
export const tileIds = async (page: Page) => (await page.locator('[data-testid^="tile-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tile-clinic.', '')))).sort();

export async function bookNow(token: string, patientId: string, clinicianId: string, clinicId: string, notes = 'e2e-web') {
  const r = await api(token, 'POST', '/appointments', { clinicId, patientId, clinicianId, startsAt: new Date().toISOString(), notes, allowDoubleBook: true, confirmOverlap: true });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.id as string;
}
export const NA = (u: string) => `${u}.na@demo.kiorex.test`;
export const CLINIC = 'demo_c_na_maadi';
