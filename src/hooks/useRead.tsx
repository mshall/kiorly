import { useCallback, useEffect, useState } from "react";
import { RefreshControl } from "react-native";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { request, type ReqOpts } from "@/api/client";
import { ApiError } from "@/api/errors";
import type { Product } from "@/api/products";
import { prefs } from "@/lib/storage";
import { markOnline } from "@/offline/network";
import { useTheme } from "@/theme";
import * as queue from "@/offline/queue";

const cacheKey = (p: Product, path: string, q?: ReqOpts["query"]) => `kw-cache:${p}:${path}:${JSON.stringify(q ?? {})}`;
const MAX_CACHE_AGE_MS = 24 * 3600 * 1000;

export type ReadResult<T> = UseQueryResult<T, ApiError> & { fromCache: boolean; cachedAt: string | null };

/** Offline-first read: network first, fall back to the last saved copy when the device is offline (stale shown with `fromCache`). */
export function useRead<T = unknown>(product: Product, path: string, opts: { query?: ReqOpts["query"]; enabled?: boolean; refetchInterval?: number; staleTime?: number } = {}): ReadResult<T> {
  const [meta, setMeta] = useState<{ fromCache: boolean; cachedAt: string | null }>({ fromCache: false, cachedAt: null });
  const q = useQuery<T, ApiError>({
    queryKey: [product, path, opts.query ?? {}],
    enabled: opts.enabled ?? true,
    refetchInterval: opts.refetchInterval,
    staleTime: opts.staleTime,
    queryFn: async () => {
      const k = cacheKey(product, path, opts.query);
      try {
        const data = await request<T>(product, "GET", path, { query: opts.query });
        markOnline(true);
        setMeta({ fromCache: false, cachedAt: null });
        void prefs.set(k, JSON.stringify({ at: new Date().toISOString(), data }));
        return data;
      } catch (e) {
        if (e instanceof ApiError && e.isNetwork) {
          markOnline(false);
          const raw = await prefs.get(k);
          if (raw) {
            try {
              const c = JSON.parse(raw) as { at: string; data: T };
              if (Date.now() - new Date(c.at).getTime() < MAX_CACHE_AGE_MS) { setMeta({ fromCache: true, cachedAt: c.at }); return c.data; }
            } catch { /* ignore */ }
          }
        }
        throw e;
      }
    },
  });
  return Object.assign(q, meta) as ReadResult<T>;
}

export const clearReadCache = async () => { /* AsyncStorage keys are namespaced `kw-cache:`; wiped on sign-out via session clear */ };

/** Pull-to-refresh control bound to a query. */
export function usePullRefresh(q: { refetch: () => Promise<unknown>; isRefetching?: boolean }, extra?: () => Promise<unknown>) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const onRefresh = useCallback(async () => { setBusy(true); try { await Promise.all([q.refetch(), extra?.()]); } finally { setBusy(false); } }, [q, extra]);
  return <RefreshControl refreshing={busy} onRefresh={onRefresh} tintColor={colors.ink} colors={[colors.ink]} />;
}

export function useSyncStatus() {
  const [s, setS] = useState(queue.snapshot());
  useEffect(() => { void queue.loadQueue().then(() => setS(queue.snapshot())); return queue.subscribe(() => setS(queue.snapshot())); }, []);
  return s;
}
export function useQueue() {
  const [ops, setOps] = useState<queue.QueuedOp[]>(queue.getQueue());
  useEffect(() => { void queue.loadQueue().then(() => setOps([...queue.getQueue()])); return queue.subscribe(() => setOps([...queue.getQueue()])); }, []);
  return ops;
}
