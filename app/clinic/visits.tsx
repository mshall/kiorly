import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui";
import { FadeIn, ListRow, QueryView, SectionTitle } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { formatDay, formatTime } from "@/lib/format";
import { ClinicError, Title, useLang } from "@/modules/clinic/shared";
import { canStartFrom, nameOf, queueView } from "@/modules/clinic/helpers";

interface Enc { id: string; patientName: string; patientMrn: string; status: string; visitType?: string; chiefComplaint?: string | null; updatedAt: string; appointmentId?: string | null }
interface Sched { items: { id: string; status: string; queueStage?: string; queueTicketNumber?: number; startsAt: string; patient: { id: string; name: string; nameAr?: string } }[] }

export default function Visits() {
  const { t, i18n } = useTranslation();
  const { lang } = useLang();
  const router = useRouter();
  const drafts = useRead<{ items: Enc[] }>("clinic", "/encounters", { query: { status: "DRAFT", pageSize: 20 } });
  const sched = useRead<Sched>("clinic", "/mobile/schedule");
  const refresh = usePullRefresh({ refetch: () => Promise.all([drafts.refetch(), sched.refetch()]) });
  const openApptIds = new Set((drafts.data?.items ?? []).map((e) => e.appointmentId).filter(Boolean));
  const ready = (sched.data?.items ?? []).filter((a) => canStartFrom(a.status, a.queueStage) && !openApptIds.has(a.id));
  return (
    <Screen refresh={refresh} testID="clinic-visits" title={t("tiles.clinic.visits.title")}>
      <Title k="tiles.clinic.visits.title" />
      {ready.length ? (<><SectionTitle title={t("clinic.visits.ready")} />{ready.map((a) => (
        <FadeIn key={a.id}><ListRow testID={`ready-${a.id}`} icon="stethoscope" iconTone={queueView(a.status, a.queueStage).tone} title={`${a.queueTicketNumber ? `#${a.queueTicketNumber} · ` : ""}${nameOf(a.patient, lang)}`} subtitle={formatTime(a.startsAt, i18n.language)} badge={t("clinic.visits.start")} badgeTone="ocean" onPress={() => router.push(`/clinic/visit/${a.id}` as never)} /></FadeIn>
      ))}</>) : null}
      <SectionTitle title={t("clinic.visits.open")} />
      <View style={{ gap: 10 }}>
        {drafts.isError && !drafts.data ? <ClinicError error={drafts.error} onRetry={() => void drafts.refetch()} /> : (
          <QueryView q={drafts} cached={drafts.fromCache} isEmpty={(d) => d.items.length === 0} empty={{ icon: "stethoscope", title: t("clinic.visits.noneOpen"), hint: t("clinic.visits.noneOpenHint") }}>
            {(d) => <>{d.items.map((e) => (
              <ListRow key={e.id} testID={`enc-${e.id}`} icon="clipboard" iconTone="warning" title={e.patientName} subtitle={e.chiefComplaint || e.visitType} meta={`${e.patientMrn} · ${formatDay(e.updatedAt, i18n.language)} ${formatTime(e.updatedAt, i18n.language)}`} badge={t("clinic.visits.continue")} badgeTone="warning" onPress={() => router.push(`/clinic/visit/${e.id}` as never)} />
            ))}</>}
          </QueryView>
        )}
      </View>
    </Screen>
  );
}
