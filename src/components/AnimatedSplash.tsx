import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path, Polyline } from "react-native-svg";
import { PULSE_D, useProgress } from "./Pulse";
import { animationsEnabled, nativeDriver, useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { useTranslation } from "react-i18next";
import { T } from "@/components/ui";

/** Brand splash: the two chevrons settle in, then the coral ECG pulse draws across the gap, then the screen fades out.
 *  Mounted above the app once fonts/i18n are ready (the native splash image shows the static mark until then). */
export function AnimatedSplash({ onDone, onShown, hold = false }: { onDone: () => void; /** first frame of the flat brand ground is on screen: safe to hide the native splash (same colour, so no visible change) */ onShown?: () => void; /** keep the splash up (e.g. stored sessions still loading) */ hold?: boolean }) {
  const { scheme } = useTheme();
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const p = useProgress(1100, false, !reduced);
  const fade = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = useState(false);
  const done = useRef(onDone); done.current = onDone;
  const holdRef = useRef(hold); holdRef.current = hold;
  const [holdOff, setHoldOff] = useState(!hold);
  useEffect(() => { if (!hold) setHoldOff(true); }, [hold]);
  useEffect(() => {
    if (!holdOff) return;
    if (!animationsEnabled) { setGone(true); done.current(); return; }
    const hold = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 260, easing: Easing.bezier(0.3, 0, 1, 1), useNativeDriver: nativeDriver }).start(() => { setGone(true); done.current(); });
    }, reduced ? 250 : 1350);
    return () => clearTimeout(hold);
  }, [fade, reduced, holdOff]);
  if (gone) return null;
  const chev = Math.min(1, p * 2.2);
  return (
    <Animated.View pointerEvents="auto" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: scheme === "dark" ? "#0F1024" : "#3730A3", alignItems: "center", justifyContent: "center", zIndex: 1000 }]} testID="splash" onLayout={() => onShown?.()}>
      <View style={{ opacity: chev, transform: [{ scale: 0.92 + 0.08 * chev }] }}>
        <Svg width={220} height={150} viewBox="150 190 800 520">
          <Polyline points="373,237 505,440 373,643" fill="none" stroke="#FFFFFF" strokeWidth={38} />
          <Polyline points="720,237 588,440 720,643" fill="none" stroke="#7DD3FC" strokeWidth={38} />
          <Path d={PULSE_D} fill="none" stroke="#F08A75" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={800} strokeDashoffset={800 * (1 - Math.max(0, (p - 0.2) / 0.8))} />
        </Svg>
      </View>
      {/* "by Kiorex" is shown ONLY here and on the About card (never in the icon label or the store name, ADR-037). */}
      <View style={{ position: "absolute", bottom: 56, opacity: chev }} testID="splash-by"><T variant="small" color="#C7D2FE">{t("app.by")}</T></View>
    </Animated.View>
  );
}
