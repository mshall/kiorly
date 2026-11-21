import { Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { prefs } from "@/lib/storage";
import { registerPush } from "@/lib/push";
import { useSessions } from "@/auth/SessionProvider";

/**
 * Notification permission, asked in context. The app never raises the OS prompt on its own: a short in-app explainer (`PushPrimer`) appears once after the first useful
 * screen; "Not now" is remembered for 14 days; Me > Notifications can enable it later. Nothing here blocks the app.
 */
export type PushStatus = "granted" | "undetermined" | "denied" | "unsupported";

export const SNOOZE_MS = 14 * 24 * 3_600_000;
const KEY = "kw-push-prompt-v1";
export interface PrimerState { shownAt?: number; snoozedAt?: number; decided?: "granted" | "denied" }

/** Pure rule (unit-tested): ask only when the OS has not been asked, we never asked/decided, and any "Not now" is older than 14 days. */
export function shouldShowPrimer(status: PushStatus, st: PrimerState, now = Date.now()): boolean {
  if (status !== "undetermined" || st.decided) return false;
  if (st.snoozedAt != null && now - st.snoozedAt < SNOOZE_MS) return false;
  return true;
}

export async function loadPrimer(): Promise<PrimerState> {
  try { const raw = await prefs.get(KEY); return raw ? (JSON.parse(raw) as PrimerState) : {}; } catch { return {}; }
}
export async function savePrimer(patch: PrimerState): Promise<PrimerState> {
  const next = { ...(await loadPrimer()), ...patch };
  await prefs.set(KEY, JSON.stringify(next));
  return next;
}
export const snoozePrimer = (now = Date.now()) => savePrimer({ snoozedAt: now, shownAt: now });

export async function readPushStatus(): Promise<PushStatus> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return "granted";
    // Android (and Expo Go) report "denied" before the first ask while `canAskAgain` is still true: that is "not asked yet" for our purposes. Truly blocked = cannot ask again.
    return p.status === "undetermined" || p.canAskAgain ? "undetermined" : "denied";
  } catch { return "unsupported"; }
}

/** Raises the OS prompt (only call from an explicit tap). */
export async function requestPushPermission(): Promise<PushStatus> {
  try {
    const p = await Notifications.requestPermissionsAsync();
    return p.granted ? "granted" : "denied";
  } catch { return "unsupported"; }
}

/** Permission status + actions for the primer and Me > Notifications. */
export function usePushPermission() {
  const { sessions, products } = useSessions();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const refresh = useCallback(async () => { const s = await readPushStatus(); setStatus(s); return s; }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const registerAll = useCallback(async () => { for (const p of products) { const s = sessions[p]; if (s) await registerPush(p, s); } }, [products, sessions]);

  /** Ask the OS (undetermined) or send the person to system settings (already denied). Registers the real token once granted. */
  const enable = useCallback(async (): Promise<PushStatus> => {
    const cur = await readPushStatus();
    if (cur === "denied") { try { await Linking.openSettings(); } catch { /* ignore */ } return cur; }
    if (cur !== "undetermined") return cur;
    const next = await requestPushPermission();
    await savePrimer({ decided: next === "granted" ? "granted" : "denied" });
    setStatus(next);
    if (next === "granted") await registerAll();
    return next;
  }, [registerAll]);

  const openSettings = useCallback(async () => { try { await Linking.openSettings(); } catch { /* ignore */ } }, []);
  return { status, refresh, enable, openSettings };
}
