import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useSyncExternalStore } from "react";
import { api } from "@/api/client";
import type { Product } from "@/api/products";
import type { Session } from "@/api/types";
import { makeTapDeduper, type TestNotification } from "@/lib/notifications";

/** Push registration. Providers are mocked (CLAUDE.md): the API stores a mock push row = in-app inbox; on a real build the Expo token is sent with provider "expo"
 *  (go-live task in each product's Docs/NEEDS_HUMAN.md). On web / simulators we register a deterministic mock token so the full path is exercised. */
/** EAS project id (set by `eas init` into app.json `extra.eas.projectId`). Without it Expo cannot mint a push token: we stay on the mock token and say why. */
export const getProjectId = (): string | null => {
  const c = Constants as unknown as { expoConfig?: { extra?: { eas?: { projectId?: string } } }; easConfig?: { projectId?: string } };
  return c.expoConfig?.extra?.eas?.projectId ?? c.easConfig?.projectId ?? null;
};

export type PushReason = "ok" | "no-project-id" | "no-permission" | "simulator" | "error" | "web" | "pending";
export interface PushDiag { provider: "expo" | "mock"; reason: PushReason; token: string | null; message: string }
let diag: PushDiag = { provider: "mock", reason: "pending", token: null, message: "" };
const diagListeners = new Set<() => void>();
const setDiag = (d: PushDiag) => { diag = d; diagListeners.forEach((l) => l()); };
export const usePushDiag = (): PushDiag => useSyncExternalStore((l) => { diagListeners.add(l); return () => { diagListeners.delete(l); }; }, () => diag, () => diag);
export const MSG_NO_PROJECT = "Real push needs an EAS projectId (run `eas init`) plus an APNs key / FCM credentials uploaded to EAS. Using the mock token so the in-app inbox still works.";

export const mockToken = (deviceId: string) => `mock-${deviceId}`;

/** Registers the device's push token. NEVER prompts: it only reads the current permission; the OS prompt is raised by `requestPushPermission()` after our own explainer (see `src/lib/pushPermission.ts`). */
export async function registerPush(product: Product, s: Session): Promise<"registered" | "mock" | "skipped"> {
  if (!s.deviceRecordId) return "skipped";
  let token = mockToken(s.deviceId); let provider: "expo" | "mock" = "mock";
  let d: PushDiag = { provider: "mock", reason: Platform.OS === "web" ? "web" : "pending", token, message: "" };
  if (Platform.OS !== "web") {
    try {
      const perm = await Notifications.getPermissionsAsync();
      const projectId = getProjectId();
      if (!perm.granted) d = { ...d, reason: "no-permission", message: "Notification permission not granted yet." };
      else if (!projectId) { d = { ...d, reason: "no-project-id", message: MSG_NO_PROJECT }; console.warn(`[push] ${MSG_NO_PROJECT}`); }
      else { const t = await Notifications.getExpoPushTokenAsync({ projectId }); token = t.data; provider = "expo"; d = { provider, reason: "ok", token, message: "" }; }
    } catch (e) { d = { ...d, reason: Device.isDevice ? "error" : "simulator", message: Device.isDevice ? String((e as Error)?.message ?? e) : "Simulators cannot get a remote push token." }; /* stay on the mock token */ }
  }
  setDiag(d);
  try { await api.put(product, `/mobile/devices/${s.deviceRecordId}/push-token`, { token, provider }); } catch { return "skipped"; }
  return provider === "expo" ? "registered" : "mock";
}

/** Last notification the app saw (dev panel / tests): `received` in the foreground, `tapped` when a person opened it. */
export interface SeenNotification { kind: "received" | "tapped"; title: string; data: Record<string, unknown> | undefined; route: string | null; at: number }
let seen: SeenNotification | null = null;
const seenListeners = new Set<() => void>();
export const recordSeen = (n: SeenNotification) => { seen = n; seenListeners.forEach((l) => l()); };
export const useLastSeen = (): SeenNotification | null => useSyncExternalStore((l) => { seenListeners.add(l); return () => { seenListeners.delete(l); }; }, () => seen, () => seen);

/** Maps a tapped notification to a route. Covers a tap while running/backgrounded (listener) and a cold start from a tap (last response), once each. */
export function installNotificationTapHandler(go: (data: Record<string, unknown> | undefined, product?: Product) => void) {
  if (Platform.OS === "web") return () => {};
  const fresh = makeTapDeduper();
  const handle = (r: Notifications.NotificationResponse | null | undefined) => {
    if (!r || !fresh(r.notification.request.identifier + ":" + r.actionIdentifier + ":" + r.notification.date)) return;
    go(r.notification.request.content.data as Record<string, unknown> | undefined);
  };
  try { handle(Notifications.getLastNotificationResponse?.()); } catch { /* ignore */ }
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

/** Foreground delivery: the OS banner is shown (handler below); this lets the app refresh its inbox / badge and give a haptic. */
export function installForegroundHandler(onReceived: (title: string, data: Record<string, unknown> | undefined) => void) {
  if (Platform.OS === "web") return () => {};
  const sub = Notifications.addNotificationReceivedListener((n) => onReceived(n.request.content.title ?? "", n.request.content.data as Record<string, unknown> | undefined));
  return () => sub.remove();
}

/** DEV ONLY: schedules a LOCAL notification that travels the same listener / router path as a remote one. */
export async function scheduleTestNotification(n: TestNotification, lang: string, seconds = 3): Promise<void> {
  const ar = lang.startsWith("ar");
  await Notifications.scheduleNotificationAsync({
    content: { title: ar ? n.titleAr : n.titleEn, body: ar ? n.bodyAr : n.bodyEn, data: n.data, sound: false },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: "default" },
  });
}

try {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }) });
} catch { /* web */ }
if (Platform.OS === "android") void Notifications.setNotificationChannelAsync("default", { name: "Default", importance: Notifications.AndroidImportance.MAX }).catch(() => {});
