import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Session } from "@/api/types";
import { useRead } from "@/hooks/useRead";
import { StatTile, SkeletonList, ListRow } from "@/components/kit";
import { Row } from "@/components/ui";
import { queueView, nameOf } from "./helpers";
import { formatInt } from "@/lib/format";

interface Summary {
  today: { total: number; scheduled: number; waiting: number; inExam: number; completed: number; cancelled: number } | null;
  nextUp: { id: string; startsAt: string; status: string; queueStage?: string; queueTicketNumber?: number; patient: { name: string; nameAr?: string } } | null;
  pendingPrescriptions: number | null; pendingLabReviews: number | null; openVisits: number | null; openAlerts?: number | null;
}

/** Clinic KPI tiles for Home. Counters the role may not see are null and hidden. */
export default function HomeSummary(_props: { session: Session }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const q = useRead<Summary>("clinic", "/mobile/summary", { refetchInterval: 45_000 });
  if (q.isLoading) return <SkeletonList rows={2} />;
  const s = q.data; if (!s) return null;
  const tt = s.today;
  const go = (r: string) => () => router.push(r as never);
  const spark = tt ? [tt.scheduled, tt.waiting, tt.inExam, tt.completed].map((n) => n + 0) : undefined;
  return (
    <View style={{ gap: 10 }} testID="clinic-summary">
      <Row gap={10} style={{ alignItems: "stretch" }}>
        {tt ? <StatTile testID="kpi-today" label={t("clinic.kpi.today")} value={tt.total} icon="calendar" tone="ink" spark={spark} onPress={go("/clinic/schedule")} /> : null}
        {tt ? <StatTile testID="kpi-waiting" label={t("clinic.kpi.waiting")} value={tt.waiting} icon="clock" tone={tt.waiting ? "warning" : "success"} hint={`${t("clinic.kpi.inExam")}: ${formatInt(tt.inExam, i18n.language)}`} onPress={go("/clinic/schedule")} /> : null}
      </Row>
      <Row gap={10} style={{ alignItems: "stretch" }}>
        {s.pendingPrescriptions != null ? <StatTile testID="kpi-rx" label={t("clinic.kpi.rx")} value={s.pendingPrescriptions} icon="pill" tone={s.pendingPrescriptions ? "ocean" : "success"} onPress={go("/clinic/prescriptions")} /> : null}
        {s.pendingLabReviews != null ? <StatTile testID="kpi-labs" label={t("clinic.kpi.labs")} value={s.pendingLabReviews} icon="flask" tone={s.pendingLabReviews ? "ocean" : "success"} onPress={go("/clinic/lab-results")} /> : null}
      </Row>
      {s.nextUp ? (
        <ListRow testID="next-up" icon="user" title={`${t("clinic.nextUp")}: ${nameOf(s.nextUp.patient, i18n.language)}`} subtitle={t(`clinic.queue.${queueView(s.nextUp.status, s.nextUp.queueStage).key}`)} badge={s.nextUp.queueTicketNumber ? `#${s.nextUp.queueTicketNumber}` : undefined} badgeTone="warning" onPress={go("/clinic/schedule")} />
      ) : null}
    </View>
  );
}
