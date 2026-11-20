import { View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Card, Row, Screen, T } from "@/components/ui";
import { ListRow, QueryView, SectionTitle, Sparkline } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { useTheme } from "@/theme";
import { formatDay, formatTime } from "@/lib/format";

interface Block { id: string; rule: string; openedAt: string; status: string; instrument?: { name: string }; openedByRun?: { zScore?: string } }
interface Run { id: string; value: string; zScore: string; status: string; runAt: string; material?: { name?: string } }
interface LJ { analyte?: { code: string; unit?: string }; level?: string; lot?: string; mean: number; sd: number; points: { id: string; value: number; z: number; status: string }[] }

export default function Qc() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const blocks = useRead<Block[]>("lab", "/qc/blocks");
  const runs = useRead<Run[]>("lab", "/qc/runs");
  const lj = useRead<LJ>("lab", "/qc/levey-jennings");
  const refresh = usePullRefresh({ refetch: async () => { await Promise.all([blocks.refetch(), runs.refetch(), lj.refetch()]); } });
  const open = (blocks.data ?? []).filter((b) => b.status === "OPEN");
  return (
    <Screen refresh={refresh} testID="lab-qc">
      <Stack.Screen options={{ title: t("tiles.lab.qc.title") }} />
      <SectionTitle title={t("lab.qcBlocks")} />
      <QueryView q={blocks} cached={blocks.fromCache} isEmpty={() => !open.length} empty={{ icon: "check", title: t("lab.qcClear") }} rows={2}>
        {() => <View style={{ gap: 8 }}>{open.map((b) => <ListRow key={b.id} testID={`block-${b.id}`} icon="alert" iconTone="danger" accent={colors.danger} title={b.instrument?.name ?? "-"} subtitle={`${t("lab.rule")} ${b.rule}${b.openedByRun?.zScore ? ` · z ${b.openedByRun.zScore}` : ""}`} meta={`${formatDay(b.openedAt, i18n.language)} ${formatTime(b.openedAt, i18n.language)}`} badge={t("lab.blocked")} badgeTone="danger" />)}</View>}
      </QueryView>
      {lj.data?.points?.length ? (
        <Card style={{ gap: 6 }} testID="lj-chart">
          <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{lj.data.analyte?.code} · {lj.data.level}</T><T variant="caption" muted>{t("lab.mean")} {lj.data.mean} · SD {lj.data.sd}</T></Row>
          <Sparkline data={lj.data.points.map((p) => p.z)} color={lj.data.points.some((p) => p.status !== "PASS") ? colors.danger : colors.ink2} height={64} />
          <T variant="caption" muted>{t("lab.ljHint")}</T>
        </Card>
      ) : null}
      <SectionTitle title={t("lab.recentRuns")} />
      <QueryView q={runs} isEmpty={(d) => !d.length} rows={3} empty={{ icon: "activity", title: t("lab.queueEmpty") }}>
        {(d) => <View style={{ gap: 8 }}>{d.slice(0, 12).map((r) => <ListRow key={r.id} icon="activity" iconTone={r.status === "PASS" ? "success" : "danger"} title={`${r.value} · z ${r.zScore}`} subtitle={r.material?.name} meta={`${formatDay(r.runAt, i18n.language)} ${formatTime(r.runAt, i18n.language)}`} badge={r.status} badgeTone={r.status === "PASS" ? "success" : "danger"} />)}</View>}
      </QueryView>
    </Screen>
  );
}
