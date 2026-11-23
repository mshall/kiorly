import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useTranslation } from "react-i18next";
import { prefs } from "@/lib/storage";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { Button, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { KiorexMark } from "@/components/Logo";

const K_ENABLED = "kw-lock-enabled";
const K_GRACE = "kw-lock-grace-s";
export const DEFAULT_GRACE_S = 30;

/** Pure rule (unit-tested): lock when the app returns from background after more than `graceS` seconds. */
export const shouldLock = (enabled: boolean, backgroundedAt: number | null, now: number, graceS: number) =>
  enabled && backgroundedAt != null && now - backgroundedAt >= graceS * 1000;

export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch { return false; }
}

interface Ctx { enabled: boolean; available: boolean; locked: boolean; graceS: number; setEnabled: (v: boolean) => Promise<boolean>; setGrace: (s: number) => void; unlock: () => Promise<boolean>; lockNow: () => void }
const LockCtx = createContext<Ctx>({ enabled: false, available: false, locked: false, graceS: DEFAULT_GRACE_S, setEnabled: async () => false, setGrace: () => {}, unlock: async () => false, lockNow: () => {} });
export const useLock = () => useContext(LockCtx);

export function LockProvider({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [graceS, setGraceS] = useState(DEFAULT_GRACE_S);
  const bgAt = useRef<number | null>(null);
  const enabledRef = useRef(false); enabledRef.current = enabled;
  const graceRef = useRef(DEFAULT_GRACE_S); graceRef.current = graceS;

  useEffect(() => {
    void (async () => {
      const [e, g, a] = await Promise.all([prefs.get(K_ENABLED), prefs.get(K_GRACE), biometricsAvailable()]);
      setAvailable(a);
      if (g) setGraceS(Number(g) || DEFAULT_GRACE_S);
      if (e === "1" && a) { setEnabledState(true); setLocked(true); } // cold start is always locked
    })();
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background" || s === "inactive") { if (bgAt.current == null) bgAt.current = Date.now(); }
      else if (s === "active") { if (shouldLock(enabledRef.current, bgAt.current, Date.now(), graceRef.current)) setLocked(true); bgAt.current = null; }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Kiorly", cancelLabel: "Cancel", disableDeviceFallback: false });
      if (r.success) { haptic.success(); setLocked(false); return true; }
    } catch { /* fall through */ }
    haptic.error(); return false;
  }, []);
  const setEnabled = useCallback(async (v: boolean) => {
    if (v) {
      if (!(await biometricsAvailable())) return false;
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Kiorly" }).catch(() => ({ success: false }));
      if (!r.success) return false;
    }
    setEnabledState(v); await prefs.set(K_ENABLED, v ? "1" : "0"); return true;
  }, []);
  const setGrace = useCallback((s: number) => { setGraceS(s); void prefs.set(K_GRACE, String(s)); }, []);
  const value = useMemo(() => ({ enabled, available, locked: locked && signedIn, graceS, setEnabled, setGrace, unlock, lockNow: () => { if (enabledRef.current) setLocked(true); } }), [enabled, available, locked, signedIn, graceS, setEnabled, setGrace, unlock]);
  return <LockCtx.Provider value={value}>{children}</LockCtx.Provider>;
}

/** Full-screen cover: nothing behind it is readable (also used as the app-switcher privacy cover state). */
export function LockScreen() {
  const { locked, unlock } = useLock();
  const { colors } = useTheme();
  const { t } = useTranslation();
  useEffect(() => { if (locked) void unlock(); }, [locked, unlock]);
  if (!locked) return null;
  return (
    <View testID="lock-screen" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ground, zIndex: 2000, alignItems: "center", justifyContent: "center", gap: 18, padding: 24 }]} accessibilityViewIsModal>
      <KiorexMark width={84} />
      <T variant="title" style={{ textAlign: "center" }}>{t("lock.title")}</T>
      <T muted style={{ textAlign: "center" }}>{t("lock.body")}</T>
      <Pressable onPress={() => void unlock()} accessibilityRole="button" accessibilityLabel={t("lock.unlock")} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}>
        <Icon name="shield" size={32} color={colors.ink} />
      </Pressable>
      <Button title={t("lock.unlock")} onPress={() => void unlock()} />
    </View>
  );
}
