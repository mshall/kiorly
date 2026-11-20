import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Badge, Banner, Button, Card, Row, Screen, T } from "@/components/ui";
import { KV, ListRow, SectionTitle, SkeletonList, StatTile } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { formatDay, formatMoney, formatTime } from "@/lib/format";
import { useTheme } from "@/theme";
import { Avatar } from "@/modules/clinic/Avatar";
import { ClinicError, Title, useClinicBoot, useLang } from "@/modules/clinic/shared";
import { hasModule, patientName } from "@/modules/clinic/helpers";

interface Summary {
  allergies: { id: string; code: string; otherComment?: string | null }[]; activeProblems: { icd10Code?: string; labelEn?: string; labelAr?: string }[];
  currentMedications: { drugName: string; dosage?: string; frequency?: string }[];
  lastVitals?: { at: string; heartRate?: number; spo2?: number; bpSystolic?: number; bpDiastolic?: number; temperature?: number; weightKg?: number } | null;
  alerts: { kind: string; messageEn: string; messageAr: string }[]; outstandingBalance?: number; outstandingBalanceCurrency?: string;
  upcomingAppointments: { id: string; startsAt: string; typeName?: string; clinicianName?: string; status: string }[];
}
interface Patient { id: string; mrn: string; firstNameEn?: string; lastNameEn?: string; firstNameAr?: string; lastNameAr?: string; dob?: string; gender?: string; phone?: string }
interface Timeline { items: { type: "VISIT" | "INVOICE"; at: string; encounterId?: string; status?: string; visitType?: string; number?: string }[] }
interface Orders { items?: { id: string; status: string; resultsReadyAt?: string; items: { code: string; nameEn: string; nameAr?: string; resultValue?: string; resultUnit?: string; resultFlag?: string }[] }[] }

const ageOf = (dob?: string) => (dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000) : null);

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { lang, ar } = useLang();
  const { colors } = useTheme();
  const router = useRouter();
  const { boot } = useClinicBoot();
  const p = useRead<Patient>("clinic", `/patients/${id}`);
  const s = useRead<Summary>("clinic", `/patients/${id}/summary`);
  const tl = useRead<Timeline>("clinic", `/patients/${id}/timeline`);
  const labs = useRead<Orders | NonNullable<Orders["items"]>>("clinic", "/clinical/orders", { query: { patientId: id, pageSize: 3 } });
  const refresh = usePullRefresh({ refetch: () => Promise.all([p.refetch(), s.refetch(), tl.refetch(), labs.refetch()]) });
  const labItems = (Array.isArray(labs.data) ? labs.data : labs.data?.items) ?? [];
  const name = p.data ? patientName(p.data, lang) : "";
  const sm = s.data; const v = sm?.lastVitals;
  const danger = (flag?: string) => !!flag && /CRIT|HIGH|LOW|^H$|^L$/i.test(flag) && flag !== "N";

  return (
    <Screen refresh={refresh} testID="clinic-patient">
      <Title text={name || t("clinic.patients.title")} />
      {p.isError && !p.data ? <ClinicError error={p.error} onRetry={() => void p.refetch()} /> : null}
      {p.data ? (
        <Card style={{ gap: 12 }}>
          <Row gap={14}>
            <Avatar name={name} size={56} />
            <View style={{ flex: 1 }}>
              <T variant="h2" testID="patient-name">{name}</T>
              <T variant="small" muted>{[p.data.mrn, ageOf(p.data.dob) != null ? `${ageOf(p.data.dob)} ${ar ? "سنة" : "y"}` : null, p.data.gender === "F" ? (ar ? "أنثى" : "Female") : p.data.gender === "M" ? (ar ? "ذكر" : "Male") : null].filter(Boolean).join(" · ")}</T>
              {p.data.phone ? <T variant="small" muted>{p.data.phone}</T> : null}
            </View>
          </Row>
          <Row gap={8}>
            {hasModule(boot, "clinic.vitals") ? <Button small variant="secondary" icon="activity" title={t("clinic.vitals.title")} onPress={() => router.push(`/clinic/vitals?patientId=${id}` as never)} style={{ flex: 1 }} testID="patient-vitals" /> : null}
          </Row>
        </Card>
      ) : p.isLoading ? <SkeletonList rows={1} /> : null}

      {sm?.alerts?.length ? <Banner tone="warning" testID="patient-alerts">{sm.alerts.map((a) => <T key={a.kind + a.messageEn} variant="small">• {ar ? a.messageAr : a.messageEn}</T>)}</Banner> : null}
      {s.isLoading ? <SkeletonList rows={3} /> : null}
      {s.isError && !s.data ? <ClinicError error={s.error} onRetry={() => void s.refetch()} /> : null}
      {sm ? (
        <View style={{ gap: 12 }}>
          <SectionTitle title={t("clinic.patient.allergies")} />
          <Card style={{ gap: 8 }} testID="patient-allergies">
            {sm.allergies.length ? <Row gap={8} style={{ flexWrap: "wrap" }}>{sm.allergies.map((a) => <Badge key={a.id} tone="danger" icon="alert" label={a.otherComment || a.code} />)}</Row> : <T variant="small" muted>{t("clinic.patient.noAllergies")}</T>}
            {sm.activeProblems.map((pr, i) => <T key={i} variant="small">• {(ar ? pr.labelAr : pr.labelEn) ?? pr.labelEn} {pr.icd10Code ? `(${pr.icd10Code})` : ""}</T>)}
          </Card>
          {v ? (
            <>
              <SectionTitle title={t("clinic.patient.lastVitals")} />
              <Row gap={10} style={{ alignItems: "stretch", flexWrap: "wrap" }}>
                {v.bpSystolic != null ? <StatTile label={t("clinic.vitals.bp")} value={`${v.bpSystolic}/${v.bpDiastolic ?? "-"}`} icon="heart" /> : null}
                {v.heartRate != null ? <StatTile label={t("clinic.vitals.pulse")} value={v.heartRate} icon="activity" /> : null}
                {v.spo2 != null ? <StatTile label="SpO2" value={`${v.spo2}%`} tone={v.spo2 < 92 ? "danger" : "success"} /> : null}
                {v.temperature != null ? <StatTile label={t("clinic.vitals.temp")} value={`${v.temperature}°`} tone={v.temperature >= 38 ? "warning" : "ink"} icon="thermometer" /> : null}
              </Row>
              <T variant="caption" muted>{formatDay(v.at, i18n.language)} {formatTime(v.at, i18n.language)}</T>
            </>
          ) : null}
          <SectionTitle title={t("clinic.patient.meds")} />
          <Card style={{ gap: 6 }}>{sm.currentMedications.length ? sm.currentMedications.map((m, i) => <KV key={i} k={m.drugName} v={[m.dosage, m.frequency].filter(Boolean).join(" · ")} />) : <T variant="small" muted>{t("common.none")}</T>}</Card>
          {sm.outstandingBalance ? <KV k={t("clinic.patient.balance")} v={formatMoney(sm.outstandingBalance, i18n.language)} tone="warning" /> : null}
          {sm.upcomingAppointments.length ? (<><SectionTitle title={t("clinic.patient.upcoming")} />{sm.upcomingAppointments.slice(0, 3).map((a) => <ListRow key={a.id} icon="calendar" title={`${formatDay(a.startsAt, i18n.language)} ${formatTime(a.startsAt, i18n.language)}`} subtitle={[a.typeName, a.clinicianName].filter(Boolean).join(" · ")} badge={a.status} />)}</>) : null}
        </View>
      ) : null}

      <SectionTitle title={t("clinic.patient.visits")} />
      {tl.data?.items.filter((x) => x.type === "VISIT").slice(0, 5).map((x) => (
        <ListRow key={x.encounterId} testID={`visit-${x.encounterId}`} icon="stethoscope" title={`${x.visitType ?? t("clinic.visits.visit")}`} subtitle={`${formatDay(x.at, i18n.language)}`} badge={x.status === "DRAFT" ? t("clinic.visits.draft") : t("clinic.visits.signed")} badgeTone={x.status === "DRAFT" ? "warning" : "success"}
          onPress={x.status === "DRAFT" ? () => router.push(`/clinic/visit/${x.encounterId}` as never) : undefined} />
      ))}
      {tl.data && !tl.data.items.some((x) => x.type === "VISIT") ? <T variant="small" muted>{t("clinic.visits.none")}</T> : null}

      <SectionTitle title={t("clinic.patient.labs")} />
      {labItems.slice(0, 3).map((o) => (
        <Card key={o.id} style={{ gap: 6 }}>
          <T variant="caption" muted>{o.resultsReadyAt ? `${formatDay(o.resultsReadyAt, i18n.language)}` : o.status}</T>
          {o.items.map((it) => <Row key={it.code} style={{ justifyContent: "space-between" }}><T variant="small">{ar ? it.nameAr ?? it.nameEn : it.nameEn}</T><T variant="small" weight="semibold" color={danger(it.resultFlag) ? colors.danger : colors.text}>{it.resultValue ?? "-"} {it.resultUnit ?? ""}</T></Row>)}
        </Card>
      ))}
      {labs.data && !labItems.length ? <T variant="small" muted>{t("common.none")}</T> : null}
    </Screen>
  );
}
