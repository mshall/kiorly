import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Product } from "@/api/products";
import { ApiError } from "@/api/errors";
import { useSessions } from "@/auth/SessionProvider";
import { mutate } from "@/offline/mutate";
import { getQueue, loadQueue, subscribe } from "@/offline/queue";
import { isUpgradeAdmin } from "./logic";
import { canSend, IDLE, normalizeNote, reduce, settle, type ReqState } from "./machine";
import { getLast, getRequest, liteVersion, loadLite, reqKey, setLast, setRequest, subscribeLite } from "./store";

/** Reads the persisted Lite store (re-renders on change). */
export function useLiteStore() {
  useEffect(() => { void loadLite(); }, []);
  useSyncExternalStore(subscribeLite, liteVersion, liteVersion);
}

/** Most recently tapped locked feature for the signed-in user of that product (Home upgrade card). */
export function useLastTapped() {
  useLiteStore();
  return getLast();
}

/**
 * Request-upgrade state for one (product, feature). Merges the persisted request, the server's `bootstrap.upgrade.myRequest` (survives reinstall /
 * other device) and the offline queue (a queued op that has left the queue was delivered). `request()` goes through `mutate` so it is queued when offline.
 */
export function useUpgradeRequest(product: Product, featureKey: string) {
  useLiteStore();
  const { sessions, refreshBootstrap } = useSessions();
  const s = sessions[product];
  const owner = s?.email ?? "";
  const b = s?.bootstrap;
  const key = reqKey(product, owner, featureKey);
  const stored = settle(getRequest(key));
  const [local, setLocal] = useState<ReqState>(IDLE); // transient: sending / error

  // Server truth: my request for exactly this feature is on record.
  const mine = b?.upgrade?.myRequest;
  const serverAt = mine && mine.featureKey === featureKey ? mine.requestedAt : null;
  useEffect(() => { if (serverAt && stored.kind !== "requested") setRequest(key, { kind: "requested", at: serverAt }); }, [serverAt, stored.kind, key]);

  // A queued request that has left the offline queue was delivered.
  useEffect(() => {
    if (stored.kind !== "queued") return;
    let live = true; let ready = false;
    // An op that is no longer in the (loaded) queue was delivered. A failed/conflicted op stays in the queue, so it stays "queued" until resolved.
    const check = () => { if (live && ready && !getQueue().some((o) => o.id === stored.opId)) setRequest(key, { kind: "requested", at: new Date().toISOString() }); };
    void loadQueue().then(() => { ready = true; check(); });
    const off = subscribe(check);
    return () => { live = false; off(); };
  }, [stored.kind, stored.kind === "queued" ? stored.opId : "", key]); // eslint-disable-line react-hooks/exhaustive-deps

  const state: ReqState = local.kind === "sending" || local.kind === "error" ? local : stored;

  const request = useCallback(async (note?: string) => {
    if (!canSend(state)) return;
    setLocal((x) => reduce(x.kind === "error" ? IDLE : x, { type: "send" }));
    try {
      const n = normalizeNote(note);
      const body = { featureKey, ...(n ? { note: n } : {}) };
      const r = await mutate<{ status: string; requestedAt: string | null }>(product, "POST", "/mobile/upgrade-request", body, { label: `upgrade:${featureKey}`, owner, queueable: true });
      if (r.queued) { setRequest(key, { kind: "queued", at: new Date().toISOString(), opId: r.opId }); setLocal(IDLE); return; }
      if (r.data.status === "ALREADY_ENTITLED") { setLocal(IDLE); void refreshBootstrap(product); return; }
      setRequest(key, { kind: "requested", at: r.data.requestedAt ?? new Date().toISOString() });
      setLocal(IDLE);
    } catch (e) {
      setLocal({ kind: "error", message: e instanceof ApiError ? e.message : "ERROR" });
    }
  }, [state, product, owner, featureKey, key, refreshBootstrap]);

  return { state, request, isAdmin: isUpgradeAdmin(product, b) };
}

/** Records a tap on a locked feature (so Home can show what interested you). */
export function noteTapped(product: Product, owner: string, featureKey: string) { setLast({ product, owner, featureKey, at: new Date().toISOString() }); }
