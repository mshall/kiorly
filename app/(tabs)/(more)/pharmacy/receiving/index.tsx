import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { Screen } from "@/components/ui";
import { ListRow, QueryView } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { usePh } from "@/modules/pharmacy/hooks";
import { isOpenPo, poProgress, money, type Po } from "@/modules/pharmacy/lib";

/** Open purchase orders to receive against (needs the `purchasing` plan capability: PRO and above). */
export default function ReceivingList() {
  const { t, lang } = usePh();
  const router = useRouter();
  const q = useRead<(Po & { totalCost?: string })[]>("pharmacy", "/purchase-orders");
  const refresh = usePullRefresh(q);
  return (
    <Screen refresh={refresh} testID="receiving">
      <Stack.Screen options={{ title: t("pharmacy.tile.receiving") }} />
      <QueryView q={q} cached={q.fromCache} isEmpty={(d) => !d.some((p) => isOpenPo(p.status) && p.status !== "DRAFT")} empty={{ icon: "truck", title: t("pharmacy.receiving.empty"), hint: t("pharmacy.receiving.emptyHint") }}>
        {(d) => (
          <View style={{ gap: 10 }}>
            {d.filter((p) => isOpenPo(p.status) && p.status !== "DRAFT").map((p) => {
              const pr = poProgress(p);
              return <ListRow key={p.id} testID={`po-${p.id}`} icon="truck" title={p.poNumber} subtitle={`${p.supplier?.name ?? ""} · ${money((p as { totalCost?: string }).totalCost, lang)}`} meta={`${pr.done}/${pr.ordered} ${t("common.units")}`} badge={p.status === "PARTIALLY_RECEIVED" ? t("pharmacy.receiving.partial") : t("pharmacy.receiving.sent")} badgeTone={p.status === "PARTIALLY_RECEIVED" ? "warning" : "ocean"} onPress={() => router.push(`/pharmacy/receiving/${p.id}` as never)} />;
            })}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
