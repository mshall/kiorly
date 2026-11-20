import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator, Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type ViewProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle, type RefreshControlProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { elevation, fontFamily, MIN_TOUCH, radius, useTheme, type Weight } from "@/theme";
import { haptic } from "@/lib/haptics";
import { animationsEnabled, nativeDriver, useReducedMotion } from "@/lib/motion";
import { PulseLine } from "./Pulse";
import { Icon, type IconName } from "./Icon";

// ---- Text ----
type Variant = "large" | "display" | "title" | "h2" | "body" | "small" | "caption" | "label";
const SIZES: Record<Variant, { size: number; weight: Weight; line: number }> = {
  large: { size: 34, weight: "bold", line: 42 }, display: { size: 30, weight: "bold", line: 38 }, title: { size: 24, weight: "semibold", line: 32 }, h2: { size: 18, weight: "semibold", line: 26 },
  body: { size: 16, weight: "regular", line: 24 }, small: { size: 14, weight: "regular", line: 20 }, caption: { size: 12, weight: "regular", line: 16 }, label: { size: 14, weight: "medium", line: 20 },
};
export function T({ variant = "body", weight, muted, color, forceLatin, style, ...p }: TextProps & { variant?: Variant; weight?: Weight; muted?: boolean; color?: string; forceLatin?: boolean }) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const v = SIZES[variant];
  const tight = variant === "large" || variant === "display" ? (i18n.language.startsWith("ar") ? 0 : -0.6) : 0; // tight tracking for display (Latin only)
  return <Text {...p} style={[{ fontSize: v.size, lineHeight: v.line, letterSpacing: tight, color: color ?? (muted ? colors.muted : colors.text), fontFamily: fontFamily(forceLatin ? "en" : i18n.language, weight ?? v.weight) }, style]} />;
}

// ---- Layout ----
/** Screen scaffold. `title` renders an iOS-style large title that collapses into a compact bar with a hairline once scrolled. */
export function Screen({ children, scroll = true, padded = true, refresh, footer, style, testID, title }: {
  children: ReactNode; scroll?: boolean; padded?: boolean; refresh?: React.ReactElement<RefreshControlProps>; footer?: ReactNode; style?: StyleProp<ViewStyle>; testID?: string; title?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: false }), [y]);
  const barOpacity = y.interpolate({ inputRange: [18, 56], outputRange: [0, 1], extrapolate: "clamp" });
  const body = scroll ? (
    <Animated.ScrollView refreshControl={refresh} keyboardShouldPersistTaps="handled" onScroll={title ? onScroll : undefined} scrollEventThrottle={16}
      contentContainerStyle={[padded && { padding: 16 }, { paddingBottom: 24 }, style]} showsVerticalScrollIndicator={false}>
      {title ? <T variant="large" accessibilityRole="header" style={{ marginBottom: 4 }}>{title}</T> : null}
      {children}
    </Animated.ScrollView>
  ) : <View style={[{ flex: 1 }, padded && { padding: 16 }, style]}>{title ? <T variant="large" accessibilityRole="header">{title}</T> : null}{children}</View>;
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.ground }}>
      {body}
      {title && scroll ? (
        <Animated.View pointerEvents="none" aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 48, paddingTop: insets.top, opacity: barOpacity, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, alignItems: "center", justifyContent: "center" }}>
          <T variant="small" weight="semibold" numberOfLines={1}>{title}</T>
        </Animated.View>
      ) : null}
      {footer ? <View style={{ padding: 16, paddingBottom: 16 + (insets.bottom ? 0 : 0), backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>{footer}</View> : null}
    </View>
  );
}

/** Animated press-scale wrapper shared by tappable surfaces. Layout style goes on the wrapper, visuals on the inner Pressable. */
function usePressScale(to = 0.97) {
  const v = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const go = useCallback((toValue: number) => { if (reduced || !animationsEnabled) return; Animated.spring(v, { toValue, useNativeDriver: nativeDriver, speed: 40, bounciness: 4 }).start(); }, [v, reduced]);
  return { scale: v, onPressIn: () => go(to), onPressOut: () => go(1) };
}


const LAYOUT_KEYS = new Set(["flex", "flexGrow", "flexShrink", "flexBasis", "width", "minWidth", "maxWidth", "alignSelf", "margin", "marginTop", "marginBottom", "marginStart", "marginEnd", "marginLeft", "marginRight", "marginHorizontal", "marginVertical", "position", "top", "bottom", "left", "right", "start", "end", "zIndex"]);
/** Splits a style into the keys that position the box inside its parent (outer wrapper) and the rest (visual box). */
export function splitLayoutStyle(style: StyleProp<ViewStyle>): { outer: ViewStyle | undefined; inner: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {}; const inner: Record<string, unknown> = {};
  for (const k of Object.keys(flat)) (LAYOUT_KEYS.has(k) ? outer : inner)[k] = flat[k];
  return { outer: Object.keys(outer).length ? (outer as ViewStyle) : undefined, inner: inner as ViewStyle };
}

export function Card({ children, style, onPress, accessibilityLabel, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; testID?: string }) {
  const { colors, scheme } = useTheme();
  const ps = usePressScale(0.985);
  const base: ViewStyle = { backgroundColor: colors.surface, borderRadius: radius + 2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16, ...elevation(1, scheme) };
  if (onPress) {
    // Layout props (flex/width/margin/alignSelf…) belong on the OUTER animated wrapper: it is the flex child of the parent. Left on the
    // inner Pressable only, a `flex: 1` card collapses to its content width (stat tiles truncated to "زيارات…").
    const { outer, inner } = splitLayoutStyle(style);
    return (
    <Animated.View style={[outer, { transform: [{ scale: ps.scale }] }]}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptic.tap(); onPress(); }} onPressIn={ps.onPressIn} onPressOut={ps.onPressOut} style={({ pressed }) => [base, outer && { flexGrow: 1 }, pressed && { backgroundColor: colors.raised }, inner]}>{children}</Pressable>
    </Animated.View>
    );
  }
  return <View testID={testID} style={[base, style]}>{children}</View>;
}

export const Row = ({ children, style, gap = 8, ...rest }: ViewProps & { gap?: number }) => <View {...rest} style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
export const Stack = ({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => <View style={[{ gap }, style]}>{children}</View>;
export const Divider = () => { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 }} />; };

// ---- Button ----
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ title, onPress, variant = "primary", disabled, loading, icon, style, testID, accessibilityLabel, small }: {
  title: string; onPress?: () => void; variant?: BtnVariant; disabled?: boolean; loading?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string; small?: boolean;
}) {
  const { colors } = useTheme();
  const ps = usePressScale(0.97);
  const bg = variant === "primary" ? colors.ink : variant === "danger" ? colors.danger : variant === "secondary" ? colors.surface : "transparent";
  const fg = variant === "primary" ? colors.onInk : variant === "danger" ? colors.onDanger : colors.ink;
  const off = disabled || loading;
  return (
    <Animated.View style={[{ transform: [{ scale: ps.scale }] }, style as ViewStyle]}>
      <Pressable
        testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!off, busy: !!loading }}
        disabled={off} onPress={() => { haptic.tap(); onPress?.(); }} onPressIn={ps.onPressIn} onPressOut={ps.onPressOut}
        style={({ pressed }) => ({
          minHeight: small ? MIN_TOUCH : 52, borderRadius: radius, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
          backgroundColor: pressed && variant === "primary" ? colors.inkHover : bg, borderWidth: variant === "secondary" ? 1.5 : 0, borderColor: colors.ink, opacity: off ? 0.5 : 1,
        })}
      >
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
        <T variant="label" weight="semibold" style={{ color: fg, fontSize: 16 }}>{title}</T>
      </Pressable>
    </Animated.View>
  );
}

// ---- Chip / Badge ----
export function Chip({ label, selected, onPress, testID, icon }: { label: string; selected?: boolean; onPress?: () => void; testID?: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => { haptic.select(); onPress?.(); }} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }}
      style={{ minHeight: MIN_TOUCH, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 6, backgroundColor: selected ? colors.ink : colors.surface, borderWidth: 1, borderColor: selected ? colors.ink : colors.border }}>
      {icon ? <Icon name={icon} size={16} color={selected ? colors.onInk : colors.ink} /> : null}
      <T variant="small" weight="medium" color={selected ? colors.onInk : colors.text}>{label}</T>
    </Pressable>
  );
}

export function Badge({ label, tone = "ink", icon, testID }: { testID?: string; label: string; tone?: "ink" | "ocean" | "success" | "warning" | "danger" | "muted"; icon?: IconName }) {
  const { colors } = useTheme();
  const map = { ink: [colors.soft, colors.ink], ocean: [colors.soft, colors.ink2], success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], muted: [colors.ground, colors.muted] }[tone];
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: map[0], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      {icon ? <Icon name={icon} size={14} color={map[1]} /> : null}
      <T variant="caption" weight="semibold" color={map[1]}>{label}</T>
    </View>
  );
}

// ---- Inputs ----
export function Field({ label, style, onFocus, onBlur, ...p }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput
        accessibilityLabel={label ?? p.placeholder} placeholderTextColor={colors.muted}
        style={[{ minHeight: 50, borderRadius: radius, borderWidth: 1.5, borderColor: focused ? colors.ink : colors.border, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, fontSize: 16, fontFamily: fontFamily(i18n.language, "regular"), textAlign: i18n.language.startsWith("ar") ? "right" : "left" }, style]}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }} onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...p}
      />
    </View>
  );
}

export function Checkbox({ checked, onChange, label, testID }: { checked: boolean; onChange: (v: boolean) => void; label: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => { haptic.select(); onChange(!checked); }} style={{ minHeight: MIN_TOUCH, flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 6 }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: checked ? colors.ink : colors.muted, backgroundColor: checked ? colors.ink : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {checked ? <Icon name="check" size={16} color={colors.onInk} /> : null}
      </View>
      <T variant="small" style={{ flex: 1 }}>{label}</T>
    </Pressable>
  );
}

// ---- Feedback ----
export function Banner({ tone = "warning", title, body, children, testID }: { tone?: "warning" | "danger" | "success" | "ink"; title?: string; body?: string; children?: ReactNode; testID?: string }) {
  const { colors } = useTheme();
  const [bg, fg] = { warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], success: [colors.successSoft, colors.success], ink: [colors.soft, colors.ink] }[tone];
  return (
    <View testID={testID} accessibilityRole="alert" style={{ backgroundColor: bg, borderRadius: radius, padding: 14, gap: 6, borderWidth: 1, borderColor: fg }}>
      {title ? <T variant="label" weight="bold" color={fg}>{title}</T> : null}
      {body ? <T variant="small" color={colors.text}>{body}</T> : null}
      {children}
    </View>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <View style={{ padding: 32, alignItems: "center", gap: 12 }} accessibilityRole="progressbar" accessibilityLabel={label}><PulseLine width={132} />{label ? <T variant="small" muted>{label}</T> : null}</View>;
}

// ---- Bottom sheet ----
/** Bottom sheet: spring-in, dimmed backdrop, grabber, drag-down to dismiss, safe-area aware. */
export function Sheet({ visible, onClose, title, children, footer, testID }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; testID?: string }) {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const open = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (visible) {
      setMounted(true); drag.setValue(0);
      if (reduced || !animationsEnabled) open.setValue(1);
      else { haptic.tap(); Animated.spring(open, { toValue: 1, useNativeDriver: nativeDriver, damping: 22, stiffness: 240, mass: 0.9 }).start(); }
    } else if (mounted) {
      if (reduced || !animationsEnabled) { open.setValue(0); setMounted(false); }
      else Animated.timing(open, { toValue: 0, duration: 200, easing: Easing.bezier(0.3, 0, 1, 1), useNativeDriver: nativeDriver }).start(({ finished }) => { if (finished) setMounted(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) drag.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.9) closeRef.current();
      else Animated.spring(drag, { toValue: 0, useNativeDriver: nativeDriver, damping: 20, stiffness: 260 }).start();
    },
  }), [drag]);
  const translateY = Animated.add(open.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }), drag);
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} accessibilityViewIsModal statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={{ ...(StyleSheet.absoluteFill as object), backgroundColor: colors.overlay, opacity: open }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t("common.close")} />
        </Animated.View>
        <Animated.View testID={testID} style={{ maxHeight: "88%", backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 8, transform: [{ translateY }], ...elevation(4, scheme) }}>
          <View {...pan.panHandlers} style={{ alignItems: "center", paddingTop: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong }} /></View>
          <Row style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4, justifyContent: "space-between" }} {...pan.panHandlers}>
            <T variant="h2" style={{ flex: 1 }} accessibilityRole="header">{title}</T>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" }}><Icon name="close" color={colors.text} /></Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---- Toast ----
type ToastTone = "success" | "error" | "info";
interface ToastApi { show: (message: string, tone?: ToastTone) => void }
const ToastCtx = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

/** Transient confirmation (polite live region). Mount once near the root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, tone: ToastTone = "success") => {
    if (timer.current) clearTimeout(timer.current);
    (tone === "success" ? haptic.success : tone === "error" ? haptic.error : haptic.tap)();
    setItem({ id: Date.now(), message, tone });
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: animationsEnabled ? 220 : 0, easing: Easing.bezier(0, 0, 0, 1), useNativeDriver: nativeDriver }).start();
    timer.current = setTimeout(() => Animated.timing(v, { toValue: 0, duration: animationsEnabled ? 180 : 0, useNativeDriver: nativeDriver }).start(({ finished }) => { if (finished) setItem(null); }), tone === "error" ? 5000 : 2800);
  }, [v]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const api = useMemo(() => ({ show }), [show]);
  const accent = item?.tone === "error" ? colors.danger : item?.tone === "info" ? colors.ink2 : colors.success;
  return (
    <ToastCtx.Provider value={api}>
      {children}
      {item ? (
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" testID="toast" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 84, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.raised, borderRadius: radius, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, borderStartWidth: 4, borderStartColor: accent, ...elevation(3, scheme) }}>
            <Icon name={item.tone === "error" ? "close" : "check"} size={18} color={accent} />
            <T variant="small" weight="medium" style={{ flex: 1 }}>{item.message}</T>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const textStyle = (s: TextStyle) => s;
