import { View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui";
import { ListRow, Progress, QueryView, SectionTitle } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { formatDay } from "@/lib/format";

interface Low { id: string; code: string; name: string; nameAr?: string; unit: string; onHand: number; reorderLevel: number; reorderQty: number; supplier?: { name: string } }
interface Exp { id: string; code: string; name: string; nameAr?: string; expiringLots: number; expiredQty: number; nextExpiry?: string }

export default function Reagents() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const q = useRead<{ lowStock: Low[]; expiring: Exp[] }>("lab", "/mobile/reagents/low-stock");
  const refresh = usePullRefresh(q);
  return (
    <Screen refresh={refresh} testID="lab-reagents">
      <Stack.Screen options={{ title: t("tiles.lab.reagents.title") }} />
      <QueryView q={q} cached={q.fromCache} isEmpty={(d) => !d.lowStock.length && !d.expiring.length} empty={{ icon: "check", title: t("lab.reagentsOk") }}>
        {(d) => (<>
          <SectionTitle title={t("lab.lowStock")} />
          <View style={{ gap: 8 }}>{d.lowStock.map((r) => <ListRow key={r.id} testID={`low-${r.code}`} icon="thermometer" iconTone="warning" title={ar ? r.nameAr ?? r.name : r.name} subtitle={`${r.onHand} / ${r.reorderLevel} ${r.unit} · ${t("lab.reorder")} ${r.reorderQty}`} meta={r.supplier?.name} trailing={<View style={{ width: 52 }}><Progress value={(r.onHand / Math.max(1, r.reorderLevel)) * 100} tone="warning" /></View>} />)}</View>
          {d.expiring.length ? <SectionTitle title={t("lab.expiring")} /> : null}
          <View style={{ gap: 8 }}>{d.expiring.map((r) => <ListRow key={r.id} icon="clock" iconTone="danger" title={ar ? r.nameAr ?? r.name : r.name} subtitle={`${r.expiringLots} ${t("lab.lots")}${r.expiredQty ? ` · ${t("lab.expired")} ${r.expiredQty}` : ""}`} meta={r.nextExpiry ? formatDay(r.nextExpiry, i18n.language) : undefined} />)}</View>
        </>)}
      </QueryView>
    </Screen>
  );
}
