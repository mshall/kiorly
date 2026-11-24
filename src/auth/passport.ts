import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";

/**
 * Kiorex Passport sign-in for the Kiorly staff app: OIDC authorization-code + PKCE (S256) as a PUBLIC native client, refresh-token rotation and
 * RP-initiated sign-out with `id_token_hint`. The product APIs verify the Passport access token themselves (JWKS, issuer, audience, `client_id`
 * claim) and map the subject to their own staff row (role / tenant come from the product, never from the token: ADR-013).
 * Everything that is not the interactive browser step is plain `fetch` + pure functions so it is unit-testable.
 */

// Literal `process.env.EXPO_PUBLIC_*` reads only (Metro inlines exactly these).
export const PASSPORT_ISSUER: string = (process.env.EXPO_PUBLIC_PASSPORT_ISSUER ?? (__DEV__ ? "http://localhost:4400" : "")).replace(/\/+$/, "");
/** Public client id registered in kiorex-account (`kiorly`; the legacy `kiorly-team` client stays registered for old dev builds). */
export const PASSPORT_CLIENT_ID: string = process.env.EXPO_PUBLIC_PASSPORT_CLIENT_ID ?? "kiorly";
/** Set EXPO_PUBLIC_PASSPORT=off to hide the button (the dev password / chip login is always available in dev builds). */
export const PASSPORT_ENABLED: boolean = (process.env.EXPO_PUBLIC_PASSPORT ?? "on") !== "off";
export const PASSPORT_SCOPES = ["openid", "profile", "phone", "kx", "kx_org", "offline_access"] as const;
export const APP_SCHEME = "kiorly";

export interface Discovery {
  authorizationEndpoint: string; tokenEndpoint: string; endSessionEndpoint?: string; revocationEndpoint?: string; jwksUri?: string; issuer?: string;
}
export interface PassportTokens { accessToken: string; refreshToken?: string; idToken?: string; expiresAt: number; scope?: string }
export class PassportError extends Error {
  constructor(public code: "cancelled" | "state" | "nonce" | "discovery" | "token" | "network" | "no_id_token" | "denied", message: string, public detail?: string) { super(message); this.name = "PassportError"; }
}

/** Where Passport sends the browser back to. Native: `kiorly://auth/callback`; Expo web: `<origin>/auth/callback` (both registered for client `kiorly`). */
export function redirectUri(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/auth/callback`;
  return `${APP_SCHEME}://auth/callback`;
}
/** Post sign-out landing (registered `postLogoutRedirectUris`). Native `kiorly://auth/logout`; web `<origin>/`. */
export function postLogoutRedirectUri(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/`;
  return `${APP_SCHEME}://auth/logout`;
}

let discoveryCache: { at: number; issuer: string; doc: Discovery } | null = null;
export const resetDiscoveryCache = () => { discoveryCache = null; };
export async function discover(issuer = PASSPORT_ISSUER, fetchImpl: typeof fetch = fetch): Promise<Discovery> {
  if (discoveryCache && discoveryCache.issuer === issuer && Date.now() - discoveryCache.at < 10 * 60_000) return discoveryCache.doc;
  let res: Response;
  try { res = await fetchImpl(`${issuer}/.well-known/openid-configuration`, { headers: { Accept: "application/json" } }); }
  catch (e) { throw new PassportError("network", "Cannot reach Kiorex Passport", (e as Error)?.message); }
  if (!res.ok) throw new PassportError("discovery", `Passport discovery failed (${res.status})`);
  const j = (await res.json()) as Record<string, string | undefined>;
  if (!j.authorization_endpoint || !j.token_endpoint) throw new PassportError("discovery", "Passport discovery document is incomplete");
  const doc: Discovery = { authorizationEndpoint: j.authorization_endpoint, tokenEndpoint: j.token_endpoint, endSessionEndpoint: j.end_session_endpoint, revocationEndpoint: j.revocation_endpoint, jwksUri: j.jwks_uri, issuer: j.issuer };
  discoveryCache = { at: Date.now(), issuer, doc };
  return doc;
}

// ---- id_token (claims only: it arrives over TLS from the token endpoint we called, OIDC Core 3.1.3.7) ---------------------------------------

const b64urlDecode = (s: string): string => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  try { return decodeURIComponent(bin.split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")); } catch { return bin; }
};
export function parseJwt(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try { return JSON.parse(b64urlDecode(part)) as Record<string, unknown>; } catch { return null; }
}
/** Checks iss / aud / exp / nonce of the id_token. Returns the claims or throws a PassportError. */
export function checkIdToken(idToken: string, o: { issuer: string; clientId: string; nonce: string; now?: number }): Record<string, unknown> {
  const c = parseJwt(idToken);
  if (!c) throw new PassportError("token", "Passport returned an unreadable id_token");
  const aud = Array.isArray(c.aud) ? (c.aud as string[]) : [c.aud as string];
  if (c.iss !== o.issuer) throw new PassportError("token", "id_token issuer mismatch");
  if (!aud.includes(o.clientId)) throw new PassportError("token", "id_token audience mismatch");
  if (typeof c.exp === "number" && c.exp * 1000 < (o.now ?? Date.now()) - 60_000) throw new PassportError("token", "id_token expired");
  if (c.nonce !== o.nonce) throw new PassportError("nonce", "id_token nonce mismatch");
  return c;
}

// ---- token endpoint -----------------------------------------------------------------------------------------------------------------------

interface TokenBody { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
function toTokens(b: TokenBody, now: number, keep?: { refreshToken?: string; idToken?: string }): PassportTokens {
  if (!b.access_token) throw new PassportError("token", "Passport returned no access token");
  return { accessToken: b.access_token, refreshToken: b.refresh_token ?? keep?.refreshToken, idToken: b.id_token ?? keep?.idToken, expiresAt: now + (b.expires_in ?? 900) * 1000, scope: b.scope };
}
async function tokenRequest(d: Discovery, form: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenBody> {
  let res: Response;
  try { res = await fetchImpl(d.tokenEndpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(form).toString() }); }
  catch (e) { throw new PassportError("network", "Cannot reach Kiorex Passport", (e as Error)?.message); }
  const j = (await res.json().catch(() => ({}))) as TokenBody;
  if (!res.ok) throw new PassportError("token", j.error_description || j.error || `token endpoint ${res.status}`, j.error);
  return j;
}

/** Authorization-code + PKCE exchange. The verifier never leaves the device except to the token endpoint. */
export async function exchangeCode(o: { code: string; codeVerifier: string; redirectUri: string; clientId?: string; discovery?: Discovery; fetchImpl?: typeof fetch; now?: number }): Promise<PassportTokens> {
  const f = o.fetchImpl ?? fetch; const d = o.discovery ?? (await discover(PASSPORT_ISSUER, f));
  const j = await tokenRequest(d, { grant_type: "authorization_code", code: o.code, redirect_uri: o.redirectUri, client_id: o.clientId ?? PASSPORT_CLIENT_ID, code_verifier: o.codeVerifier }, f);
  return toTokens(j, o.now ?? Date.now());
}

/** Rotating refresh. The server may return a new refresh token (reuse detection revokes the family if an old one is replayed), so callers must store it. */
export async function refreshTokens(refreshToken: string, o: { clientId?: string; discovery?: Discovery; fetchImpl?: typeof fetch; now?: number; previousIdToken?: string } = {}): Promise<PassportTokens | null> {
  const f = o.fetchImpl ?? fetch;
  try {
    const d = o.discovery ?? (await discover(PASSPORT_ISSUER, f));
    const j = await tokenRequest(d, { grant_type: "refresh_token", refresh_token: refreshToken, client_id: o.clientId ?? PASSPORT_CLIENT_ID }, f);
    return toTokens(j, o.now ?? Date.now(), { refreshToken, idToken: o.previousIdToken });
  } catch (e) {
    if (e instanceof PassportError && e.code === "network") throw e; // offline is not "signed out"
    return null;
  }
}

/** RFC 7009, best effort: invalidates the refresh token server-side. Never throws. */
export async function revokeRefreshToken(refreshToken: string, o: { clientId?: string; discovery?: Discovery; fetchImpl?: typeof fetch } = {}): Promise<void> {
  const f = o.fetchImpl ?? fetch;
  try {
    const d = o.discovery ?? (await discover(PASSPORT_ISSUER, f));
    if (!d.revocationEndpoint) return;
    await f(d.revocationEndpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token", client_id: o.clientId ?? PASSPORT_CLIENT_ID }).toString() });
  } catch { /* best effort */ }
}

// ---- interactive sign-in ------------------------------------------------------------------------------------------------------------------

const randomState = (n = 16) => Array.from(Crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join("");

/** Builds the authorization request (S256 PKCE verifier + state + nonce). Exposed separately so the URL can be asserted in tests. */
export async function buildAuthRequest(d: Discovery, o: { lang?: string; loginHint?: string } = {}): Promise<{ request: AuthSession.AuthRequest; nonce: string; url: string }> {
  const nonce = randomState(16);
  const request = new AuthSession.AuthRequest({
    clientId: PASSPORT_CLIENT_ID, redirectUri: redirectUri(), scopes: [...PASSPORT_SCOPES], responseType: AuthSession.ResponseType.Code, usePKCE: true,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256, state: randomState(16),
    extraParams: { nonce, ...(o.lang ? { ui_locales: o.lang } : {}), ...(o.loginHint ? { login_hint: o.loginHint } : {}) },
  });
  const url = await request.makeAuthUrlAsync({ authorizationEndpoint: d.authorizationEndpoint });
  return { request, nonce, url };
}

/** Opens the Passport sign-in in the system browser session (iOS ASWebAuthenticationSession, Android Custom Tab, popup on web) and returns the tokens. */
export async function signInWithPassport(o: { lang?: string; fetchImpl?: typeof fetch } = {}): Promise<{ tokens: PassportTokens; claims: Record<string, unknown> }> {
  const f = o.fetchImpl ?? fetch;
  const d = await discover(PASSPORT_ISSUER, f);
  const { request, nonce } = await buildAuthRequest(d, { lang: o.lang });
  const result = await request.promptAsync({ authorizationEndpoint: d.authorizationEndpoint });
  if (result.type === "cancel" || result.type === "dismiss" || result.type === "locked") throw new PassportError("cancelled", "Sign-in was cancelled");
  if (result.type === "error") throw new PassportError("denied", result.error?.description || result.error?.message || "Passport refused the sign-in", result.params?.error);
  if (result.type !== "success") throw new PassportError("cancelled", "Sign-in did not complete");
  if (result.params.state !== request.state) throw new PassportError("state", "Sign-in response did not match the request (state)");
  if (result.params.iss && d.issuer && result.params.iss !== d.issuer) throw new PassportError("state", "Sign-in response came from a different issuer");
  const code = result.params.code;
  if (!code || !request.codeVerifier) throw new PassportError("token", "Passport returned no authorization code");
  const tokens = await exchangeCode({ code, codeVerifier: request.codeVerifier, redirectUri: redirectUri(), discovery: d, fetchImpl: f });
  if (!tokens.idToken) throw new PassportError("no_id_token", "Passport returned no id_token");
  const claims = checkIdToken(tokens.idToken, { issuer: d.issuer ?? PASSPORT_ISSUER, clientId: PASSPORT_CLIENT_ID, nonce });
  return { tokens, claims };
}

// ---- RP-initiated logout ------------------------------------------------------------------------------------------------------------------

/** OIDC RP-Initiated Logout 1.0 URL: `id_token_hint` identifies the session, so Passport ends it without the "Stay signed in?" prompt. */
export function buildEndSessionUrl(endpoint: string, o: { idToken: string; postLogoutRedirectUri?: string; clientId?: string; state?: string }): string {
  const q = new URLSearchParams({ id_token_hint: o.idToken, client_id: o.clientId ?? PASSPORT_CLIENT_ID, post_logout_redirect_uri: o.postLogoutRedirectUri ?? postLogoutRedirectUri(), state: o.state ?? randomState(8) });
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${q.toString()}`;
}

/** Ends the Passport (SSO) session. Returns true when the browser round trip completed. Never throws: sign-out must work offline (local state is cleared regardless). */
export async function endPassportSession(idToken: string | undefined, o: { fetchImpl?: typeof fetch; open?: (url: string, redirect: string) => Promise<{ type: string }> } = {}): Promise<boolean> {
  if (!idToken) return false;
  try {
    const d = await discover(PASSPORT_ISSUER, o.fetchImpl ?? fetch);
    if (!d.endSessionEndpoint) return false;
    const redirect = postLogoutRedirectUri();
    const url = buildEndSessionUrl(d.endSessionEndpoint, { idToken, postLogoutRedirectUri: redirect });
    const r = await (o.open ?? ((u, rd) => WebBrowser.openAuthSessionAsync(u, rd)))(url, redirect);
    return r.type === "success";
  } catch { return false; }
}

/** Map a failed first call to a product API (bootstrap) to a reason the sign-in screen can explain. */
export function passportFailureKind(status: number, code?: string): "not_linked" | "not_supported" | "other" {
  if (code === "PASSPORT_NOT_LINKED" || code === "UNKNOWN_STAFF" || code === "NOT_LINKED") return "not_linked";
  if (status === 401 || status === 404) return "not_supported";
  if (status === 403) return "not_linked";
  return "other";
}
