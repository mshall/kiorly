import { prefs } from "@/lib/storage";
import type { Product } from "@/api/products";
import { fromStored, type ReqState, type StoredRequest, toStored } from "./machine";

/** Persisted Lite state: my upgrade requests per (product, user, feature) and the feature I tapped last (drives the calm Home card). */
const KEY = "kw-lite-v1";
export interface LastTapped { product: Product; owner: string; featureKey: string; at: string }
interface Data { requests: Record<string, StoredRequest>; last: LastTapped | null }

let data: Data = { requests: {}, last: null };
let loaded = false;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };
const persist = () => prefs.set(KEY, JSON.stringify(data));

export const reqKey = (product: Product, owner: string, featureKey: string) => `${product}|${owner}|${featureKey}`;

export async function loadLite() {
  if (loaded) return;
  loaded = true;
  try { const raw = await prefs.get(KEY); if (raw) { const p = JSON.parse(raw) as Partial<Data>; data = { requests: p.requests ?? {}, last: p.last ?? null }; emit(); } } catch { /* corrupt: start clean */ }
}
export const subscribeLite = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const liteVersion = () => version;

export const getRequest = (k: string): ReqState => fromStored(data.requests[k]);
export function setRequest(k: string, s: ReqState) {
  const st = toStored(s);
  const next = { ...data.requests };
  if (st) next[k] = st; else delete next[k];
  data = { ...data, requests: next };
  emit(); void persist();
}
export const getLast = (): LastTapped | null => data.last;
export function setLast(l: LastTapped) { data = { ...data, last: l }; emit(); void persist(); }
export const clearLast = () => { data = { ...data, last: null }; emit(); void persist(); };
export const __resetLiteForTests = () => { data = { requests: {}, last: null }; loaded = true; version = 0; listeners.clear(); };
