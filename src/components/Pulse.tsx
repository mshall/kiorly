import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/theme";
import { animationsEnabled, useReducedMotion } from "@/lib/motion";

/** The brand ECG pulse path (same geometry as the logo, _brand/shared/logo-scene). */
export const PULSE_D = "M222 440 H510 L525 428 L540 466 L557 392 L574 460 L588 441 H877";
const LEN = 800;

/** Drives a 0..1 progress value as React state (works identically on native and web, no native-driver dependency). */
export function useProgress(duration: number, loop: boolean, enabled = true): number {
  const [p, setP] = useState(enabled ? 0 : 1);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled || !animationsEnabled) { setP(1); return; }
    const id = v.addListener(({ value }) => setP(value));
    v.setValue(0);
    const run = Animated.timing(v, { toValue: 1, duration, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: false });
    const anim = loop ? Animated.loop(Animated.sequence([run, Animated.delay(250)])) : run;
    anim.start();
    return () => { anim.stop(); v.removeListener(id); };
  }, [duration, loop, enabled, v]);
  return p;
}

/** Brand loading / success motif: the coral pulse line drawing itself. */
export function PulseLine({ width = 120, loop = true, color, style }: { width?: number; loop?: boolean; color?: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const p = useProgress(1400, loop, !reduced);
  return (
    <View style={style} aria-hidden>
      <Svg width={width} height={width * 0.175} viewBox="206 380 688 120">
        <Path d={PULSE_D} fill="none" stroke={color ?? colors.pulse} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - p)} />
      </Svg>
    </View>
  );
}

/** Shimmer-free skeleton block (opacity pulse); honours reduced motion. */
export function Skeleton({ height = 16, width = "100%", radius = 8, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const o = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduced || !animationsEnabled) return;
    const a = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 1, duration: 800, useNativeDriver: false }), Animated.timing(o, { toValue: 0.55, duration: 800, useNativeDriver: false })]));
    a.start();
    return () => a.stop();
  }, [reduced, o]);
  return <Animated.View aria-hidden style={[{ height, width, borderRadius: radius, backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.hairline, opacity: o }, style]} />;
}

/** Brand illustration for empty / error / offline states: two soft chevrons with the coral pulse crossing the gap. */
export function BrandIllustration({ size = 132, tone = "empty" }: { size?: number; tone?: "empty" | "error" | "offline" }) {
  const { colors } = useTheme();
  const pulse = tone === "error" ? colors.danger : colors.pulse;
  return (
    <View aria-hidden style={{ width: size, height: size * 0.62, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size * 0.62} viewBox="150 190 800 520">
        <Path d="M373 237 L505 440 L373 643" fill="none" stroke={colors.ink} strokeOpacity={0.22} strokeWidth={46} strokeLinejoin="miter" />
        <Path d="M720 237 L588 440 L720 643" fill="none" stroke={colors.ink2} strokeOpacity={0.22} strokeWidth={46} strokeLinejoin="miter" />
        {tone === "offline"
          ? <Path d="M222 440 H420 M580 440 H877" fill="none" stroke={pulse} strokeWidth={13} strokeLinecap="round" strokeDasharray="1 26" />
          : <Path d={PULSE_D} fill="none" stroke={pulse} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />}
      </Svg>
    </View>
  );
}
