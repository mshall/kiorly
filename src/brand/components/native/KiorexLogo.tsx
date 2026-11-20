import * as React from "react";
import Svg, { Polyline, Path, Line, G } from "react-native-svg";
import { buildScene, PALETTE, PRODUCT_NAMES, type Product, type Tone, type Variant } from "../shared/logo-scene";

export interface KiorexLogoProps {
  variant?: Variant;
  tone?: Tone;
  product?: Product;
  /** Height in dp; width follows aspect ratio. Default 32. */
  height?: number;
  /** For "mono" tone: the colour to paint with (default #1E1B4B). */
  color?: string;
  accessibilityLabel?: string;
}


/** Kiorex brand logo (react-native-svg). Geometry is shared with the web component via ../shared/logo-scene. */
export function KiorexLogo({ variant = "lockup", tone = "color", product = "kiorex", height = 32, color = "#1E1B4B", accessibilityLabel }: KiorexLogoProps) {
  const scene = React.useMemo(() => buildScene(variant, product), [variant, product]);
  const pal = tone === "mono" ? Object.fromEntries(Object.keys(PALETTE.mono).map((k) => [k, color])) as typeof PALETTE.mono : PALETTE[tone];
  const [x, y, w, h] = scene.viewBox;
  return (
    <Svg viewBox={`${x} ${y} ${w} ${h}`} height={height} width={(height * w) / h} accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? (variant === "mark" ? "Kiorex mark" : PRODUCT_NAMES[product])}>
      {scene.nodes.map((n, i) => {
        if (n.k === "poly") return <Polyline key={i} points={n.points} fill="none" stroke={pal[n.role]} strokeWidth={n.sw} strokeLinejoin="miter" />;
        if (n.k === "pulse") return <Path key={i} d={n.d} fill="none" stroke={pal[n.role]} strokeWidth={n.sw} strokeLinejoin="round" strokeLinecap="round" />;
        if (n.k === "line") return <Line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={pal[n.role]} strokeWidth={n.sw} />;
        return <G key={i} transform={n.transform}><Path d={n.d} fill={pal[n.role]} /></G>;
      })}
    </Svg>
  );
}
export default KiorexLogo;
