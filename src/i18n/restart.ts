import { DevSettings, Platform } from "react-native";
import Constants from "expo-constants";
import { useSyncExternalStore } from "react";
import { prefs } from "@/lib/storage";

/**
 * Layout-direction restart. `I18nManager.forceRTL()` only takes effect after a JS reload, so after the first Arabic launch (or a language switch) the app must reload.
 *  - Real build (dev client / store build): reload in place with `reloadAppAsync` from the `expo` core package (no extra native module).
 *  - Expo Go (executionEnvironment "storeClient"): reloading is not what we want to promise there, so show a one-time "close and reopen" banner instead.
 * The native module is required lazily inside try/catch and never imported at module top level: a missing native module must never crash startup (an earlier
 * `expo-updates` attempt did exactly that in Expo Go).
 */
export type RestartOutcome = "reloaded" | "manual";

const LOOP_KEY = "kw-rtl-reload-at";
const BANNER_KEY = "kw-rtl-banner-seen";
const LOOP_GUARD_MS = 60_000;

/**
 * Expo Go detection. `Constants.executionEnvironment === "storeClient"` is the documented signal, but Expo Go SDK 58 on Android reports "bare" there (seen on the emulator:
 * the reload then silently did nothing and no banner was shown), so also ask the `expo` core package whether the Expo Go native module is present.
 */
export const isExpoGo = (): boolean => {
  if (Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo") return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo") as { isRunningInExpoGo?: () => boolean };
    return typeof mod.isRunningInExpoGo === "function" && mod.isRunningInExpoGo();
  } catch { return false; }
};

/** Pure: true when we may attempt another automatic reload (never twice within a minute: protects against a reload loop if RTL does not stick). */
export const canAutoReload = (lastAt: number | null, now = Date.now()): boolean => lastAt == null || Number.isNaN(lastAt) || now - lastAt > LOOP_GUARD_MS;

async function tryReload(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo") as { reloadAppAsync?: (reason?: string) => Promise<void> };
    if (typeof mod.reloadAppAsync === "function") { await mod.reloadAppAsync("Layout direction changed"); return true; }
  } catch { /* native module absent: fall through */ }
  try { if (__DEV__ && DevSettings?.reload) { DevSettings.reload(); return true; } } catch { /* ignore */ }
  return false;
}

// ---- banner state (shown in Expo Go / when reload is impossible) ----
let showBanner = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const useDirectionBanner = (): boolean => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => showBanner, () => false);
export function dismissDirectionBanner() { showBanner = false; emit(); }
export const __resetRestartForTests = () => { showBanner = false; listeners.clear(); };

/**
 * Call when `applyDirection` / `bootstrapI18n` reported `needsRestart`. Resolves to "reloaded" (the app is about to restart) or "manual"
 * (the person must close and reopen; a banner is raised once per install).
 */
export async function handleRestart(opts: { force?: boolean } = {}): Promise<RestartOutcome> {
  if (Platform.OS === "web") return "reloaded";
  if (!isExpoGo()) {
    const last = Number(await prefs.get(LOOP_KEY)) || null;
    if (canAutoReload(last)) {
      await prefs.set(LOOP_KEY, String(Date.now()));
      if (await tryReload()) return "reloaded";
    }
  }
  if (opts.force || (await prefs.get(BANNER_KEY)) !== "1") {
    await prefs.set(BANNER_KEY, "1");
    showBanner = true; emit();
  }
  return "manual";
}
