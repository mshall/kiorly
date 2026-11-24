import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";
import { KiorexLogo } from "@/brand/components/native/KiorexLogo";

/** Kiorly mark (_brand artwork, never redrawn): Indigo + Periwinkle chevrons with the coral ECG pulse on light surfaces; white + light periwinkle on dark / indigo grounds.
 *  `light` forces the inverse tone (for an indigo ground). Name kept for the existing call sites. */
export function KiorexMark({ width = 60, light = false }: { width?: number; light?: boolean }) {
  const { scheme } = useTheme();
  // the mark's aspect ratio comes from the shared scene; height = width / ratio is resolved by the SVG viewBox
  return <View aria-hidden><KiorexLogo variant="mark" product="staff" tone={light || scheme === "dark" ? "inverse" : "color"} height={width * 0.68} /></View>;
}

/** Kiorly lockup: mark | thin coral rule | KIORLY (Arabic UI: كيورلي, mark on the right). Height in dp; follows the UI language and theme. */
export function KiorlyLockup({ height = 28, light = false }: { height?: number; light?: boolean }) {
  const { scheme } = useTheme();
  const { t, i18n } = useTranslation();
  return <KiorexLogo variant="lockup" product="staff" lang={i18n.language} tone={light || scheme === "dark" ? "inverse" : "color"} height={height} accessibilityLabel={t("app.name")} />;
}
