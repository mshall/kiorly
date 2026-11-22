import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Chip, Row, Screen } from "@/components/ui";
import { ListRow, QueryView } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { fontFamily, radius, useTheme } from "@/theme";
import { formatTime } from "@/lib/format";
import { statusLabel } from "@/lib/status";

interface Order { id: string; orderNumber: string; status: string; priority: string; createdAt: string; patient?: { fullName?: string }; items?: unknown[] }
const STATUSES = ["AWAITING_COLLECTION", "COLLECTED", "IN_LAB", "AWAITING_VALIDATION", "VALIDATED", "RELEASED"] as const;
const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
export const orderTone = (s: string, p: string) => (p !== "ROUTINE" ? "danger" : /RELEASED|VALIDATED/.test(s) ? "success" : /AWAITING/.test(s) ? "warning" : "ocean") as "danger" | "success" | "warning" | "ocean";

export default function Orders() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { q: qp } = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(qp ?? ""); const [dq, setDq] = useState(qp ?? ""); const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(id); }, [q]);
  const res = useRead<{ total: number; rows: Order[] }>("lab", "/orders", { query: { from: dq ? undefined : startOfDay(), status: status ?? undefined, search: dq || undefined, limit: 50 } });
  const refresh = usePullRefresh(res);
  return (
    <Screen refresh={refresh} testID="lab-orders">
      <Stack.Screen options={{ title: t("tiles.lab.orders.title") }} />
      <TextInput testID="orders-search" value={q} onChangeText={setQ} placeholder={t("search.placeholder")} placeholderTextColor={colors.subtleText} autoCapitalize="none"
        style={{ minHeight: 48, borderRadius: radius, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, fontSize: 16, fontFamily: fontFamily(i18n.language, "regular"), textAlign: i18n.language.startsWith("ar") ? "right" : "left" }} />
      <Row gap={8} style={{ flexWrap: "wrap" }}><Chip label={t("common.all")} selected={!status} onPress={() => setStatus(null)} />{STATUSES.map((s) => <Chip key={s} label={t(`lab.status.${s}`)} selected={status === s} onPress={() => setStatus(s)} testID={`chip-${s}`} />)}</Row>
      <QueryView q={res} cached={res.fromCache} isEmpty={(d) => !d.rows.length} empty={{ icon: "file", title: t("lab.noOrders") }}>
        {(d) => <View style={{ gap: 8 }}>{d.rows.map((o) => <ListRow key={o.id} testID={`order-${o.orderNumber}`} icon="file" iconTone={orderTone(o.status, o.priority) === "danger" ? "danger" : "ink"} title={o.orderNumber} subtitle={o.patient?.fullName} meta={`${formatTime(o.createdAt, i18n.language)} · ${o.items?.length ?? 0} ${t("lab.tests")}`} badge={o.priority !== "ROUTINE" ? statusLabel(t, o.priority, { kind: "priority" }) : statusLabel(t, o.status, { scope: "lab" })} badgeTone={orderTone(o.status, o.priority)} />)}</View>}
      </QueryView>
    </Screen>
  );
}
