(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---- mocks: network client, secure storage, Passport browser steps -----------------------------------------------------------------
const mockStore = new Map<string, string>();
jest.mock("@/lib/storage", () => ({
  secureStore: { get: async (k: string) => mockStore.get(k) ?? null, set: async (k: string, v: string) => { mockStore.set(k, v); }, remove: async (k: string) => { mockStore.delete(k); } },
  prefs: { get: async (k: string) => mockStore.get(`p:${k}`) ?? null, set: async (k: string, v: string) => { mockStore.set(`p:${k}`, v); } },
}));
jest.mock("@/offline/queue", () => ({ clearOwner: jest.fn(async () => {}) }));
jest.mock("expo-device", () => ({ deviceName: "Test phone", modelName: "Test" }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "install-1" }));

const mockCalls: { m: string; product: string; path: string; token?: string }[] = [];
let mockHooks: { refresh?: (p: string) => Promise<boolean> } = {};
const mockBoot = (p: string, email = "nadia@demo.test") => ({ apiVersion: 1, product: p, serverTime: "", user: { id: "u", name: "Dr Nadia", email, role: "DOCTOR", roles: ["DOCTOR"] }, org: { id: "o", name: "Nile Care", plan: "PRO" }, entitlement: { key: "mobile_staff_app", enabled: true, requiredPlan: "PRO", reason: null }, safetyAlertsOnly: false, modules: [], device: { id: "d1", status: "ACTIVE" } });
let mockBootErr: unknown = null;
jest.mock("@/api/client", () => ({
  configureClient: (h: typeof mockHooks) => { mockHooks = h; },
  api: {
    get: async (product: string, path: string, o?: { auth?: { token: string } | null }) => { mockCalls.push({ m: "GET", product, path, token: o?.auth?.token }); if (mockBootErr) throw mockBootErr; return mockBoot(product); },
    post: async (product: string, path: string) => { mockCalls.push({ m: "POST", product, path }); return { id: "dev-1", deviceToken: "dt" }; },
    del: async (product: string, path: string) => { mockCalls.push({ m: "DELETE", product, path }); return {}; },
  },
}));
jest.mock("@/api/auth", () => ({ login: jest.fn(async () => ({ token: "pw-token" })), refreshTokens: jest.fn(async () => null) }));

const mockSignIn = jest.fn(); const mockEnd = jest.fn(async (_id?: unknown) => true); const mockRevoke = jest.fn(async (_t?: unknown) => {}); const mockRefresh = jest.fn();
jest.mock("@/auth/passport", () => ({
  signInWithPassport: (...a: unknown[]) => mockSignIn(...a), endPassportSession: (a?: unknown) => mockEnd(a), revokeRefreshToken: (a?: unknown) => mockRevoke(a), refreshTokens: (...a: unknown[]) => mockRefresh(...a),
}));

import { SessionProvider, useSessions } from "@/auth/SessionProvider";

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}><SessionProvider>{children}</SessionProvider></QueryClientProvider>;
const tokens = (n: number) => ({ tokens: { accessToken: `AT${n}`, refreshToken: `RT${n}`, idToken: `ID${n}`, expiresAt: Date.now() + 900_000 }, claims: { sub: `sub-${n}`, name: "Dr Nadia" } });

beforeEach(() => { mockStore.clear(); mockCalls.length = 0; mockBootErr = null; jest.clearAllMocks(); });

async function ready() {
  const h = await renderHook(() => useSessions(), { wrapper });
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  return h;
}

describe("Passport sessions", () => {
  it("signs in with the Passport access token as the bearer and stores the id_token for sign-out", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1));
    const h = await ready();
    await act(async () => { await h.result.current.signInPassport("pharmacy", "ar"); });
    expect(mockSignIn).toHaveBeenCalledWith({ lang: "ar" });
    expect(mockCalls.find((c) => c.path === "/mobile/bootstrap")?.token).toBe("AT1");
    const s = h.result.current.sessions.pharmacy!;
    expect(s).toMatchObject({ auth: "passport", token: "AT1", refreshToken: "RT1", idToken: "ID1", email: "nadia@demo.test", deviceRecordId: "dev-1" });
    expect(JSON.parse(mockStore.get("kw-session-pharmacy")!)).toMatchObject({ idToken: "ID1", auth: "passport" });
  });
  it("leaves nothing behind when the product does not know this Passport (bootstrap 403)", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1));
    mockBootErr = Object.assign(new Error("not linked"), { status: 403, code: "PASSPORT_NOT_LINKED" });
    const h = await ready();
    await expect(act(async () => { await h.result.current.signInPassport("lab"); })).rejects.toMatchObject({ code: "PASSPORT_NOT_LINKED" });
    expect(h.result.current.products).toEqual([]);
    expect(mockStore.has("kw-session-lab")).toBe(false);
  });
  it("refreshes a Passport session through Passport (rotating token) and keeps the id_token", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1));
    mockRefresh.mockResolvedValueOnce({ accessToken: "AT2", refreshToken: "RT2", expiresAt: Date.now() + 900_000 });
    const h = await ready();
    await act(async () => { await h.result.current.signInPassport("clinic"); });
    let ok = false;
    await act(async () => { ok = await mockHooks.refresh!("clinic"); });
    expect(ok).toBe(true);
    expect(mockRefresh).toHaveBeenCalledWith("RT1", { previousIdToken: "ID1" });
    expect(h.result.current.sessions.clinic).toMatchObject({ token: "AT2", refreshToken: "RT2", idToken: "ID1" });
  });
  it("a revoked refresh token means the session cannot refresh", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1)); mockRefresh.mockResolvedValueOnce(null);
    const h = await ready();
    await act(async () => { await h.result.current.signInPassport("clinic"); });
    let ok = true; await act(async () => { ok = await mockHooks.refresh!("clinic"); });
    expect(ok).toBe(false);
  });
  it("sign-out ends the Passport session with id_token_hint, revokes the refresh token and drops the device", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1));
    const h = await ready();
    await act(async () => { await h.result.current.signInPassport("clinic"); });
    await act(async () => { await h.result.current.signOut("clinic"); });
    expect(mockCalls).toContainEqual({ m: "DELETE", product: "clinic", path: "/mobile/devices/dev-1" });
    expect(mockRevoke).toHaveBeenCalledWith("RT1");
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledWith("ID1");
    expect(h.result.current.products).toEqual([]);
    expect(mockStore.has("kw-session-clinic")).toBe(false);
  });
  it("signing out of one product keeps the Passport session while another product still uses it; the last one ends it", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1)).mockResolvedValueOnce(tokens(2));
    const h = await ready();
    await act(async () => { await h.result.current.signInPassport("clinic"); });
    await act(async () => { await h.result.current.signInPassport("lab"); });
    await act(async () => { await h.result.current.signOut("clinic"); });
    expect(mockEnd).not.toHaveBeenCalled();
    await act(async () => { await h.result.current.signOut("lab"); });
    expect(mockEnd).toHaveBeenCalledWith("ID2");
  });
  it("sign out of everything ends the Passport session exactly once", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1)).mockResolvedValueOnce(tokens(2));
    const h = await ready();
    await act(async () => { await h.result.current.signInPassport("clinic"); });
    await act(async () => { await h.result.current.signInPassport("pharmacy"); });
    await act(async () => { await h.result.current.signOutAll(); });
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(h.result.current.products).toEqual([]);
  });
  it("a password session never touches Passport on sign-out (dev login keeps working)", async () => {
    const h = await ready();
    await act(async () => { await h.result.current.signIn("clinic", { email: "nadia.na@demo.kiorex.test", password: "Demo@12345" }); });
    expect(h.result.current.sessions.clinic).toMatchObject({ auth: "password", token: "pw-token" });
    await act(async () => { await h.result.current.signOut("clinic"); });
    expect(mockEnd).not.toHaveBeenCalled(); expect(mockRevoke).not.toHaveBeenCalled();
  });
  it("sign-out still completes when the Passport browser step fails", async () => {
    mockSignIn.mockResolvedValueOnce(tokens(1)); mockEnd.mockResolvedValueOnce(false);
    const h = await ready();
    await act(async () => { await h.result.current.signInPassport("clinic"); });
    await act(async () => { await h.result.current.signOut("clinic"); });
    expect(h.result.current.products).toEqual([]);
  });
});
