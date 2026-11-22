import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { Row, Screen, T } from "@/components/ui";
import { ListRow, QueryView, StatTile } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { usePh } from "@/modules/pharmacy/hooks";

interface QItem { id: string; status: string; priority: "URGENT" | "NORMAL"; source: string; ageMinutes: number; patient: { displayName: string; allergies: string[] }; prescriberName?: string; prescriberVerified?: boolean; lines: number; controlled: boolean; hasAllergyOnFile: boolean }
interface Queue { total: number; urgent: number; items: QItem[] }

/** Rx verification queue (urgent first). */
export default function RxQueue() {
  const { t, ar } = usePh();
  const router = useRouter();
  const q = useRead<Queue>("pharmacy", "/prescriptions/verification-queue");
  const refresh = usePullRefresh(q);
  const age = (m: number) => (m >= 1440 ? `${Math.floor(m / 1440)}d` : m >= 60 ? `${Math.floor(m / 60)}h` : `${m}${t("common.min")}`);
  const items = [...(q.data?.items ?? [])].sort((a, b) => (a.priority === b.priority ? b.ageMinutes - a.ageMinutes : a.priority === "URGENT" ? -1 : 1));
  return (
    <Screen refresh={refresh} testID="rx-queue">
      <Stack.Screen options={{ title: t("pharmacy.tile.rx") }} />
      <Row gap={10}><StatTile label={t("pharmacy.rx.waiting")} value={q.data?.total ?? "-"} icon="clipboard" /><StatTile label={t("pharmacy.rx.urgent")} value={q.data?.urgent ?? "-"} tone={q.data?.urgent ? "danger" : "success"} icon="alert" /></Row>
      <QueryView q={q} cached={q.fromCache} isEmpty={() => !items.length} empty={{ icon: "check", title: t("pharmacy.rx.empty"), hint: t("pharmacy.rx.emptyHint") }}>
        {() => (
          <View style={{ gap: 10 }}>
            {items.map((r) => (
              <ListRow key={r.id} testID={`rx-${r.id}`} icon={r.controlled ? "shield" : "clipboard"} iconTone={r.priority === "URGENT" ? "danger" : r.controlled ? "warning" : "ink"}
                title={r.patient.displayName} subtitle={`${r.prescriberName ?? ""}${r.prescriberVerified === false ? ` · ${t("pharmacy.rx.unverified")}` : ""}`}
                meta={`${t("pharmacy.rx.lines", { count: r.lines })} · ${age(r.ageMinutes)}${r.hasAllergyOnFile ? ` · ${t("pharmacy.rx.allergy")}` : ""}${r.controlled ? ` · ${t("pharmacy.rx.controlled")}` : ""}`}
                badge={r.priority === "URGENT" ? t("pharmacy.rx.urgentBadge") : r.status === "VALIDATING" ? t("pharmacy.rx.validating") : undefined} badgeTone={r.priority === "URGENT" ? "danger" : "ocean"}
                accent={r.priority === "URGENT" ? "#E8735E" : undefined} onPress={() => router.push(`/pharmacy/rx/${r.id}` as never)} />
            ))}
            {void ar}
          </View>
        )}
      </QueryView>
      <T variant="caption" muted style={{ textAlign: "center" }}>{t("pharmacy.rx.footer")}</T>
    </Screen>
  );
}
