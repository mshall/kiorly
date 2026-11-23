import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import { prefs } from "@/lib/storage";

// Kiorex design tokens: vendored from _brand (src/brand/theme.ts, generated from tokens.json). Indigo primary, Ocean secondary, coral Pulse accent only.
import { colorsFor, shadow as brandShadow, theme as brand } from "@/brand/theme";

export interface Palette {
  ink: string; ink2: string; pulse: string; ground: string; surface: string; text: string; muted: string; border: string;
  onInk: string; onDanger: string; soft: string; danger: string; dangerSoft: string; success: string; successSoft: string; warning: string; warningSoft: string; overlay: string;
  raised: string; subtle: string; hairline: string; borderStrong: string; subtleText: string; pulseSoft: string; info: string; infoSoft: string; inkHover: string;
}
const build = (scheme: "light" | "dark"): Palette => {
  const c = colorsFor(scheme);
  return {
    ink: c.primary, ink2: c.secondary, pulse: c.accent, ground: c.bg, surface: c.surface, text: c.text, muted: c.textMuted, border: c.border,
    onInk: c.onPrimary, onDanger: scheme === "dark" ? "#2A0A0A" : "#FFFFFF", soft: c.primarySoft, danger: c.danger, dangerSoft: c.dangerSoft,
    success: c.success, successSoft: c.successSoft, warning: c.warning, warningSoft: c.warningSoft, overlay: c.overlay,
    raised: c.surfaceRaised, subtle: c.bgSubtle, hairline: c.hairline, borderStrong: c.borderStrong, subtleText: c.textSubtle, pulseSoft: c.accentSoft, info: c.info, infoSoft: c.infoSoft, inkHover: c.primaryHover,
  };
};
export const light: Palette = build("light");
export const dark: Palette = build("dark");
export const elevation = (level: 0 | 1 | 2 | 3 | 4, scheme: "light" | "dark" = "light") => brandShadow(level, scheme);
export const motion = { fast: brand.motion.duration.fast, base: brand.motion.duration.base, slow: brand.motion.duration.slow, pulse: brand.motion.duration.pulse };
export const radius = 14;
export const radiusLg = 20;
export const MIN_TOUCH = 44;

export type ThemePref = "system" | "light" | "dark";
/** LIGHT is the default theme (founder, 24 Nov 2026), never "follow the system". Only an explicit Light / Dark / System choice is stored and restored. */
export const DEFAULT_THEME_PREF: ThemePref = "light";
export const THEME_KEY = "kx-theme";
export const parseThemePref = (v: unknown): ThemePref | null => (v === "light" || v === "dark" || v === "system" ? v : null);
/** Expo web: AsyncStorage is localStorage, so the stored choice is read synchronously and the first paint already has the right theme. Native restores it asynchronously behind the splash. */
const initialPref = (): ThemePref => {
  if (Platform.OS === "web") { try { return parseThemePref(globalThis.localStorage?.getItem(THEME_KEY)) ?? DEFAULT_THEME_PREF; } catch { /* storage blocked */ } }
  return DEFAULT_THEME_PREF;
};
interface Ctx { colors: Palette; scheme: "light" | "dark"; pref: ThemePref; setPref: (p: ThemePref) => void }
const ThemeCtx = createContext<Ctx>({ colors: light, scheme: "light", pref: DEFAULT_THEME_PREF, setPref: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>(initialPref);
  useEffect(() => { void prefs.get(THEME_KEY).then((v) => { const p = parseThemePref(v); if (p) setPrefState(p); }); }, []);
  // native chrome (keyboard, alerts, status bar defaults) follows the chosen theme; "system" hands control back to the OS
  useEffect(() => { try { Appearance.setColorScheme?.(pref === "system" ? "unspecified" : pref); } catch { /* not supported */ } }, [pref]);
  const setPref = useCallback((p: ThemePref) => { setPrefState(p); void prefs.set(THEME_KEY, p); }, []);
  const scheme = pref === "system" ? (system === "dark" ? "dark" : "light") : pref;
  const value = useMemo(() => ({ colors: scheme === "dark" ? dark : light, scheme, pref, setPref }), [scheme, pref, setPref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/** Font family per language: Jost for Latin UI, IBM Plex Sans Arabic for Arabic (it also carries Latin glyphs). */
export type Weight = "regular" | "medium" | "semibold" | "bold";
export const fontFamily = (lang: string, w: Weight) => {
  const ar = { regular: "IBMPlexSansArabic_400Regular", medium: "IBMPlexSansArabic_500Medium", semibold: "IBMPlexSansArabic_600SemiBold", bold: "IBMPlexSansArabic_700Bold" };
  const en = { regular: "Jost_400Regular", medium: "Jost_500Medium", semibold: "Jost_600SemiBold", bold: "Jost_700Bold" };
  return (lang.startsWith("ar") ? ar : en)[w];
};
