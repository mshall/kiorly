import { Platform } from "react-native";
import { API_BASE, CLIENT_HEADER, type Product } from "./products";
import { ApiError, parseErrorBody } from "./errors";

export interface AuthContext { token: string; deviceRecordId?: string; deviceToken?: string }
type Getter = (p: Product) => AuthContext | null;
type Hook = (p: Product, e: ApiError) => void;

let authGetter: Getter = () => null;
let errorHook: Hook = () => {};
let refresher: ((p: Product) => Promise<boolean>) | null = null;
/** Wired by the SessionProvider: supplies tokens, reacts to 401 / DEVICE_REVOKED / FEATURE_DISABLED, refreshes clinic tokens. */
export function configureClient(opts: { getAuth: Getter; onError: Hook; refresh?: (p: Product) => Promise<boolean> }) {
  authGetter = opts.getAuth; errorHook = opts.onError; refresher = opts.refresh ?? null;
}

export interface ReqOpts {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  /** Skip the session error hook (used by sign-in probes). */
  quiet?: boolean;
  auth?: AuthContext | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const buildUrl = (product: Product, path: string, query?: ReqOpts["query"]) => {
  const q = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&") : "";
  return `${API_BASE[product]}${path}${q ? `${path.includes("?") ? "&" : "?"}${q}` : ""}`;
};

export async function request<T = unknown>(product: Product, method: Method, path: string, opts: ReqOpts = {}, retried = false): Promise<T> {
  const auth = opts.auth !== undefined ? opts.auth : authGetter(product);
  const headers: Record<string, string> = { Accept: "application/json", "X-Kiorly-Client": CLIENT_HEADER };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.deviceRecordId && auth.deviceToken) { headers["X-Kiorly-Device"] = auth.deviceRecordId; headers["X-Kiorly-Device-Token"] = auth.deviceToken; }
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000) : null;
  let res: Response;
  try {
    res = await fetch(buildUrl(product, path, opts.query), { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: opts.signal ?? ctrl?.signal });
  } catch (e) {
    throw new ApiError(0, "NETWORK", (e as Error)?.message || "Network request failed");
  } finally { if (timer) clearTimeout(timer); }
  const text = await res.text();
  let json: unknown = null;
  if (text) { try { json = JSON.parse(text); } catch { json = null; } }
  if (!res.ok) {
    const err = parseErrorBody(res.status, json, res.statusText || "Request failed");
    if (res.status === 401 && !opts.quiet && !retried && refresher && !err.isDeviceRevoked && (await refresher(product))) return request<T>(product, method, path, opts, true);
    if (!opts.quiet) errorHook(product, err);
    throw err;
  }
  return json as T;
}

export const api = {
  get: <T = unknown>(p: Product, path: string, opts?: ReqOpts) => request<T>(p, "GET", path, opts),
  post: <T = unknown>(p: Product, path: string, body?: unknown, opts?: ReqOpts) => request<T>(p, "POST", path, { ...opts, body: body ?? {} }),
  put: <T = unknown>(p: Product, path: string, body?: unknown, opts?: ReqOpts) => request<T>(p, "PUT", path, { ...opts, body: body ?? {} }),
  patch: <T = unknown>(p: Product, path: string, body?: unknown, opts?: ReqOpts) => request<T>(p, "PATCH", path, { ...opts, body: body ?? {} }),
  del: <T = unknown>(p: Product, path: string, opts?: ReqOpts) => request<T>(p, "DELETE", path, opts),
};
export const isWeb = Platform.OS === "web";
