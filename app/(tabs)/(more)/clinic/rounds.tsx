import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Banner, Row, Screen } from "@/components/ui";
import { FadeIn, ListRow, Progress, QueryView, StatTile } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { formatTime } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { ClinicError, Title } from "@/modules/clinic/shared";
import { roundCounts, roundTone } from "@/modules/clinic/helpers";

export interface RouteItem { id: string; appointmentId: string; state: string; plannedStartsAt: string; plannedEndsAt: string; district?: string; address?: { masked: boolean; line1?: string; building?: string; floor?: string; flat?: string; landmark?: string; lat?: number; lng?: number }; patient: { id: string; name: string; phone?: string }; abortReason?: string | null; fee?: { total: number }; navigationUrl?: string }

export default function Rounds() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const q = useRead<{ date: string; items: RouteItem[] }>("clinic", "/home-visits/route", { refetchInterval: 60_000 });
  const refresh = usePullRefresh(q);
  const c = roundCounts(q.data?.items ?? []);
  return (
    <Screen refresh={refresh} testID="clinic-rounds" title={t("tiles.clinic.homevisits.title")}>
      <Title k="tiles.clinic.homevisits.title" />
      <Row gap={10} style={{ alignItems: "stretch", marginVertical: 8 }}>
        <StatTile label={t("clinic.rounds.today")} value={c.total} icon="navigation" tone="ink" />
        <StatTile label={t("clinic.rounds.done")} value={`${c.done}/${c.total}`} icon="check" tone="success" />
      </Row>
      {c.total ? <Progress value={(c.done / c.total) * 100} tone="success" /> : null}
      <View style={{ gap: 10, marginTop: 12 }}>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} isEmpty={(d) => d.items.length === 0} empty={{ icon: "navigation", title: t("clinic.rounds.empty"), hint: t("clinic.rounds.emptyHint") }}>
            {(d) => <>{d.items.map((r, i) => (
              <FadeIn key={r.id} delay={Math.min(i, 5) * 40}>
                <ListRow testID={`round-${r.id}`} icon="navigation" iconTone={roundTone(r.state)} title={r.patient.name} subtitle={[formatTime(r.plannedStartsAt, i18n.language), r.district?.replace(/-/g, " ")].filter(Boolean).join(" · ")}
                  meta={r.address?.masked ? t("clinic.rounds.masked") : r.address?.line1} badge={t(`clinic.rounds.state.${r.state}`, { defaultValue: r.state })} badgeTone={roundTone(r.state)} onPress={() => { haptic.tap(); router.push(`/clinic/round/${r.id}` as never); }} />
              </FadeIn>
            ))}</>}
          </QueryView>
        )}
      </View>
      <Banner tone="ink" body={t("clinic.rounds.safetyNote")} />
    </Screen>
  );
}
