import { View } from "react-native";
import { useTheme } from "@/theme";
import { KiorexLogo } from "@/brand/components/native/KiorexLogo";

/** Kiorex mark (_brand artwork, never redrawn): indigo + ocean chevrons with the coral ECG pulse. `light` = inverse tone for dark/gradient grounds. */
export function KiorexMark({ width = 60, light = false }: { width?: number; light?: boolean }) {
  const { scheme } = useTheme();
  // the mark's aspect ratio comes from the shared scene; height = width / ratio is resolved by the SVG viewBox
  return <View aria-hidden><KiorexLogo variant="mark" tone={light || scheme === "dark" ? "inverse" : "color"} height={width * 0.68} /></View>;
}

/** Wordmark (_brand outlined Jost): KIOREX with the final X in Ocean. */
export function Wordmark({ size = 22, light = false }: { size?: number; light?: boolean }) {
  const { scheme } = useTheme();
  return <KiorexLogo variant="wordmark" tone={light || scheme === "dark" ? "inverse" : "color"} height={size} />;
}

/** Full lockup (mark | rule | wordmark). `product` adds "by Kiorex" / PASSPORT. */
export function Lockup({ height = 36, light = false, product = "kiorex" }: { height?: number; light?: boolean; product?: "kiorex" | "kiorly" | "passport" | "nurse" }) {
  const { scheme } = useTheme();
  return <KiorexLogo variant="lockup" tone={light || scheme === "dark" ? "inverse" : "color"} product={product} height={height} />;
}
