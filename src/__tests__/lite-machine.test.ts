import { IDLE, REQUEST_WINDOW_MS, canSend, fromStored, reduce, settle, toStored, type ReqState } from "@/lite/machine";

const at = "2026-11-21T10:00:00.000Z";
const run = (s: ReqState, ...e: Parameters<typeof reduce>[1][]) => e.reduce(reduce, s);

describe("upgrade request state machine", () => {
  it("idle -> sending -> requested (with the server date)", () => {
    expect(run(IDLE, { type: "send" }, { type: "sent", at })).toEqual({ kind: "requested", at });
  });
  it("offline: sending -> queued, and the flush turns it into requested", () => {
    const q = run(IDLE, { type: "send" }, { type: "queued", at, opId: "op1" });
    expect(q).toEqual({ kind: "queued", at, opId: "op1" });
    expect(reduce(q, { type: "flushed", at: "2026-11-21T11:00:00.000Z" })).toEqual({ kind: "requested", at: "2026-11-21T11:00:00.000Z" });
  });
  it("failure -> error, which can be retried", () => {
    const e = run(IDLE, { type: "send" }, { type: "failed", message: "x" });
    expect(e.kind).toBe("error");
    expect(canSend(e)).toBe(true);
    expect(reduce(e, { type: "send" }).kind).toBe("sending");
  });
  it("cannot double-send while sending, queued or requested", () => {
    for (const s of [{ kind: "sending" }, { kind: "queued", at, opId: "o" }, { kind: "requested", at }] as ReqState[]) { expect(canSend(s)).toBe(false); expect(reduce(s, { type: "send" })).toBe(s); }
  });
  it("ignores out-of-order events", () => {
    expect(reduce(IDLE, { type: "sent", at })).toBe(IDLE);
    expect(reduce(IDLE, { type: "flushed", at })).toBe(IDLE);
    expect(reduce({ kind: "requested", at }, { type: "failed", message: "x" })).toEqual({ kind: "requested", at });
  });
  it("a request expires with the server's 24h de-dupe window", () => {
    const t0 = new Date(at).getTime();
    expect(settle({ kind: "requested", at }, t0 + REQUEST_WINDOW_MS - 1).kind).toBe("requested");
    expect(settle({ kind: "requested", at }, t0 + REQUEST_WINDOW_MS)).toEqual(IDLE);
    expect(settle({ kind: "queued", at, opId: "o" }, t0 + 10 * REQUEST_WINDOW_MS).kind).toBe("queued");
  });
  it("only durable states persist and round-trip", () => {
    expect(toStored({ kind: "sending" })).toBeNull();
    expect(toStored({ kind: "error", message: "x" })).toBeNull();
    for (const s of [{ kind: "requested", at }, { kind: "queued", at, opId: "o" }] as ReqState[]) expect(fromStored(toStored(s)!)).toEqual(s);
    expect(fromStored(undefined)).toEqual(IDLE);
  });
});
