import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { useQueryClient } from "@tanstack/react-query";
import { api, configureClient } from "@/api/client";
import { login as doLogin, refreshTokens, type Credentials } from "@/api/auth";
import { APP_VERSION, PRODUCTS, type Product } from "@/api/products";
import type { Bootstrap, Session } from "@/api/types";
import type { ApiError } from "@/api/errors";
import { prefs, secureStore } from "@/lib/storage";
import { clearOwner } from "@/offline/queue";

type Sessions = Partial<Record<Product, Session>>;
export type SessionNotice = { product: Product; reason: "expired" | "revoked" | "entitlement" } | null;

interface Ctx {
  ready: boolean;
  sessions: Sessions;
  products: Product[];
  notice: SessionNotice;
  dismissNotice: () => void;
  signIn: (p: Product, c: Credentials) => Promise<Bootstrap>;
  signOut: (p: Product) => Promise<void>;
  signOutAll: () => Promise<void>;
  refreshBootstrap: (p: Product) => Promise<Bootstrap | null>;
  bootstrapOf: (p: Product) => Bootstrap | undefined;
  isEntitled: (p: Product) => boolean;
}
const SessionCtx = createContext<Ctx | null>(null);
export const useSessions = () => { const c = useContext(SessionCtx); if (!c) throw new Error("SessionProvider missing"); return c; };

const K_INSTALL = "kw-install-id";
const kSession = (p: Product) => `kw-session-${p}`;
const kBoot = (p: Product) => `kw-bootstrap-${p}`;

async function installId(): Promise<string> {
  let id = await secureStore.get(K_INSTALL);
  if (!id) { id = Crypto.randomUUID(); await secureStore.set(K_INSTALL, id); }
  return id;
}
export const deviceName = () => (Device.deviceName || Device.modelName || (Platform.OS === "web" ? "Web browser" : "Device"));
const platform = (): "ios" | "android" | "web" => (Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web");

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Sessions>({});
  const [notice, setNotice] = useState<SessionNotice>(null);
  const ref = useRef<Sessions>({});
  ref.current = sessions;

  const commit = useCallback(async (p: Product, s: Session | null) => {
    const next = { ...ref.current };
    if (s) next[p] = s; else delete next[p];
    ref.current = next; setSessions(next);
    if (s) {
      const { bootstrap, ...secret } = s;
      await secureStore.set(kSession(p), JSON.stringify(secret));
      if (bootstrap) await prefs.set(kBoot(p), JSON.stringify(bootstrap));
    } else { await secureStore.remove(kSession(p)); await prefs.set(kBoot(p), ""); }
  }, []);

  const clear = useCallback(async (p: Product, reason?: "expired" | "revoked" | "entitlement") => {
    const s = ref.current[p];
    if (s) await clearOwner(s.email);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] === p });
    await commit(p, null);
    if (reason) setNotice({ product: p, reason });
  }, [commit, qc]);

  const refreshBootstrap = useCallback(async (p: Product): Promise<Bootstrap | null> => {
    const s = ref.current[p]; if (!s) return null;
    try {
      const b = await api.get<Bootstrap>(p, "/mobile/bootstrap");
      await commit(p, { ...s, bootstrap: b });
      return b;
    } catch { return null; }
  }, [commit]);

  const ensureDevice = useCallback(async (p: Product, s: Session, b: Bootstrap): Promise<Session> => {
    if (!b.entitlement.enabled) return { ...s, deviceRecordId: undefined, deviceToken: undefined };
    if (s.deviceRecordId && s.deviceToken && b.device?.status === "ACTIVE") return s;
    const r = await api.post<{ id: string; deviceToken: string }>(p, "/mobile/devices", { deviceId: s.deviceId, platform: platform(), name: deviceName(), appVersion: APP_VERSION });
    return { ...s, deviceRecordId: r.id, deviceToken: r.deviceToken };
  }, []);

  useEffect(() => {
    configureClient({
      getAuth: (p) => { const s = ref.current[p]; return s ? { token: s.token, deviceRecordId: s.deviceRecordId, deviceToken: s.deviceToken } : null; },
      onError: (p, e: ApiError) => {
        if (e.isDeviceRevoked) void clear(p, "revoked");
        else if (e.isUnauthorized && ref.current[p]) void clear(p, "expired");
        else if (e.isFeatureDisabled && e.featureKey === "mobile_staff_app") void refreshBootstrap(p).then((b) => { if (b && !b.entitlement.enabled) setNotice({ product: p, reason: "entitlement" }); });
      },
      refresh: async (p) => {
        const s = ref.current[p]; if (!s?.refreshToken) return false;
        const r = await refreshTokens(p, s.refreshToken);
        if (!r) return false;
        await commit(p, { ...s, token: r.token, refreshToken: r.refreshToken ?? s.refreshToken });
        return true;
      },
    });
  }, [clear, commit, refreshBootstrap]);

  useEffect(() => {
    void (async () => {
      const loaded: Sessions = {};
      for (const p of PRODUCTS) {
        const raw = await secureStore.get(kSession(p));
        if (!raw) continue;
        try {
          const s = JSON.parse(raw) as Session;
          const b = await prefs.get(kBoot(p));
          if (b) { try { s.bootstrap = JSON.parse(b) as Bootstrap; } catch { /* ignore */ } }
          loaded[p] = s;
        } catch { /* ignore corrupt */ }
      }
      ref.current = loaded; setSessions(loaded); setReady(true);
      // revalidate in the background: picks up plan changes and remote sign-out
      for (const p of PRODUCTS) if (loaded[p]) void refreshBootstrap(p);
    })();
  }, [refreshBootstrap]);

  const signIn = useCallback(async (p: Product, c: Credentials) => {
    const res = await doLogin(p, c);
    const base: Session = { product: p, token: res.token, refreshToken: res.refreshToken, userName: c.email, email: c.email.trim().toLowerCase(), deviceId: await installId(), signedInAt: new Date().toISOString() };
    ref.current = { ...ref.current, [p]: base };
    let b: Bootstrap;
    try { b = await api.get<Bootstrap>(p, "/mobile/bootstrap", { auth: { token: res.token }, quiet: true }); }
    catch (e) { delete ref.current[p]; throw e; }
    let s: Session = { ...base, userName: b.user.name || c.email, bootstrap: b };
    try { s = await ensureDevice(p, s, b); } catch (e) { const err = e as ApiError; if (!err.isFeatureDisabled) { delete ref.current[p]; throw e; } }
    await commit(p, s);
    setNotice(null);
    if (s.deviceRecordId) { try { b = (await api.get<Bootstrap>(p, "/mobile/bootstrap")) ?? b; await commit(p, { ...s, bootstrap: b }); } catch { /* keep */ } }
    return b;
  }, [commit, ensureDevice]);

  const signOut = useCallback(async (p: Product) => {
    const s = ref.current[p];
    if (s?.deviceRecordId) { try { await api.del(p, `/mobile/devices/${s.deviceRecordId}`, { quiet: true }); } catch { /* offline: server device stays until revoked remotely */ } }
    await clear(p);
  }, [clear]);
  const signOutAll = useCallback(async () => { for (const p of PRODUCTS) if (ref.current[p]) await signOut(p); }, [signOut]);

  const value = useMemo<Ctx>(() => ({
    ready, sessions, notice, dismissNotice: () => setNotice(null), signIn, signOut, signOutAll, refreshBootstrap,
    products: PRODUCTS.filter((p) => !!sessions[p]),
    bootstrapOf: (p) => sessions[p]?.bootstrap,
    isEntitled: (p) => !!sessions[p]?.bootstrap?.entitlement.enabled,
  }), [ready, sessions, notice, signIn, signOut, signOutAll, refreshBootstrap]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
