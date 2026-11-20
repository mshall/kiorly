import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "@/api/client";
import type { Product } from "@/api/products";
import type { Session } from "@/api/types";

/** Push registration. Providers are mocked (CLAUDE.md): the API stores a mock push row = in-app inbox; on a real build the Expo token is sent with provider "expo"
 *  (go-live task in each product's Docs/NEEDS_HUMAN.md). On web / simulators we register a deterministic mock token so the full path is exercised. */
export const mockToken = (deviceId: string) => `mock-${deviceId}`;

export async function registerPush(product: Product, s: Session): Promise<"registered" | "mock" | "skipped"> {
  if (!s.deviceRecordId) return "skipped";
  let token = mockToken(s.deviceId); let provider: "expo" | "mock" = "mock";
  if (Platform.OS !== "web") {
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (perm.granted) { const t = await Notifications.getExpoPushTokenAsync(); token = t.data; provider = "expo"; }
    } catch { /* simulator without push: stay on the mock token */ }
  }
  try { await api.put(product, `/mobile/devices/${s.deviceRecordId}/push-token`, { token, provider }); } catch { return "skipped"; }
  return provider === "expo" ? "registered" : "mock";
}

/** Maps a tapped notification to a route (data comes from the product push `data` object). */
export function installNotificationTapHandler(go: (data: Record<string, unknown> | undefined, product?: Product) => void) {
  if (Platform.OS === "web") return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => go(r.notification.request.content.data as Record<string, unknown> | undefined));
  return () => sub.remove();
}

try {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }) });
} catch { /* web */ }
