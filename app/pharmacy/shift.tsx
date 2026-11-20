import { Stack } from "expo-router";
import { View } from "react-native";
import { Card, Row, Screen, T } from "@/components/ui";
import { KV, QueryView, SectionTitle, StatTile } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { useTheme } from "@/theme";
import { usePh } from "@/modules/pharmacy/hooks";
import { money } from "@/modules/pharmacy/lib";
import { formatTime } from "@/lib/format";

interface Shift { open: boolean; shift?: { openedAt: string; openedByName: string; openingFloat: string; mine: boolean }; report: null | { salesCount: number; grossSales: string; vatTotal: string; discountTotal: string; byMethod: Record<string, string>; returnsCount: number; returnsTotal: string; cashSales: string; cashRefunds?: string; cashIn?: string; cashOut?: string; expectedCash?: string }; lastClosed?: { variance: string; expectedCash: string; countedCash: string } | null }

/** Shift cash summary (live X-report numbers). */
export default function ShiftSummary() {
  const { t, lang } = usePh();
  const { colors } = useTheme();
  const q = useRead<Shift>("pharmacy", "/mobile/pharmacy/shift-summary", { refetchInterval: 60_000 });
  const refresh = usePullRefresh(q);
  return (
    <Screen refresh={refresh} testID="shift">
      <Stack.Screen options={{ title: t("pharmacy.tile.shift") }} />
      <QueryView q={q} cached={q.fromCache} isEmpty={(d) => !d.open || !d.report} empty={{ icon: "receipt", title: t("pharmacy.shift.closed"), hint: t("pharmacy.shift.closedHint") }}>
        {(d) => {
          const r = d.report!; const m = Object.entries(r.byMethod).map(([k, v]) => ({ k, v: Number(v) })).sort((a, b) => b.v - a.v); const max = Math.max(1, ...m.map((x) => x.v));
          return (
            <View style={{ gap: 12 }}>
              <T variant="small" muted>{t("pharmacy.shift.openedBy", { name: d.shift?.openedByName, time: d.shift ? formatTime(d.shift.openedAt, lang) : "" })}</T>
              <Row gap={10}><StatTile label={t("pharmacy.shift.expectedCash")} value={money(r.expectedCash ?? r.cashSales, lang)} icon="receipt" tone="ink" testID="expected-cash" /><StatTile label={t("pharmacy.shift.gross")} value={money(r.grossSales, lang)} icon="chart" tone="success" /></Row>
              <Row gap={10}><StatTile label={t("pharmacy.shift.sales")} value={r.salesCount} icon="cart" /><StatTile label={t("pharmacy.shift.returns")} value={r.returnsCount} tone={r.returnsCount ? "warning" : "muted"} hint={money(r.returnsTotal, lang)} /></Row>
              <SectionTitle title={t("pharmacy.shift.byMethod")} />
              <Card style={{ gap: 10 }}>
                {m.map((x) => (
                  <View key={x.k} style={{ gap: 4 }}>
                    <Row style={{ justifyContent: "space-between" }}><T variant="small">{t(`pharmacy.shift.method.${x.k}`, { defaultValue: x.k })}</T><T variant="small" weight="semibold">{money(x.v, lang)}</T></Row>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.subtle }}><View style={{ height: 6, borderRadius: 3, width: `${Math.max(3, (x.v / max) * 100)}%`, backgroundColor: x.k === "CASH" ? colors.pulse : colors.ink }} /></View>
                  </View>
                ))}
              </Card>
              <Card style={{ gap: 6 }}><KV k={t("pharmacy.shift.float")} v={money(d.shift?.openingFloat, lang)} /><KV k={t("pharmacy.shift.cashSales")} v={money(r.cashSales, lang)} /><KV k={t("pharmacy.shift.vat")} v={money(r.vatTotal, lang)} /><KV k={t("pharmacy.shift.discounts")} v={money(r.discountTotal, lang)} /></Card>
              {d.lastClosed ? <Card style={{ gap: 6 }}><T variant="small" weight="semibold">{t("pharmacy.shift.lastClosed")}</T><KV k={t("pharmacy.shift.variance")} v={money(d.lastClosed.variance, lang)} tone={Number(d.lastClosed.variance) === 0 ? "success" : "warning"} /></Card> : null}
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}
