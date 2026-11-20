import { api, request, type Method } from "@/api/client";
import { ApiError } from "@/api/errors";
import type { Product } from "@/api/products";
import { enqueue, flush, uid, type Precondition } from "./queue";
import { markOnline } from "./network";

export interface MutateOpts {
  label: string;
  owner: string;
  /** Safe to defer while offline. Money / dispensing / sign-off paths stay online-only (Docs/OFFLINE_SYNC.md). */
  queueable?: boolean;
  precondition?: Precondition;
  idempotencyKey?: string;
}
export type MutateResult<T> = { queued: false; data: T } | { queued: true; opId: string };

/** Send now; if the device is offline and the write is queueable, persist it and report `queued`. */
export async function mutate<T = unknown>(product: Product, method: Method, path: string, body: unknown, o: MutateOpts): Promise<MutateResult<T>> {
  const idempotencyKey = o.idempotencyKey ?? uid() + uid();
  try {
    const data = await request<T>(product, method, path, { body: body ?? {}, idempotencyKey });
    markOnline(true);
    return { queued: false, data };
  } catch (e) {
    if (e instanceof ApiError && e.isNetwork) {
      markOnline(false);
      if (o.queueable) {
        const op = await enqueue({ product, owner: o.owner, method, path, body, label: o.label, precondition: o.precondition, idempotencyKey });
        return { queued: true, opId: op.id };
      }
    }
    throw e;
  }
}

/** Production transport + reader for flush(). */
export const syncNow = (owner: string) => flush({
  owner,
  send: (op) => request(op.product, op.method, op.path, { body: op.body ?? {}, idempotencyKey: op.idempotencyKey }),
  read: (product, path) => api.get<Record<string, unknown>>(product, path),
});
