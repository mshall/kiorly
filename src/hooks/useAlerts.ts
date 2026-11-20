import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Product } from "@/api/products";
import type { InboxItem, SafetyAlert } from "@/api/types";
import { useSessions } from "@/auth/SessionProvider";

export interface ProductAlert extends SafetyAlert { product: Product }
export interface ProductMessage extends InboxItem { product: Product }

/** Safety alerts: every connected product, every plan (ADR-025: never behind the entitlement). Polled so a push-less device still sees them quickly. */
export function useAlerts(status: "open" | "all" = "open") {
  const { products } = useSessions();
  const results = useQueries({
    queries: products.map((p) => ({
      queryKey: [p, "/mobile/alerts", status],
      queryFn: async () => (await api.get<{ items: SafetyAlert[] }>(p, "/mobile/alerts", { query: { status } })).items.map((a) => ({ ...a, product: p }) as ProductAlert),
      refetchInterval: 30_000,
      retry: 1,
    })),
  });
  const items = results.flatMap((r) => r.data ?? []).sort((a, b) => (a.ackedAt ? 1 : 0) - (b.ackedAt ? 1 : 0) || sev(a.severity) - sev(b.severity) || +new Date(b.raisedAt) - +new Date(a.raisedAt));
  const openCount = items.filter((a) => !a.ackedAt).length;
  return { items, openCount, isLoading: results.some((r) => r.isLoading), refetch: () => Promise.all(results.map((r) => r.refetch())), isError: results.every((r) => r.isError) && results.length > 0 };
}
const sev = (s: string) => (s === "CRITICAL" ? 0 : s === "HIGH" ? 1 : 2);

export function useAckAlert() {
  const qc = useQueryClient();
  return async (a: ProductAlert, note?: string) => {
    await api.post(a.product, `/mobile/alerts/${encodeURIComponent(a.id)}/ack`, note ? { note } : {});
    await qc.invalidateQueries({ queryKey: [a.product, "/mobile/alerts"] });
  };
}

/** In-app inbox (mock push provider). Only for entitled products (the product returns 403 otherwise). */
export function useMessages() {
  const { products, isEntitled } = useSessions();
  const entitled = products.filter((p) => isEntitled(p));
  const results = useQueries({
    queries: entitled.map((p) => ({
      queryKey: [p, "/mobile/inbox"],
      queryFn: async () => (await api.get<{ items: InboxItem[]; unread: number }>(p, "/mobile/inbox", { query: { limit: 40 } })),
      refetchInterval: 30_000,
      retry: 1,
    })),
  });
  const items: ProductMessage[] = results.flatMap((r, i) => (r.data?.items ?? []).map((m) => ({ ...m, product: entitled[i] }))).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const unread = results.reduce((n, r) => n + (r.data?.unread ?? 0), 0);
  return { items, unread, isLoading: results.some((r) => r.isLoading), refetch: () => Promise.all(results.map((r) => r.refetch())), entitled };
}

export function useUnreadBadge() {
  const a = useAlerts("open");
  const m = useMessages();
  return a.openCount + m.unread;
}
export { useQuery };
