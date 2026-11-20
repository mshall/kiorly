import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Row, Screen } from "@/components/ui";
import { ListRow, Progress, QueryView, Segmented, StatTile } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { tatTone } from "@/modules/lab/helpers";

interface TatRow { orderItemId: string; orderNumber: string; priority: string; test: string; targetMinutes: number; status: string; elapsedMinutes: number; percent: number }
interface Tat { summary: { total: number; ok: number; atRisk: number; breached: number; doneOnTime: number; doneLate: number }; rows: TatRow[] }

export default function TatScreen() {
  const { t } = useTranslation();
  const [f, setF] = useState<"BREACHED" | "AT_RISK" | "OK">("BREACHED");
  const q = useRead<Tat>("lab", "/tat");
  const refresh = usePullRefresh(q);
  return (
    <Screen refresh={refresh} testID="lab-tat">
      <Stack.Screen options={{ title: t("tiles.lab.tat.title") }} />
      <QueryView q={q} cached={q.fromCache}>
        {(d) => (<>
          <Row gap={10}><StatTile label={t("lab.breached")} value={d.summary.breached} tone={d.summary.breached ? "danger" : "success"} icon="alert" /><StatTile label={t("lab.atRisk")} value={d.summary.atRisk} tone={d.summary.atRisk ? "warning" : "success"} icon="clock" /></Row>
          <Row gap={10}><StatTile label={t("lab.onTrack")} value={d.summary.ok} tone="success" icon="check" /><StatTile label={t("lab.doneLate")} value={d.summary.doneLate} tone="muted" icon="file" /></Row>
          <Segmented value={f} onChange={setF} options={[{ value: "BREACHED", label: t("lab.breached"), count: d.summary.breached }, { value: "AT_RISK", label: t("lab.atRisk"), count: d.summary.atRisk }, { value: "OK", label: t("lab.onTrack"), count: d.summary.ok }]} />
          <View style={{ gap: 8 }}>{d.rows.filter((r) => r.status === f).slice(0, 40).map((r) => (
            <ListRow key={r.orderItemId} testID={`tat-${r.orderItemId}`} icon="clock" iconTone={tatTone(r.status) === "ocean" ? "ocean" : tatTone(r.status)} title={`${r.orderNumber} · ${r.test}`} subtitle={`${r.elapsedMinutes} / ${r.targetMinutes} ${t("common.min")}`} badge={r.priority !== "ROUTINE" ? r.priority : undefined} badgeTone="danger"
              trailing={<View style={{ width: 56 }}><Progress value={r.percent} tone={tatTone(r.status) === "ocean" ? "ocean" : (tatTone(r.status) as "success")} /></View>} />
          ))}</View>
        </>)}
      </QueryView>
    </Screen>
  );
}
