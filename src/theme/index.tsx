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

// ---- Shared design tokens: IDENTICAL names and values in Kiorly (staff) and Kiorex (patient) so the two apps read as siblings. Indigo is the primary everywhere,
// Ocean the secondary accent, coral only the pulse / alert accent. Keep this block byte-identical in both theme files.
/** 8-pt grid (4 only for hairline gaps). */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 40, 8: 48 } as const;
/** Corner radii: controls 12, cards 16, sheets 24, pills full. */
export const radii = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
/** Type scale (size / line height / weight). `T` renders these variants. */
export const typeScale = {
  large: { size: 34, line: 42, weight: "bold" }, display: { size: 30, line: 38, weight: "bold" }, title: { size: 24, line: 32, weight: "semibold" }, h2: { size: 18, line: 26, weight: "semibold" },
  body: { size: 16, line: 24, weight: "regular" }, small: { size: 14, line: 20, weight: "regular" }, caption: { size: 12, line: 16, weight: "regular" }, label: { size: 14, line: 20, weight: "medium" },
} as const;
/** Layout constants: 16 pt gutters, 44 pt touch targets, 56 pt header bar. */
export const layout = { gutter: 16, touch: 44, headerH: 56, maxContent: 560 } as const;
/** Soft layered card shadow: three stacked layers on web (CSS), the level-3 elevation on native (RN allows one shadow per view). */
export const layeredShadow = (scheme: "light" | "dark" = "light") => Platform.OS === "web"
  ? ({ boxShadow: scheme === "dark" ? "0 1px 2px rgba(0,0,10,.5), 0 10px 28px rgba(0,0,10,.5), 0 0 0 1px rgba(232,234,251,.06)" : "0 1px 2px rgba(30,27,75,.06), 0 8px 24px rgba(30,27,75,.08), 0 24px 48px -16px rgba(30,27,75,.10), 0 0 0 1px rgba(30,27,75,.04)" } as object)
  : brandShadow(3, scheme);
export const radius = radii.md;
export const radiusLg = radii.xl;
export const MIN_TOUCH = layout.touch;

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
