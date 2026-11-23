import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, TextInput, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import type { UseQueryResult } from "@tanstack/react-query";
import { useTheme, MIN_TOUCH, radius, elevation } from "@/theme";
import { haptic } from "@/lib/haptics";
import { Badge, Button, Card, Row, Sheet, T } from "./ui";
import { Icon, type IconName } from "./Icon";
import { Skeleton } from "./Pulse";
import { EmptyState, ErrorState } from "./states";
import { useOnline } from "@/offline/network";
import { useSyncStatus } from "@/hooks/useRead";
import { formatTime, localizeDigits } from "@/lib/format";
import { ApiError } from "@/api/errors";

type Tone = "ink" | "ocean" | "success" | "warning" | "danger" | "muted";
export const toneColor = (c: ReturnType<typeof useTheme>["colors"], t: Tone) => ({ ink: c.ink, ocean: c.ink2, success: c.success, warning: c.warning, danger: c.danger, muted: c.muted })[t];
export const toneSoft = (c: ReturnType<typeof useTheme>["colors"], t: Tone) => ({ ink: c.soft, ocean: c.infoSoft, success: c.successSoft, warning: c.warningSoft, danger: c.dangerSoft, muted: c.subtle })[t];

/** Pill shaped section title with optional action. */
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 8, marginBottom: 2 }}>
      <T variant="h2" accessibilityRole="header">{title}</T>
      {action ? <Pressable onPress={onAction} accessibilityRole="button" hitSlop={10}><T variant="small" weight="semibold" color={colors.ink2}>{action}</T></Pressable> : null}
    </Row>
  );
}

/** Standard tappable list row (min 44dp). */
export function ListRow({ title, subtitle, meta, icon, iconTone = "ink", leading, trailing, badge, badgeTone = "muted", onPress, accent, testID }: {
  title: string; subtitle?: string; meta?: string; icon?: IconName; iconTone?: Tone; leading?: ReactNode; trailing?: ReactNode; badge?: string; badgeTone?: Tone; onPress?: () => void; accent?: string; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} testID={testID} style={{ padding: 12, borderStartWidth: accent ? 4 : undefined, borderStartColor: accent }} accessibilityLabel={title}>
      <Row gap={12}>
        {leading ?? (icon ? <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: toneSoft(colors, iconTone), alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={20} color={toneColor(colors, iconTone)} /></View> : null)}
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="semibold" numberOfLines={1}>{title}</T>
          {subtitle ? <T variant="small" muted numberOfLines={2}>{subtitle}</T> : null}
          {meta ? <T variant="caption" muted numberOfLines={1}>{meta}</T> : null}
        </View>
        {badge ? <Badge label={badge} tone={badgeTone} /> : null}
        {trailing}
        {onPress && !trailing ? <Icon name="chevron" size={18} color={colors.subtleText} mirror /> : null}
      </Row>
    </Card>
  );
}

/** KPI tile with optional sparkline. */
export function StatTile({ label, value, tone = "ink", icon, spark, onPress, hint, testID }: { label: string; value: string | number; tone?: Tone; icon?: IconName; spark?: number[]; onPress?: () => void; hint?: string; testID?: string }) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const c = toneColor(colors, tone);
  // Pure numeric tiles ("12", "3/5", "87%") follow the language's digits; text values (names, ids) are left untouched.
  const shown = typeof value === "number" || /^[\d\s/.,%:+-]+$/.test(value) ? localizeDigits(value, i18n.language) : value;
  return (
    <Card onPress={onPress} testID={testID} style={{ flex: 1, minWidth: 96, padding: 14, gap: 6, alignSelf: "stretch" }} accessibilityLabel={`${label} ${value}`}>
      <Row style={{ justifyContent: "space-between" }}>
        <T variant="small" muted numberOfLines={1} style={{ flex: 1 }}>{label}</T>
        {icon ? <Icon name={icon} size={16} color={c} /> : null}
      </Row>
      <T variant="display" weight="bold" color={c} style={{ fontSize: 28, lineHeight: 34 }}>{shown}</T>
      {spark && spark.length > 1 ? <Sparkline data={spark} color={c} height={28} /> : hint ? <T variant="caption" muted>{hint}</T> : null}
    </Card>
  );
}

/** Tiny area sparkline (react-native-svg). */
export function Sparkline({ data, color, height = 32, width = 120 }: { data: number[]; color: string; height?: number; width?: number }) {
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <View aria-hidden style={{ height, alignSelf: "stretch" }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs><LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.28" /><Stop offset="1" stopColor={color} stopOpacity="0" /></LinearGradient></Defs>
        <Path d={area} fill="url(#sg)" />
        <Path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.6} fill={color} />
      </Svg>
    </View>
  );
}

/** Horizontal-axis bar chart with value labels (Revenue, worklist). */
export function BarChart({ data, color, height = 120, format }: { data: { label: string; value: number }[]; color?: string; height?: number; format?: (v: number) => string }) {
  const { colors } = useTheme();
  const c = color ?? colors.ink;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: height + 34 }} accessibilityRole="image" accessibilityLabel={data.map((d) => `${d.label} ${format ? format(d.value) : d.value}`).join(", ")}>
      {data.map((d, i) => (
        <View key={d.label + i} style={{ flex: 1, alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
          <T variant="caption" muted numberOfLines={1}>{format ? format(d.value) : String(d.value)}</T>
          <View style={{ width: "70%", height: Math.max(4, (d.value / max) * height), borderRadius: 6, backgroundColor: i === data.length - 1 ? colors.pulse : c, opacity: i === data.length - 1 ? 1 : 0.85 }} />
          <T variant="caption" muted>{d.label}</T>
        </View>
      ))}
    </View>
  );
}

/** Progress bar. */
export function Progress({ value, tone = "ink", height = 8 }: { value: number; tone?: Tone; height?: number }) {
  const { colors } = useTheme();
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }} style={{ height, borderRadius: height / 2, backgroundColor: colors.subtle, overflow: "hidden" }}><View style={{ width: `${Math.max(2, Math.min(100, value))}%`, height, backgroundColor: toneColor(colors, tone), borderRadius: height / 2 }} /></View>;
}

/** Segmented control / chip row. */
/** `testID` goes on the tablist, each tab gets `${testID}-${value}`. */
export function Segmented<V extends string>({ options, value, onChange, testID, accessibilityLabel }: { options: { value: V; label: string; count?: number }[]; value: V; onChange: (v: V) => void; testID?: string; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} testID={testID} style={{ flexDirection: "row", backgroundColor: colors.subtle, borderRadius: radius, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} testID={testID ? `${testID}-${o.value}` : undefined} accessibilityRole="tab" accessibilityState={{ selected: sel }} aria-selected={sel} onPress={() => { if (!sel) { haptic.select(); onChange(o.value); } }} style={{ flex: 1, minHeight: 36, borderRadius: radius - 3, alignItems: "center", justifyContent: "center", backgroundColor: sel ? colors.surface : "transparent", ...(sel ? elevation(1) : {}) }}>
            <T variant="small" weight={sel ? "semibold" : "medium"} color={sel ? colors.ink : colors.muted} numberOfLines={1}>{o.label}{o.count != null ? ` · ${localizeDigits(o.count, i18n.language)}` : ""}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }} accessibilityLabel="loading" testID="skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: radius + 2, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center" }}>
          <Skeleton width={40} height={40} radius={12} />
          <View style={{ flex: 1, gap: 8 }}><Skeleton height={14} width="60%" /><Skeleton height={11} width="90%" /></View>
        </View>
      ))}
    </View>
  );
}

/** Loading skeleton -> error -> empty -> content. `cached` shows the offline "last saved copy" ribbon. */
export function QueryView<T>({ q, children, isEmpty, empty, rows, cached }: {
  q: Pick<UseQueryResult<T, ApiError>, "data" | "isLoading" | "isError" | "error" | "refetch">; children: (data: T) => ReactNode; isEmpty?: (d: T) => boolean; empty?: { icon?: IconName; title: string; hint?: string; action?: ReactNode }; rows?: number; cached?: boolean;
}) {
  const { t } = useTranslation();
  if (q.isLoading) return <SkeletonList rows={rows} />;
  if (q.isError && q.data === undefined) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data as T;
  if (d == null || (isEmpty && isEmpty(d))) return <EmptyState icon={empty?.icon} title={empty?.title ?? t("states.emptyTitle")} hint={empty?.hint ?? t("states.emptyHint")} action={empty?.action} />;
  return <>{cached ? <Banner2 text={t("common.cachedCopy")} /> : null}{children(d)}</>;
}
const Banner2 = ({ text }: { text: string }) => { const { colors } = useTheme(); return <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingBottom: 8 }}><Icon name="wifiOff" size={14} color={colors.warning} /><T variant="caption" color={colors.warning}>{text}</T></View>; };

/** Sync status chip (offline / syncing / n waiting / conflicts / synced). Tap opens the sync centre. */
export function SyncChip({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const s = useSyncStatus();
  let tone: Tone = "success"; let label = t("sync.synced"); let icon: IconName = "check";
  if (!online) { tone = "warning"; label = s.pending ? `${t("sync.offline")} · ${t("sync.pending", { count: s.pending })}` : t("sync.offline"); icon = "wifiOff"; }
  else if (s.conflicts) { tone = "danger"; label = t("sync.conflicts", { count: s.conflicts }); icon = "alert"; }
  else if (s.syncing) { tone = "ocean"; label = t("sync.syncing"); icon = "sync"; }
  else if (s.pending || s.failed) { tone = "warning"; label = t("sync.pending", { count: s.pending + s.failed }); icon = "sync"; }
  const c = toneColor(colors, tone);
  return (
    <Pressable onPress={onPress} testID="sync-chip" accessibilityRole="button" accessibilityLabel={`${t("sync.title")}: ${label}`} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: toneSoft(colors, tone) }}>
      <Icon name={icon} size={14} color={c} />
      <T variant="caption" weight="semibold" color={c} numberOfLines={1}>{label}</T>
      {void i18n}
    </Pressable>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (online) return null;
  return <View testID="offline-banner" accessibilityRole="alert" style={{ flexDirection: "row", gap: 8, alignItems: "center", padding: 10, paddingHorizontal: 16, backgroundColor: colors.warningSoft }}><Icon name="wifiOff" size={16} color={colors.warning} /><T variant="small" weight="medium" color={colors.warning} style={{ flex: 1 }}>{t("sync.offlineBanner")}</T></View>;
}

export interface SheetAction { label: string; icon?: IconName; tone?: "default" | "danger"; onPress: () => void; disabled?: boolean }
/** Bottom-sheet action list. */
export function ActionSheet({ visible, onClose, title, actions }: { visible: boolean; onClose: () => void; title: string; actions: SheetAction[] }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {actions.map((a) => (
        <Pressable key={a.label} disabled={a.disabled} onPress={() => { onClose(); a.onPress(); }} accessibilityRole="button" style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: a.disabled ? 0.4 : 1 }}>
          {a.icon ? <Icon name={a.icon} size={20} color={a.tone === "danger" ? colors.danger : colors.ink} /> : null}
          <T weight="medium" color={a.tone === "danger" ? colors.danger : colors.text}>{a.label}</T>
        </Pressable>
      ))}
    </Sheet>
  );
}

/** Labelled value pair. */
export function KV({ k, v, tone }: { k: string; v?: string | number | null; tone?: Tone }) {
  const { colors } = useTheme();
  return <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }} gap={12}><T variant="small" muted style={{ flexShrink: 0 }}>{k}</T><T variant="small" weight="medium" color={tone ? toneColor(colors, tone) : undefined} style={{ flex: 1, textAlign: "right" }}>{v == null || v === "" ? "-" : String(v)}</T></Row>;
}

/** Animated count-in for KPI numbers. */
export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const start = Date.now();
    raf.current = setInterval(() => { const p = Math.min(1, (Date.now() - start) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p >= 1 && raf.current) clearInterval(raf.current); }, 32);
    return () => { if (raf.current) clearInterval(raf.current); };
  }, [target, ms]);
  return v;
}

/** Fade + rise on mount for lists (respects reduced motion via animationsEnabled in Screen). */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 260, delay, useNativeDriver: true }).start(); }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

export function TimeAgo({ iso }: { iso: string }) {
  const { t, i18n } = useTranslation();
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const txt = mins < 1 ? t("inbox.justNow") : mins < 60 ? `${mins} ${t("common.min")}` : formatTime(iso, i18n.language);
  return <T variant="caption" muted>{txt}</T>;
}

/** Time-of-day grouping used by Home greeting. */
export const greetingKey = (d = new Date()) => (d.getHours() < 12 ? "home.greetingMorning" : d.getHours() < 18 ? "home.greeting" : "home.greetingEvening");
export { Button, Rect };
