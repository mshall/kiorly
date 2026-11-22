import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useSessions } from "@/auth/SessionProvider";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { registerPush, installNotificationTapHandler, installForegroundHandler, recordSeen } from "@/lib/push";
import { routeForNotification } from "@/lib/notifications";
import { useMessages, useAlerts, useUnreadBadge } from "./useAlerts";
import { useToast } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import { useTranslation } from "react-i18next";

/** Registers the device for (mock) push, taps -> deep link, and "foreground push": a new SAFETY item in the polled inbox raises a banner + haptic. */
export function NotificationDriver() {
  const { sessions, products } = useSessions();
  const router = useRouter();
  const toast = useToast();
  const { i18n } = useTranslation();
  const msgs = useMessages();
  const alerts = useAlerts("open");
  const seen = useRef<Set<string> | null>(null);

  const registered = useRef<Set<string>>(new Set());
  const deviceKey = products.map((p) => `${p}:${sessions[p]?.deviceRecordId ?? ""}`).join("|");
  useEffect(() => {
    for (const p of products) {
      const s = sessions[p];
      if (!s?.deviceRecordId) continue;
      const k = `${p}:${s.deviceRecordId}`;
      if (registered.current.has(k)) continue;
      registered.current.add(k);
      void registerPush(p, s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceKey]);
  const qc = useQueryClient();
  const badge = useUnreadBadge();
  // Tap (running, backgrounded or cold start) -> the same router for remote and locally simulated notifications.
  useEffect(() => installNotificationTapHandler((data) => { const r = routeForNotification(data, products[0]); recordSeen({ kind: "tapped", title: "", data, route: r, at: Date.now() }); if (r) router.push(r as never); }), [products, router]);
  // Foreground delivery: haptic + refresh inbox/alerts so the badge and lists update without waiting for the 30 s poll.
  useEffect(() => installForegroundHandler((title, data) => {
    haptic.warn();
    recordSeen({ kind: "received", title, data, route: routeForNotification(data, products[0]), at: Date.now() });
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === "/mobile/inbox" || q.queryKey[1] === "/mobile/alerts" });
  }), [products, qc]);
  // App-icon badge = unread inbox + open alerts.
  useEffect(() => { if (Platform.OS !== "web") void Notifications.setBadgeCountAsync(badge).catch(() => {}); }, [badge]);

  useEffect(() => {
    const ids = new Set<string>([...msgs.items.map((m) => `m:${m.id}`), ...alerts.items.map((a) => `a:${a.id}`)]);
    if (seen.current == null) { if (!msgs.items.length && !alerts.items.length) return; seen.current = ids; return; }
    const fresh = [...alerts.items.filter((a) => !a.ackedAt && !seen.current!.has(`a:${a.id}`)), ...msgs.items.filter((m) => !m.readAt && !seen.current!.has(`m:${m.id}`))];
    if (fresh.length) {
      const f = fresh[0]; const ar = i18n.language.startsWith("ar");
      haptic.warn();
      toast.show(ar ? (f.titleAr ?? f.title) : f.title, "info");
    }
    seen.current = ids;
  }, [msgs.items, alerts.items, i18n.language, toast]);
  return null;
}
