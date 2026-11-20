import { ApiError } from "@/api/errors";
import * as q from "@/offline/queue";

jest.mock("@/lib/storage", () => ({ prefs: { get: jest.fn(async () => null), set: jest.fn(async () => {}) }, secureStore: { get: jest.fn(), set: jest.fn(), remove: jest.fn() } }));

const base = { product: "clinic" as const, owner: "a@x.test", method: "PATCH" as const, path: "/encounters/e1", body: { plan: "rest" }, label: "Visit note" };
beforeEach(() => q.__resetForTests());

describe("offline queue", () => {
  test("enqueue persists in order with an idempotency key", async () => {
    const a = await q.enqueue(base); const b = await q.enqueue({ ...base, label: "second" });
    expect(q.getQueue().map((o) => o.id)).toEqual([a.id, b.id]);
    expect(a.idempotencyKey.length).toBeGreaterThan(10);
    expect(q.snapshot().pending).toBe(2);
  });
  test("flush sends oldest first and removes on success", async () => {
    await q.enqueue(base); await q.enqueue({ ...base, label: "two" });
    const order: string[] = [];
    const r = await q.flush({ owner: base.owner, send: async (op) => { order.push(op.label); return {}; } });
    expect(order).toEqual(["Visit note", "two"]); expect(r.sent).toBe(2); expect(q.getQueue()).toHaveLength(0); expect(q.snapshot().lastSyncAt).not.toBeNull();
  });
  test("a network failure stops the flush and keeps the op pending", async () => {
    await q.enqueue(base); await q.enqueue({ ...base, label: "two" });
    const r = await q.flush({ owner: base.owner, send: async () => { throw new ApiError(0, "NETWORK", "offline"); } });
    expect(r.offline).toBe(true); expect(q.getQueue().map((o) => o.status)).toEqual(["pending", "pending"]);
  });
  test("a changed server copy is a conflict and is never overwritten", async () => {
    await q.enqueue({ ...base, precondition: { path: "/encounters/e1", base: "2026-11-20T08:00:00Z" } });
    const send = jest.fn();
    const r = await q.flush({ owner: base.owner, send, read: async () => ({ updatedAt: "2026-11-20T09:30:00Z", plan: "theirs" }) });
    expect(send).not.toHaveBeenCalled(); expect(r.conflicts).toBe(1);
    const op = q.getQueue()[0]; expect(op.status).toBe("conflict"); expect((op.serverState as { plan: string }).plan).toBe("theirs");
  });
  test("keepMine requeues without the precondition, discard drops", async () => {
    const op = await q.enqueue({ ...base, precondition: { path: "/encounters/e1", base: "x" } });
    await q.flush({ owner: base.owner, send: jest.fn(), read: async () => ({ updatedAt: "y" }) });
    await q.resolve(op.id, "keepMine");
    expect(q.getQueue()[0]).toMatchObject({ status: "pending", precondition: undefined });
    await q.resolve(op.id, "discard"); expect(q.getQueue()).toHaveLength(0);
  });
  test("409 from the server becomes a conflict, 4xx a failure, 5xx retries up to the limit", async () => {
    await q.enqueue(base); await q.enqueue({ ...base, label: "bad" });
    await q.flush({ owner: base.owner, send: async (op) => { throw op.label === "bad" ? new ApiError(422, "VALIDATION", "no") : new ApiError(409, "CONFLICT", "changed"); } });
    expect(q.getQueue().map((o) => o.status)).toEqual(["conflict", "failed"]);
    await q.clearOwner(); await q.enqueue(base);
    for (let i = 0; i < 6; i++) await q.flush({ owner: base.owner, send: async () => { throw new ApiError(503, "DOWN", "down"); } });
    expect(q.getQueue()[0].status).toBe("failed");
  });
  test("never replays another user's queue", async () => {
    await q.enqueue({ ...base, owner: "other@x.test" });
    const send = jest.fn(); await q.flush({ owner: base.owner, send });
    expect(send).not.toHaveBeenCalled();
  });
  test("hasConflict rules", () => {
    expect(q.hasConflict(undefined, { updatedAt: "1" })).toBe(false);
    expect(q.hasConflict({ path: "p", base: null }, { updatedAt: "1" })).toBe(false);
    expect(q.hasConflict({ path: "p", base: "1" }, { updatedAt: "1" })).toBe(false);
    expect(q.hasConflict({ path: "p", base: "1" }, { updatedAt: "2" })).toBe(true);
  });
});
