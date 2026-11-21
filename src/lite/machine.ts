/** Upgrade-request button state machine (pure). idle -> sending -> requested | queued (offline) | error. */
export const REQUEST_WINDOW_MS = 24 * 3_600_000;

export type ReqState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "requested"; at: string }
  | { kind: "queued"; at: string; opId: string }
  | { kind: "error"; message: string };

export type ReqEvent =
  | { type: "send" }
  | { type: "sent"; at: string }
  | { type: "queued"; at: string; opId: string }
  | { type: "failed"; message: string }
  | { type: "flushed"; at: string }
  | { type: "reset" };

export const IDLE: ReqState = { kind: "idle" };

export function reduce(s: ReqState, e: ReqEvent): ReqState {
  switch (e.type) {
    case "send": return s.kind === "idle" || s.kind === "error" ? { kind: "sending" } : s; // no double-send while sending/requested/queued
    case "sent": return s.kind === "sending" ? { kind: "requested", at: e.at } : s;
    case "queued": return s.kind === "sending" ? { kind: "queued", at: e.at, opId: e.opId } : s;
    case "failed": return s.kind === "sending" ? { kind: "error", message: e.message } : s;
    case "flushed": return s.kind === "queued" ? { kind: "requested", at: e.at } : s;
    case "reset": return IDLE;
  }
}

/** A request older than the server's 24h de-dupe window no longer counts: the person may ask again. */
export const settle = (s: ReqState, now = Date.now()): ReqState => (s.kind === "requested" && now - new Date(s.at).getTime() >= REQUEST_WINDOW_MS ? IDLE : s);

export const canSend = (s: ReqState) => s.kind === "idle" || s.kind === "error";

/** Persisted shape (only the settled, durable states survive an app restart). */
export interface StoredRequest { status: "requested" | "queued"; at: string; opId?: string }
export const toStored = (s: ReqState): StoredRequest | null => (s.kind === "requested" ? { status: "requested", at: s.at } : s.kind === "queued" ? { status: "queued", at: s.at, opId: s.opId } : null);
export const fromStored = (r: StoredRequest | undefined): ReqState => (!r ? IDLE : r.status === "requested" ? { kind: "requested", at: r.at } : { kind: "queued", at: r.at, opId: r.opId ?? "" });
