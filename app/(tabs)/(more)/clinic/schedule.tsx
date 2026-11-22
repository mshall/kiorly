import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, Row, useToast } from "@/components/ui";
import { ActionSheet, FadeIn, ListRow, QueryView, Segmented, StatTile, type SheetAction } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { formatTime } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { Title, ClinicError, useClinicBoot, useLang } from "@/modules/clinic/shared";
import { canCheckIn, canStartFrom, canStartVisit, nameOf, queueView, waitMinutes } from "@/modules/clinic/helpers";

interface Appt {
  id: string; startsAt: string; endsAt: string; status: string; queueStage?: string; queueTicketNumber?: number | null; roomLabel?: string | null; checkedInAt?: string | null; isHomeVisit?: boolean;
  patient: { id: string; mrn?: string; name: string; nameAr?: string; age?: number }; clinician?: { name: string }; type?: { name: string; nameAr?: string };
}
interface Schedule { date: string; items: Appt[]; queue: Appt[]; counts?: Record<string, number> }

export default function ClinicSchedule() {
  const { t, i18n } = useTranslation();
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { boot } = useClinicBoot();
  const q = useRead<Schedule>("clinic", "/mobile/schedule", { refetchInterval: 30_000 });
  const refresh = usePullRefresh(q);
  const [tab, setTab] = useState<"queue" | "all">("queue");
  const [sel, setSel] = useState<Appt | null>(null);
  const items = (tab === "queue" ? q.data?.queue : q.data?.items) ?? [];
  const counts = { waiting: 0, inExam: 0, done: 0 };
  (q.data?.items ?? []).forEach((a) => { const k = queueView(a.status, a.queueStage).key; if (k === "waiting") counts.waiting++; else if (k === "inExam") counts.inExam++; else if (k === "completed") counts.done++; });

  const checkIn = async (a: Appt) => {
    try { await api.post("clinic", `/front-desk/appointments/${a.id}/check-in`, {}); toast.show(t("clinic.schedule.checkedIn")); haptic.success(); await qc.invalidateQueries({ queryKey: ["clinic"] }); }
    catch (e) { toast.show((e as ApiError).status === 403 ? t("common.notAllowed") : (e as ApiError).message, "error"); }
  };
  const actions = (a: Appt): SheetAction[] => [
    { label: t("clinic.schedule.openPatient"), icon: "user", onPress: () => router.push(`/clinic/patient/${a.patient.id}` as never) },
    ...(canCheckIn(a.status) ? [{ label: t("clinic.schedule.checkIn"), icon: "check" as const, onPress: () => void checkIn(a) }] : []),
    ...(canStartVisit(boot) && canStartFrom(a.status, a.queueStage) ? [{ label: t("clinic.schedule.startVisit"), icon: "stethoscope" as const, onPress: () => router.push(`/clinic/visit/${a.id}` as never) }] : []),
    { label: t("clinic.vitals.title"), icon: "activity", onPress: () => router.push(`/clinic/vitals?patientId=${a.patient.id}` as never) },
  ];

  return (
    <Screen refresh={refresh} testID="clinic-schedule" title={t("tiles.clinic.schedule.title")}>
      <Title k="tiles.clinic.schedule.title" />
      <Row gap={10} style={{ alignItems: "stretch", marginVertical: 8 }}>
        <StatTile label={t("clinic.queue.waiting")} value={counts.waiting} tone="warning" icon="clock" />
        <StatTile label={t("clinic.queue.inExam")} value={counts.inExam} tone="ocean" icon="stethoscope" />
        <StatTile label={t("clinic.queue.completed")} value={counts.done} tone="success" icon="check" />
      </Row>
      <Segmented value={tab} onChange={setTab} options={[{ value: "queue", label: t("clinic.schedule.queue"), count: q.data?.queue.length }, { value: "all", label: t("clinic.schedule.all"), count: q.data?.items.length }]} />
      <View style={{ gap: 10, marginTop: 12 }}>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} isEmpty={() => items.length === 0} empty={{ icon: "calendar", title: t("clinic.schedule.empty"), hint: t("clinic.schedule.emptyHint") }}>
            {() => <>{items.map((a, i) => {
              const v = queueView(a.status, a.queueStage); const w = waitMinutes(a.checkedInAt);
              return (
                <FadeIn key={a.id} delay={Math.min(i, 6) * 40}>
                  <ListRow testID={`appt-${a.id}`} icon={a.isHomeVisit ? "navigation" : "user"} iconTone={v.tone}
                    title={`${a.queueTicketNumber ? `#${a.queueTicketNumber} · ` : ""}${nameOf(a.patient, lang)}`}
                    subtitle={[formatTime(a.startsAt, i18n.language), nameOf(a.type, lang), a.roomLabel].filter(Boolean).join(" · ")}
                    meta={w != null && v.key === "waiting" ? t("clinic.schedule.waited", { count: w }) : a.clinician?.name}
                    badge={t(`clinic.queue.${v.key}`)} badgeTone={v.tone} onPress={() => { haptic.tap(); setSel(a); }} />
                </FadeIn>
              );
            })}</>}
          </QueryView>
        )}
      </View>
      <ActionSheet visible={!!sel} onClose={() => setSel(null)} title={sel ? nameOf(sel.patient, lang) : ""} actions={sel ? actions(sel) : []} />
    </Screen>
  );
}
