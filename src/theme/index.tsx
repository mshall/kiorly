import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
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
interface Ctx { colors: Palette; scheme: "light" | "dark"; pref: ThemePref; setPref: (p: ThemePref) => void }
const ThemeCtx = createContext<Ctx>({ colors: light, scheme: "light", pref: "system", setPref: () => {} });
const KEY = "kx-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");
  useEffect(() => { void prefs.get(KEY).then((v) => { if (v === "light" || v === "dark" || v === "system") setPrefState(v); }); }, []);
  const setPref = useCallback((p: ThemePref) => { setPrefState(p); void prefs.set(KEY, p); }, []);
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
