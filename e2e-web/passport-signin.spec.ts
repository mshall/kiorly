import { createHash } from 'node:crypto';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Kiorly staff app x Kiorex Passport (OIDC authorization code + PKCE) on the Expo web build, against a mock Passport and a mock clinic API.
 * The mock provider enforces what the real one does: registered redirect URIs, S256 challenge vs verifier, one-time code, nonce echoed in the id_token.
 */
const ISSUER = 'http://localhost:4400'; const API = 'http://localhost:3010/api/v1';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const BOOT = (email: string) => ({
  apiVersion: 1, product: 'clinic', serverTime: new Date().toISOString(), user: { id: 'u1', name: 'Dr Nadia', email, role: 'DOCTOR', roles: ['DOCTOR'] }, org: { id: 'o1', name: 'Nile Care', plan: 'PRO', edition: 'CLINIC' },
  entitlement: { key: 'mobile_staff_app', enabled: true, requiredPlan: 'PRO', reason: null }, safetyAlertsOnly: false,
  modules: [{ key: 'schedule', enabled: true, screens: [] }], permissions: [], device: { id: 'dev-1', status: 'ACTIVE' },
});

interface Mock {
  authorize: URL[]; tokenForms: Record<string, string>[]; apiCalls: { method: string; path: string; auth?: string; client?: string }[]; endSession: URL[]; revoked: string[];
  issued: { access: string; id: string; refresh: string }[]; refreshForms: Record<string, string>[]; linked: boolean; sub: string;
}

async function mockStack(ctx: BrowserContext, webOrigin: string, opts: { linked?: boolean } = {}): Promise<Mock> {
  const m: Mock = { authorize: [], tokenForms: [], apiCalls: [], endSession: [], revoked: [], issued: [], refreshForms: [], linked: opts.linked ?? true, sub: 'sub-nadia' };
  const codes = new Map<string, { challenge: string; nonce: string; redirect: string }>();
  let n = 0;
  const mint = (nonce: string) => {
    n += 1; const exp = Math.floor(Date.now() / 1000) + 900;
    const access = `${b64({ alg: 'RS256' })}.${b64({ iss: ISSUER, sub: m.sub, aud: 'kiorex-api', client_id: 'kiorly', exp })}.sig${n}`;
    const id = `${b64({ alg: 'RS256' })}.${b64({ iss: ISSUER, sub: m.sub, aud: 'kiorly', nonce, name: 'Dr Nadia', exp })}.id${n}`;
    const t = { access, id, refresh: `refresh-${n}` }; m.issued.push(t); return t;
  };
  await ctx.route(`${ISSUER}/**`, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === '/.well-known/openid-configuration') return route.fulfill({ headers: CORS, json: { issuer: ISSUER, authorization_endpoint: `${ISSUER}/auth`, token_endpoint: `${ISSUER}/token`, end_session_endpoint: `${ISSUER}/session/end`, revocation_endpoint: `${ISSUER}/token/revocation`, jwks_uri: `${ISSUER}/jwks` } });
    if (u.pathname === '/auth') { // "the user signed in with the phone OTP": 302 back to the registered redirect with a one-time code
      m.authorize.push(u); const q = u.searchParams;
      const registered = ['kiorly://auth/callback', 'exp+kiorly://auth/callback', `${webOrigin}/auth/callback`];
      if (q.get('client_id') !== 'kiorly' || !registered.includes(q.get('redirect_uri') ?? '') || q.get('code_challenge_method') !== 'S256') return route.fulfill({ status: 400, body: 'invalid_request' });
      const code = `code-${codes.size + 1}`; codes.set(code, { challenge: q.get('code_challenge')!, nonce: q.get('nonce')!, redirect: q.get('redirect_uri')! });
      return route.fulfill({ status: 302, headers: { location: `${q.get('redirect_uri')}?code=${code}&state=${encodeURIComponent(q.get('state')!)}&iss=${encodeURIComponent(ISSUER)}` } });
    }
    if (u.pathname === '/token') {
      const f = Object.fromEntries(new URLSearchParams(req.postData() ?? ''));
      if (f.grant_type === 'authorization_code') {
        m.tokenForms.push(f); const c = codes.get(f.code); codes.delete(f.code); // single use
        const ok = c && f.client_id === 'kiorly' && f.redirect_uri === c.redirect && createHash('sha256').update(f.code_verifier ?? '').digest('base64url') === c.challenge;
        if (!ok) return route.fulfill({ status: 400, headers: CORS, json: { error: 'invalid_grant', error_description: 'grant request is invalid' } });
        const t = mint(c.nonce); return route.fulfill({ headers: CORS, json: { access_token: t.access, id_token: t.id, refresh_token: t.refresh, token_type: 'Bearer', expires_in: 900, scope: 'openid profile phone kx kx_org offline_access' } });
      }
      if (f.grant_type === 'refresh_token') { m.refreshForms.push(f); const t = mint('refresh'); return route.fulfill({ headers: CORS, json: { access_token: t.access, refresh_token: t.refresh, id_token: t.id, token_type: 'Bearer', expires_in: 900 } }); }
    }
    if (u.pathname === '/token/revocation') { m.revoked.push(Object.fromEntries(new URLSearchParams(req.postData() ?? '')).token ?? ''); return route.fulfill({ headers: CORS, status: 200, body: '' }); }
    if (u.pathname === '/session/end') { // RP-initiated logout: with a valid id_token_hint Passport ends the session without asking and 302s to the registered post-logout URI
      m.endSession.push(u);
      const back = u.searchParams.get('post_logout_redirect_uri'); const st = u.searchParams.get('state');
      return route.fulfill({ status: 302, headers: { location: back ? `${back}${back.includes('?') ? '&' : '?'}state=${st}` : `${webOrigin}/` } });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await ctx.route(`${API}/**`, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const path = u.pathname.replace('/api/v1', '');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const h = req.headers(); m.apiCalls.push({ method: req.method(), path, auth: h.authorization, client: h['x-kiorly-client'] });
    if (!m.linked) return route.fulfill({ status: 403, headers: CORS, json: { statusCode: 403, code: 'PASSPORT_NOT_LINKED', message: 'This Kiorex Passport is not linked to a staff account.' } });
    if (path === '/mobile/bootstrap') return route.fulfill({ headers: CORS, json: BOOT('nadia.na@demo.kiorex.test') });
    if (path === '/mobile/devices' && req.method() === 'POST') return route.fulfill({ status: 201, headers: CORS, json: { id: 'dev-1', deviceToken: 'device-secret' } });
    if (req.method() === 'DELETE') return route.fulfill({ headers: CORS, json: {} });
    return route.fulfill({ headers: CORS, json: [] });
  });
  return m;
}

const openSignIn = async (page: Page) => { await page.goto('/'); await page.getByRole('button', { name: 'English' }).click(); await expect(page.getByTestId('signin-passport')).toBeVisible(); };

test.describe('Kiorly x Kiorex Passport (mock Passport + mock clinic API)', () => {
  test('Sign in with Kiorex Passport: PKCE code flow, Passport access token is the bearer, device registered, lands in the app', async ({ page, context, baseURL }) => {
    const m = await mockStack(context, new URL(baseURL!).origin);
    await openSignIn(page);
    await expect(page.getByTestId('signin-method-passport')).toHaveAttribute('aria-selected', 'true'); // Kiorex Passport is the default method
    await page.getByTestId('signin-method-password').click(); // the dev password login is still there, behind the toggle
    await expect(page.getByTestId('signin-submit')).toBeVisible();
    await page.getByTestId('signin-method-passport').click();
    await page.getByTestId('signin-passport').click();
    await expect(page.getByRole('tab', { name: /Work/ })).toBeVisible({ timeout: 20_000 });

    // authorize request: public client, S256 PKCE, nonce, state, staff scopes, the registered web redirect
    expect(m.authorize).toHaveLength(1);
    const q = m.authorize[0]!.searchParams;
    expect(Object.fromEntries(q)).toMatchObject({ client_id: 'kiorly', response_type: 'code', code_challenge_method: 'S256', redirect_uri: `${new URL(baseURL!).origin}/auth/callback`, scope: 'openid profile phone kx kx_org offline_access' });
    expect(q.get('code_challenge')!.length).toBeGreaterThanOrEqual(43); expect(q.get('nonce')).toBeTruthy(); expect(q.get('state')).toBeTruthy();
    // token request: the verifier matches the challenge (mock enforces it), no client secret
    expect(m.tokenForms).toHaveLength(1);
    expect(m.tokenForms[0]).toMatchObject({ grant_type: 'authorization_code', client_id: 'kiorly' }); expect(m.tokenForms[0]).not.toHaveProperty('client_secret');
    // product API: bearer = the Passport access token, client header kiorly/<v>
    const boot = m.apiCalls.find((c) => c.path === '/mobile/bootstrap')!;
    expect(boot.auth).toBe(`Bearer ${m.issued[0]!.access}`);
    expect(boot.client).toMatch(/^kiorly\/\d/);
    expect(m.apiCalls.some((c) => c.path === '/mobile/devices' && c.method === 'POST')).toBe(true);
    // the token lives in the (session) storage, not in the URL
    expect(page.url()).not.toContain('code='); expect(page.url()).not.toContain('access_token');
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kw-session-clinic') ?? '{}').auth)).toBe('passport');
  });

  test('sign-out ends the Passport session with id_token_hint, revokes the refresh token and returns to sign-in', async ({ page, context, baseURL }) => {
    const m = await mockStack(context, new URL(baseURL!).origin);
    await openSignIn(page);
    await page.getByTestId('signin-passport').click();
    await expect(page.getByRole('tab', { name: /Work/ })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /Me/ }).click();
    await expect(page.getByTestId('about-by')).toHaveText('by Kiorex'); // About card
    await page.getByTestId('signout-all').click();
    await page.getByTestId('signout-confirm-btn').click();
    await expect(page.getByTestId('signin-passport')).toBeVisible({ timeout: 20_000 });

    expect(m.apiCalls.some((c) => c.method === 'DELETE' && c.path === '/mobile/devices/dev-1')).toBe(true);
    expect(m.revoked).toEqual([m.issued[0]!.refresh]);
    expect(m.endSession).toHaveLength(1);
    const e = m.endSession[0]!.searchParams;
    expect(e.get('id_token_hint')).toBe(m.issued[0]!.id);
    expect(e.get('client_id')).toBe('kiorly');
    expect(e.get('post_logout_redirect_uri')).toBe(`${new URL(baseURL!).origin}/`);
    expect(await page.evaluate(() => sessionStorage.getItem('kw-session-clinic'))).toBeNull();
  });

  test('a Passport that is not linked to a staff row is refused with a plain message and stores nothing', async ({ page, context, baseURL }) => {
    const m = await mockStack(context, new URL(baseURL!).origin, { linked: false });
    await openSignIn(page);
    await page.getByTestId('signin-passport').click();
    await expect(page.getByTestId('signin-error')).toContainText('not linked to a Clinic staff account', { timeout: 20_000 });
    expect(m.apiCalls.find((c) => c.path === '/mobile/bootstrap')?.auth).toBe(`Bearer ${m.issued[0]!.access}`);
    expect(await page.evaluate(() => sessionStorage.getItem('kw-session-clinic'))).toBeNull();
    await page.getByTestId('signin-method-password').click();
    await expect(page.getByTestId('signin-submit')).toBeVisible(); // still on sign-in, password login available
  });

  test('closing the Passport window cancels quietly', async ({ page, context, baseURL }) => {
    await mockStack(context, new URL(baseURL!).origin);
    await context.route(`${ISSUER}/auth*`, (r) => r.abort()); // the popup never reaches a callback
    await openSignIn(page);
    const popup = page.waitForEvent('popup');
    await page.getByTestId('signin-passport').click();
    await (await popup).close();
    await expect(page.getByTestId('signin-passport')).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId('signin-error')).toHaveCount(0);
  });
});
