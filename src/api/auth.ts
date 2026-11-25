import { api } from "./client";
import type { Product } from "./products";

export interface Credentials { email: string; password?: string; org?: string; mfaCode?: string }
export interface LoginResult { token: string; refreshToken?: string; sessionId?: string }

/** Product login (Passport OIDC PKCE is the production path where the product supports it; see Docs/SECURITY.md). */
export async function login(product: Product, c: Credentials): Promise<LoginResult> {
  if (product === "lab") {
    // Dev IdP only: a release build (__DEV__ false) never reaches the Lab dev login; the branch below is dead code there and the minifier removes the call (launch guide 11.142)
    if (!__DEV__) throw new Error("LAB_DEV_LOGIN_UNAVAILABLE");
    const r = await api.post<{ token: string }>("lab", "/auth/dev-login", { orgSlug: (c.org ?? "").trim(), email: c.email.trim() }, { auth: null, quiet: true });
    return { token: r.token };
  }
  const body: Record<string, string> = { email: c.email.trim(), password: c.password ?? "" };
  if (c.mfaCode) body.mfaCode = c.mfaCode;
  const r = await api.post<{ accessToken: string; refreshToken?: string; sessionId?: string }>(product, "/auth/login", body, { auth: null, quiet: true });
  return { token: r.accessToken, refreshToken: r.refreshToken, sessionId: r.sessionId };
}

export async function refreshTokens(product: Product, refreshToken: string): Promise<LoginResult | null> {
  if (product !== "clinic") return null; // pharmacy / lab have no refresh token: re-login
  try {
    const r = await api.post<{ accessToken: string; refreshToken: string }>(product, "/auth/refresh", { refreshToken }, { auth: null, quiet: true });
    return { token: r.accessToken, refreshToken: r.refreshToken };
  } catch { return null; }
}

/** Lab org picker for the sign-in screen (dev IdP). */
export const labOrgs = () => !__DEV__ ? Promise.resolve([] as { slug: string; name: string }[]) : api.get<{ orgs?: { slug: string; name: string }[] } | { slug: string; name: string }[]>("lab", "/auth/dev/orgs", { auth: null, quiet: true });
