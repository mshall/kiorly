import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { Card, Row, Screen, T } from "@/components/ui";
import { BarChart, ListRow, QueryView, SectionTitle, StatTile } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { useTheme } from "@/theme";
import { usePh } from "@/modules/pharmacy/hooks";
import { drugName, expiryTone } from "@/modules/pharmacy/lib";
import { formatDay } from "@/lib/format";

interface Bucket { lots: number; units: number }
interface BlockedLot { lotId: string; brandName: string; brandNameAr?: string | null; lotNumber: string; expiryDate: string; qtyOnHand: number; status: string; blockedReason?: string | null }
interface Data {
  /** quarantined / recalled lots still on the shelf (newer API builds) */
  blocked?: { quarantined: Bucket; recalled: Bucket; items: BlockedLot[] };
  expiry: { expired: Bucket; within30: Bucket; within60: Bucket; within90: Bucket; items: { lotId: string; drugId: string; brandName: string; brandNameAr?: string | null; lotNumber: string; expiryDate: string; daysToExpiry: number; qtyOnHand: number; status: string }[] };
  lowStock: { count: number; items: { drugId: string; brandName: string; brandNameAr?: string | null; minQty: number; onHand: number; suggestedOrder: number }[] };
}

/** Expiry and low-stock dashboard. */
export default function Expiry() {
  const { t, ar, lang } = usePh();
  const { colors } = useTheme();
  const router = useRouter();
  const q = useRead<Data>("pharmacy", "/mobile/pharmacy/expiry-lowstock");
  const refresh = usePullRefresh(q);
  return (
    <Screen refresh={refresh} testID="expiry">
      <Stack.Screen options={{ title: t("pharmacy.tile.expiry") }} />
      <QueryView q={q} cached={q.fromCache}>
        {(d) => (
          <View style={{ gap: 12 }}>
            <Row gap={10}><StatTile label={t("pharmacy.expired")} value={d.expiry.expired.lots} tone="danger" icon="alert" hint={`${d.expiry.expired.units} ${t("common.units")}`} /><StatTile label={t("pharmacy.expiry.lowStock")} value={d.lowStock.count} tone="warning" icon="box" /></Row>
            <Card style={{ gap: 8 }}>
              <T weight="semibold">{t("pharmacy.expiry.buckets")}</T>
              <BarChart color={colors.ink2} data={[{ label: t("pharmacy.expired"), value: d.expiry.expired.lots }, { label: "30d", value: d.expiry.within30.lots }, { label: "60d", value: d.expiry.within60.lots }, { label: "90d", value: d.expiry.within90.lots }]} />
            </Card>
            {d.blocked && d.blocked.items.length ? (
              <View style={{ gap: 10 }} testID="blocked-stock">
                <SectionTitle title={t("pharmacy.expiry.blocked")} />
                {d.blocked.items.slice(0, 25).map((i) => (
                  <ListRow key={i.lotId} testID={`blocked-${i.lotId}`} icon="shield" iconTone="danger" title={drugName(i, ar)} subtitle={`${i.lotNumber} · ${i.qtyOnHand} ${t("common.units")}${i.blockedReason ? ` · ${i.blockedReason}` : ""}`}
                    badge={i.status === "RECALLED" ? t("pharmacy.expiry.recalled") : t("pharmacy.expiry.quarantined")} badgeTone="danger" />
                ))}
              </View>
            ) : null}
            <SectionTitle title={t("pharmacy.expiry.attention")} />
            {d.expiry.items.slice(0, 25).map((i) => (
              <ListRow key={i.lotId} testID={`exp-${i.lotId}`} icon="clock" iconTone={expiryTone(i.daysToExpiry) === "success" ? "ink" : expiryTone(i.daysToExpiry)} title={drugName(i, ar)} subtitle={`${i.lotNumber} · ${formatDay(i.expiryDate, lang)} · ${t("pharmacy.qty")} ${i.qtyOnHand}`}
                badge={i.daysToExpiry < 0 ? t("pharmacy.expired") : `${i.daysToExpiry}d`} badgeTone={expiryTone(i.daysToExpiry) === "ocean" ? "ocean" : expiryTone(i.daysToExpiry) === "success" ? "success" : expiryTone(i.daysToExpiry)} onPress={() => router.push(`/pharmacy/barcode?code=${encodeURIComponent(i.brandName)}` as never)} />
            ))}
            <SectionTitle title={t("pharmacy.expiry.lowStock")} />
            {!d.lowStock.items.length ? <T muted>{t("pharmacy.expiry.noLow")}</T> : d.lowStock.items.slice(0, 25).map((i) => (
              <ListRow key={i.drugId} testID={`low-${i.drugId}`} icon="box" iconTone="warning" title={drugName(i, ar)} subtitle={`${t("pharmacy.barcode.onHand")} ${i.onHand} · min ${i.minQty}`} badge={`+${i.suggestedOrder}`} badgeTone="warning" meta={t("pharmacy.expiry.suggested")} />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
