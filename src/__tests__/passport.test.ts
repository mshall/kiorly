import { createHash } from "crypto";
import * as AuthSession from "expo-auth-session";
import {
  PASSPORT_CLIENT_ID, PASSPORT_ISSUER, PASSPORT_SCOPES, PassportError, buildAuthRequest, buildEndSessionUrl, checkIdToken, discover, endPassportSession, exchangeCode,
  parseJwt, passportFailureKind, postLogoutRedirectUri, redirectUri, refreshTokens, resetDiscoveryCache, revokeRefreshToken, signInWithPassport,
} from "@/auth/passport";

// jest-expo stubs expo-crypto with constants; the PKCE maths must be real here.
jest.mock("expo-crypto", () => {
  const c = require("crypto");
  return {
    getRandomValues: (a: Uint8Array) => c.randomFillSync(a),
    CryptoDigestAlgorithm: { SHA256: "SHA-256" }, CryptoEncoding: { BASE64: "base64", HEX: "hex" },
    digestStringAsync: async (_alg: string, data: string, o: { encoding: "base64" | "hex" }) => c.createHash("sha256").update(data).digest(o.encoding),
  };
});

const DISCO = {
  issuer: PASSPORT_ISSUER, authorization_endpoint: `${PASSPORT_ISSUER}/auth`, token_endpoint: `${PASSPORT_ISSUER}/token`, end_session_endpoint: `${PASSPORT_ISSUER}/session/end`,
  revocation_endpoint: `${PASSPORT_ISSUER}/token/revocation`, jwks_uri: `${PASSPORT_ISSUER}/jwks`,
};
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims: Record<string, unknown>) => `${b64({ alg: "RS256" })}.${b64(claims)}.sig`;
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

/** fetch mock: routes by URL, records every call. */
function mockFetch(routes: Record<string, (init?: RequestInit) => Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const hit = Object.keys(routes).find((k) => url.startsWith(k));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return routes[hit]!(init);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const form = (init?: RequestInit) => Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));

beforeEach(() => resetDiscoveryCache());

describe("Passport client configuration", () => {
  it("is the public client `kiorly` on the dev Passport and asks for the staff scopes", () => {
    expect(PASSPORT_CLIENT_ID).toBe("kiorly");
    expect(PASSPORT_ISSUER).toBe("http://localhost:4400");
    expect(PASSPORT_SCOPES).toEqual(["openid", "profile", "phone", "kx", "kx_org", "offline_access"]);
  });
  it("uses the kiorly:// scheme for the redirect and the sign-out landing on native", () => {
    expect(redirectUri()).toBe("kiorly://auth/callback");
    expect(postLogoutRedirectUri()).toBe("kiorly://auth/logout");
  });
});

describe("discovery", () => {
  it("reads the endpoints once and caches them", async () => {
    const { f, calls } = mockFetch({ [`${PASSPORT_ISSUER}/.well-known/openid-configuration`]: () => json(DISCO) });
    const d = await discover(PASSPORT_ISSUER, f); await discover(PASSPORT_ISSUER, f);
    expect(d).toMatchObject({ authorizationEndpoint: DISCO.authorization_endpoint, tokenEndpoint: DISCO.token_endpoint, endSessionEndpoint: DISCO.end_session_endpoint });
    expect(calls).toHaveLength(1);
  });
  it("fails loudly when Passport is unreachable or the document is incomplete", async () => {
    await expect(discover(PASSPORT_ISSUER, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).rejects.toMatchObject({ code: "network" });
    resetDiscoveryCache();
    await expect(discover(PASSPORT_ISSUER, mockFetch({ [PASSPORT_ISSUER]: () => json({ issuer: "x" }) }).f)).rejects.toMatchObject({ code: "discovery" });
  });
});

describe("authorization request (PKCE S256)", () => {
  it("builds a code request for client kiorly with S256 challenge, state, nonce and the registered redirect", async () => {
    const { request, nonce, url } = await buildAuthRequest({ authorizationEndpoint: DISCO.authorization_endpoint, tokenEndpoint: DISCO.token_endpoint }, { lang: "ar" });
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(DISCO.authorization_endpoint);
    expect(u.searchParams.get("client_id")).toBe("kiorly");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("redirect_uri")).toBe("kiorly://auth/callback");
    expect(u.searchParams.get("scope")).toBe("openid profile phone kx kx_org offline_access");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("nonce")).toBe(nonce);
    expect(u.searchParams.get("ui_locales")).toBe("ar");
    expect(u.searchParams.get("state")).toBe(request.state);
    expect(u.searchParams.has("client_secret")).toBe(false);
    const verifier = request.codeVerifier!;
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(u.searchParams.get("code_challenge")).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });
  it("never reuses state, nonce or verifier between sign-ins", async () => {
    const d = { authorizationEndpoint: DISCO.authorization_endpoint, tokenEndpoint: DISCO.token_endpoint };
    const a = await buildAuthRequest(d); const b = await buildAuthRequest(d);
    expect(a.request.state).not.toBe(b.request.state); expect(a.nonce).not.toBe(b.nonce); expect(a.request.codeVerifier).not.toBe(b.request.codeVerifier);
  });
});

describe("token endpoint", () => {
  it("exchanges the code with the PKCE verifier and no client secret", async () => {
    const { f, calls } = mockFetch({ [DISCO.token_endpoint]: () => json({ access_token: "AT", refresh_token: "RT", id_token: "IT", expires_in: 900 }) });
    const t = await exchangeCode({ code: "c0de", codeVerifier: "v".repeat(64), redirectUri: "kiorly://auth/callback", discovery: { authorizationEndpoint: "", tokenEndpoint: DISCO.token_endpoint }, fetchImpl: f, now: 1_000 });
    expect(form(calls[0]!.init)).toEqual({ grant_type: "authorization_code", code: "c0de", redirect_uri: "kiorly://auth/callback", client_id: "kiorly", code_verifier: "v".repeat(64) });
    expect(t).toMatchObject({ accessToken: "AT", refreshToken: "RT", idToken: "IT", expiresAt: 1_000 + 900_000 });
  });
  it("surfaces an invalid grant", async () => {
    const { f } = mockFetch({ [DISCO.token_endpoint]: () => json({ error: "invalid_grant", error_description: "grant request is invalid" }, 400) });
    await expect(exchangeCode({ code: "x", codeVerifier: "y", redirectUri: "z", discovery: { authorizationEndpoint: "", tokenEndpoint: DISCO.token_endpoint }, fetchImpl: f })).rejects.toMatchObject({ code: "token" });
  });
  it("rotates the refresh token and keeps the previous id_token for sign-out", async () => {
    const { f, calls } = mockFetch({ [DISCO.token_endpoint]: () => json({ access_token: "AT2", refresh_token: "RT2", expires_in: 900 }) });
    const t = await refreshTokens("RT1", { discovery: { authorizationEndpoint: "", tokenEndpoint: DISCO.token_endpoint }, fetchImpl: f, previousIdToken: "IT1" });
    expect(form(calls[0]!.init)).toEqual({ grant_type: "refresh_token", refresh_token: "RT1", client_id: "kiorly" });
    expect(t).toMatchObject({ accessToken: "AT2", refreshToken: "RT2", idToken: "IT1" });
  });
  it("keeps the old refresh token when the server does not rotate", async () => {
    const { f } = mockFetch({ [DISCO.token_endpoint]: () => json({ access_token: "AT2", expires_in: 900 }) });
    expect((await refreshTokens("RT1", { discovery: { authorizationEndpoint: "", tokenEndpoint: DISCO.token_endpoint }, fetchImpl: f }))?.refreshToken).toBe("RT1");
  });
  it("returns null for a revoked refresh token but throws when offline (offline is not signed out)", async () => {
    const d = { authorizationEndpoint: "", tokenEndpoint: DISCO.token_endpoint };
    expect(await refreshTokens("dead", { discovery: d, fetchImpl: mockFetch({ [DISCO.token_endpoint]: () => json({ error: "invalid_grant" }, 400) }).f })).toBeNull();
    await expect(refreshTokens("RT", { discovery: d, fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch })).rejects.toBeInstanceOf(PassportError);
  });
  it("revokes the refresh token at the revocation endpoint and never throws", async () => {
    const { f, calls } = mockFetch({ [DISCO.revocation_endpoint]: () => json({}) });
    await revokeRefreshToken("RT9", { discovery: { authorizationEndpoint: "", tokenEndpoint: "", revocationEndpoint: DISCO.revocation_endpoint }, fetchImpl: f });
    expect(form(calls[0]!.init)).toEqual({ token: "RT9", token_type_hint: "refresh_token", client_id: "kiorly" });
    await expect(revokeRefreshToken("RT9", { discovery: { authorizationEndpoint: "", tokenEndpoint: "", revocationEndpoint: "http://x" }, fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch })).resolves.toBeUndefined();
  });
});

describe("id_token checks", () => {
  const ok = { iss: PASSPORT_ISSUER, aud: "kiorly", nonce: "n1", sub: "u1", exp: Math.floor(Date.now() / 1000) + 600 };
  it("reads claims and accepts a matching token", () => {
    expect(parseJwt(jwt(ok))).toMatchObject({ sub: "u1" });
    expect(checkIdToken(jwt(ok), { issuer: PASSPORT_ISSUER, clientId: "kiorly", nonce: "n1" })).toMatchObject({ sub: "u1" });
  });
  it.each([["issuer", { iss: "http://evil" }], ["audience", { aud: "kiorex-web" }], ["nonce", { nonce: "other" }], ["expiry", { exp: 1 }]])("rejects a wrong %s", (_n, patch) => {
    expect(() => checkIdToken(jwt({ ...ok, ...patch }), { issuer: PASSPORT_ISSUER, clientId: "kiorly", nonce: "n1" })).toThrow(PassportError);
  });
  it("rejects garbage", () => { expect(parseJwt("nope")).toBeNull(); expect(() => checkIdToken("nope", { issuer: "i", clientId: "c", nonce: "n" })).toThrow(PassportError); });
});

describe("signInWithPassport (full flow, browser step mocked)", () => {
  afterEach(() => jest.restoreAllMocks());
  const wire = (prompt: (self: AuthSession.AuthRequest) => unknown) => {
    let nonce = "";
    jest.spyOn(AuthSession.AuthRequest.prototype, "promptAsync").mockImplementation(async function (this: AuthSession.AuthRequest) {
      nonce = String((this as unknown as { extraParams: Record<string, string> }).extraParams.nonce);
      return prompt(this) as never;
    });
    const net = mockFetch({
      [`${PASSPORT_ISSUER}/.well-known/openid-configuration`]: () => json(DISCO),
      [DISCO.token_endpoint]: () => json({ access_token: "AT", refresh_token: "RT", id_token: jwt({ iss: PASSPORT_ISSUER, aud: "kiorly", nonce, sub: "sub-1", name: "Dr Nadia", exp: Math.floor(Date.now() / 1000) + 900 }), expires_in: 900 }),
    });
    return net;
  };
  it("redeems the code with the same verifier the challenge was made from", async () => {
    let verifier = "";
    const { f, calls } = wire((r) => { verifier = r.codeVerifier!; return { type: "success", params: { code: "abc", state: r.state, iss: PASSPORT_ISSUER } }; });
    const r = await signInWithPassport({ fetchImpl: f });
    expect(r.tokens).toMatchObject({ accessToken: "AT", refreshToken: "RT" });
    expect(r.claims).toMatchObject({ sub: "sub-1", name: "Dr Nadia" });
    const tokenCall = calls.find((c) => c.url === DISCO.token_endpoint)!;
    expect(form(tokenCall.init)).toMatchObject({ grant_type: "authorization_code", code: "abc", code_verifier: verifier, client_id: "kiorly", redirect_uri: "kiorly://auth/callback" });
  });
  it("refuses a response whose state does not match (CSRF)", async () => {
    const { f, calls } = wire(() => ({ type: "success", params: { code: "abc", state: "attacker" } }));
    await expect(signInWithPassport({ fetchImpl: f })).rejects.toMatchObject({ code: "state" });
    expect(calls.some((c) => c.url === DISCO.token_endpoint)).toBe(false); // the code is never redeemed
  });
  it("refuses a response from another issuer (mix-up)", async () => {
    const { f } = wire((r) => ({ type: "success", params: { code: "abc", state: r.state, iss: "http://evil.example" } }));
    await expect(signInWithPassport({ fetchImpl: f })).rejects.toMatchObject({ code: "state" });
  });
  it("treats a closed browser as a cancel and an OIDC error as denied", async () => {
    await expect(signInWithPassport({ fetchImpl: wire(() => ({ type: "dismiss" })).f })).rejects.toMatchObject({ code: "cancelled" });
    await expect(signInWithPassport({ fetchImpl: wire(() => ({ type: "error", params: { error: "access_denied" }, error: { description: "no" } })).f })).rejects.toMatchObject({ code: "denied" });
  });
  it("rejects an id_token whose nonce is not ours", async () => {
    jest.spyOn(AuthSession.AuthRequest.prototype, "promptAsync").mockImplementation(async function (this: AuthSession.AuthRequest) { return { type: "success", params: { code: "abc", state: this.state } } as never; });
    const { f } = mockFetch({
      [`${PASSPORT_ISSUER}/.well-known/openid-configuration`]: () => json(DISCO),
      [DISCO.token_endpoint]: () => json({ access_token: "AT", id_token: jwt({ iss: PASSPORT_ISSUER, aud: "kiorly", nonce: "replayed", sub: "s", exp: Math.floor(Date.now() / 1000) + 900 }) }),
    });
    await expect(signInWithPassport({ fetchImpl: f })).rejects.toMatchObject({ code: "nonce" });
  });
});

describe("RP-initiated sign-out", () => {
  it("passes id_token_hint, client_id and the registered post-logout redirect", () => {
    const u = new URL(buildEndSessionUrl(DISCO.end_session_endpoint, { idToken: "ID.TOKEN.X", state: "s1" }));
    expect(`${u.origin}${u.pathname}`).toBe(`${PASSPORT_ISSUER}/session/end`);
    expect(Object.fromEntries(u.searchParams)).toEqual({ id_token_hint: "ID.TOKEN.X", client_id: "kiorly", post_logout_redirect_uri: "kiorly://auth/logout", state: "s1" });
  });
  it("opens the end-session URL in the auth browser and reports success", async () => {
    const open = jest.fn(async () => ({ type: "success" }));
    const { f } = mockFetch({ [`${PASSPORT_ISSUER}/.well-known/openid-configuration`]: () => json(DISCO) });
    expect(await endPassportSession("ID.TOKEN.X", { fetchImpl: f, open })).toBe(true);
    const [url, redirect] = open.mock.calls[0] as unknown as [string, string];
    expect(new URL(url).searchParams.get("id_token_hint")).toBe("ID.TOKEN.X");
    expect(redirect).toBe("kiorly://auth/logout");
  });
  it("does nothing without an id_token and never throws (offline sign-out still works)", async () => {
    expect(await endPassportSession(undefined)).toBe(false);
    expect(await endPassportSession("ID", { fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch })).toBe(false);
    const open = jest.fn(async () => { throw new Error("browser gone"); });
    expect(await endPassportSession("ID", { fetchImpl: mockFetch({ [`${PASSPORT_ISSUER}/.well-known`]: () => json(DISCO) }).f, open })).toBe(false);
  });
});

describe("product API rejection mapping", () => {
  it.each([[403, "PASSPORT_NOT_LINKED", "not_linked"], [401, "UNKNOWN_STAFF", "not_linked"], [401, "INVALID_TOKEN", "not_supported"], [404, "HTTP_404", "not_supported"], [403, "FORBIDDEN", "not_linked"], [500, "HTTP_500", "other"]])("%s %s -> %s", (s, c, k) => {
    expect(passportFailureKind(s as number, c as string)).toBe(k);
  });
});
