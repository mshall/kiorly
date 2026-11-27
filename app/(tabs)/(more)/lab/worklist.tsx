import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Card, Row, Screen, T } from "@/components/ui";
import { ListRow, Progress, QueryView, SectionTitle } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { sectionPercent, sectionTone, type Section } from "@/modules/lab/helpers";
import { statusLabel } from "@/lib/status";
import { useLab } from "@/modules/lab/useLab";
import { mayOpenEntry, specimenProgress, type EntrySpecimen } from "@/modules/lab/entry";


export default function Worklist() {
  const { t } = useTranslation();
  const router = useRouter();
  const { can } = useLab();
  const prog = useRead<{ windowDays: number; sections: Section[] }>("lab", "/mobile/worklist/progress");
  const list = useRead<EntrySpecimen[]>("lab", "/worklist", { query: { status: "PROCESSING" } });
  const refresh = usePullRefresh({ refetch: async () => { await Promise.all([prog.refetch(), list.refetch()]); } });
  return (
    <Screen refresh={refresh} testID="lab-worklist">
      <Stack.Screen options={{ title: t("tiles.lab.worklist.title") }} />
      <QueryView q={prog} cached={prog.fromCache} isEmpty={(d) => !d.sections.length} empty={{ icon: "list", title: t("lab.queueEmpty") }}>
        {(d) => <View style={{ gap: 10 }}>
          <T variant="caption" muted>{t("lab.windowDays", { count: d.windowDays })}</T>
          {d.sections.map((s) => { const p = sectionPercent(s); return (
            <Card key={s.section} testID={`section-${s.section}`} style={{ gap: 8 }}>
              <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{s.section}</T><T weight="bold">{p}%</T></Row>
              <Progress value={p} tone={sectionTone(p)} />
              <Row gap={12} style={{ flexWrap: "wrap" }}><T variant="caption" muted>{t("lab.pending")} {s.pending}</T><T variant="caption" muted>{t("lab.inProgress")} {s.inProgress}</T><T variant="caption" muted>{t("lab.resulted")} {s.resulted}</T><T variant="caption" muted>{t("lab.validatedN")} {s.validated}</T><T variant="caption" muted>{t("lab.released")} {s.released}</T></Row>
            </Card>); })}
        </View>}
      </QueryView>
      <SectionTitle title={t("lab.inLab")} />
      <QueryView q={list} isEmpty={(d) => !d.length} rows={3} empty={{ icon: "list", title: t("lab.queueEmpty") }}>
        {(d) => <View style={{ gap: 8 }}>{d.slice(0, 15).map((s) => { const pr = specimenProgress(s); return <ListRow key={s.id} testID={`worklist-specimen-${s.id}`} icon="syringe" title={s.accessionNumber} subtitle={`${s.order?.orderNumber ?? ""} · ${s.specimenType}`} meta={pr.total ? t("lab.entry.progress", { done: pr.done, total: pr.total }) : undefined} badge={s.order?.priority !== "ROUTINE" ? statusLabel(t, s.order?.priority, { kind: "priority" }) : undefined} badgeTone="danger" onPress={mayOpenEntry(can) ? () => router.push(`/lab/results/${s.id}` as never) : undefined} />; })}</View>}
      </QueryView>
    </Screen>
  );
}
