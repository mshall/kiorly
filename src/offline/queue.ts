import { prefs } from "@/lib/storage";
import { ApiError } from "@/api/errors";
import type { Method } from "@/api/client";
import type { Product } from "@/api/products";

/** Offline-first write queue (see Docs/OFFLINE_SYNC.md). Pure logic + a tiny persisted store; the transport is injected so it is unit-testable. */
export type OpStatus = "pending" | "failed" | "conflict";
export interface Precondition {
  /** GET path that returns the current server copy (e.g. `/encounters/<id>`). */
  path: string;
  /** Field holding the server revision (default `updatedAt`). */
  field?: string;
  /** Value of that field when the user started editing (the base revision). null = no check. */
  base: string | null;
}
export interface QueuedOp {
  id: string;
  product: Product;
  /** Owner (email) so a different staff member never replays someone else's queue. */
  owner: string;
  method: Method;
  path: string;
  body?: unknown;
  idempotencyKey: string;
  label: string;
  createdAt: string;
  attempts: number;
  status: OpStatus;
  error?: string;
  /** Server copy captured when a conflict was detected, shown in the resolution sheet. */
  serverState?: unknown;
  precondition?: Precondition;
}
export type Transport = (op: QueuedOp) => Promise<unknown>;
export type Reader = (product: Product, path: string) => Promise<Record<string, unknown>>;

const KEY = "kw-offline-queue-v1";
const MAX_ATTEMPTS = 6;
type Listener = () => void;

let ops: QueuedOp[] = [];
let loaded = false;
let flushing = false;
let lastSyncAt: string | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
const persist = () => prefs.set(KEY, JSON.stringify(ops));

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function loadQueue(): Promise<QueuedOp[]> {
  if (!loaded) {
    loaded = true;
    try { const raw = await prefs.get(KEY); ops = raw ? (JSON.parse(raw) as QueuedOp[]) : []; } catch { ops = []; }
    emit();
  }
  return ops;
}
export const subscribe = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getQueue = () => ops;
export const snapshot = () => ({
  total: ops.length,
  pending: ops.filter((o) => o.status === "pending").length,
  failed: ops.filter((o) => o.status === "failed").length,
  conflicts: ops.filter((o) => o.status === "conflict").length,
  syncing: flushing,
  lastSyncAt,
});

export async function enqueue(input: Omit<QueuedOp, "id" | "createdAt" | "attempts" | "status" | "idempotencyKey"> & { idempotencyKey?: string }): Promise<QueuedOp> {
  await loadQueue();
  const op: QueuedOp = { ...input, id: uid(), idempotencyKey: input.idempotencyKey ?? uid() + uid(), createdAt: new Date().toISOString(), attempts: 0, status: "pending" };
  ops = [...ops, op];
  await persist(); emit();
  return op;
}

const patchOp = (id: string, patch: Partial<QueuedOp>) => { ops = ops.map((o) => (o.id === id ? { ...o, ...patch } : o)); };
const remove = (id: string) => { ops = ops.filter((o) => o.id !== id); };

/** A server copy is newer than the base the user edited from => conflict (never silently overwrite clinical data). */
export const hasConflict = (pre: Precondition | undefined, server: Record<string, unknown> | null): boolean => {
  if (!pre || pre.base == null || !server) return false;
  const cur = server[pre.field ?? "updatedAt"];
  return cur != null && String(cur) !== String(pre.base);
};

/** Replays pending ops oldest-first for `owner`. Stops at a network failure (still offline). Per-op outcome:
 *  2xx -> removed; precondition mismatch / 409 -> `conflict`; other 4xx -> `failed` (needs the user); 5xx -> retry (attempts++). */
export async function flush(opts: { owner: string; send: Transport; read?: Reader }): Promise<{ sent: number; conflicts: number; failed: number; offline: boolean }> {
  await loadQueue();
  if (flushing) return { sent: 0, conflicts: 0, failed: 0, offline: false };
  flushing = true; emit();
  let sent = 0, conflicts = 0, failed = 0, offline = false;
  try {
    for (const op of [...ops]) {
      if (op.owner !== opts.owner || op.status !== "pending") continue;
      try {
        if (op.precondition && opts.read) {
          const server = await opts.read(op.product, op.precondition.path);
          if (hasConflict(op.precondition, server)) { patchOp(op.id, { status: "conflict", serverState: server, error: "SERVER_CHANGED" }); conflicts++; continue; }
        }
        await opts.send(op);
        remove(op.id); sent++;
      } catch (e) {
        const err = e as ApiError;
        if (err instanceof ApiError && err.isNetwork) { offline = true; break; }
        if (err instanceof ApiError && err.isConflict) { patchOp(op.id, { status: "conflict", serverState: err.details ?? null, error: err.code }); conflicts++; }
        else if (err instanceof ApiError && err.retryable) { const attempts = op.attempts + 1; patchOp(op.id, attempts >= MAX_ATTEMPTS ? { status: "failed", attempts, error: err.message } : { attempts, error: err.message }); if (attempts >= MAX_ATTEMPTS) failed++; }
        else { patchOp(op.id, { status: "failed", attempts: op.attempts + 1, error: (err as Error)?.message ?? "ERROR" }); failed++; }
      }
    }
    if (!offline) lastSyncAt = new Date().toISOString();
  } finally { flushing = false; await persist(); emit(); }
  return { sent, conflicts, failed, offline };
}

/** Conflict / failure resolution. keepMine = replay with a fresh base (user decided their edit wins; server copy is shown first), discard = drop it. */
export async function resolve(id: string, action: "keepMine" | "retry" | "discard") {
  await loadQueue();
  if (action === "discard") remove(id);
  else patchOp(id, { status: "pending", error: undefined, serverState: undefined, attempts: 0, precondition: undefined });
  await persist(); emit();
}
export async function clearOwner(owner?: string) { await loadQueue(); ops = owner ? ops.filter((o) => o.owner !== owner) : []; await persist(); emit(); }
export const __resetForTests = () => { ops = []; loaded = true; flushing = false; lastSyncAt = null; listeners.clear(); };
