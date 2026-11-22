import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Card, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { KV, SectionTitle, SkeletonList } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { mutate } from "@/offline/mutate";
import { haptic } from "@/lib/haptics";
import { ClinicError, Title, useClinicBoot, useLang } from "@/modules/clinic/shared";
import { canSign, canStartVisit, diffForm } from "@/modules/clinic/helpers";

interface Enc {
  id: string; status: string; patientId: string; patientName: string; patientMrn: string; visitType?: string; updatedAt: string;
  chiefComplaint?: string | null; subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null;
  heartRate?: number | null; spo2?: number | null; bpSystolic?: number | null; bpDiastolic?: number | null; temperature?: number | null; weightKg?: number | null;
  diagnoses: { id: string; labelEn?: string; labelAr?: string; icd10Code?: string; description?: string }[]; medications: { id: string; drugName: string; dosage?: string; frequency?: string; route?: string }[];
}
type Form = { chiefComplaint: string; subjective: string; objective: string; assessment: string; plan: string; heartRate: string; spo2: string; bpSystolic: string; bpDiastolic: string; temperature: string; weightKg: string };
const toForm = (e: Enc): Form => ({ chiefComplaint: e.chiefComplaint ?? "", subjective: e.subjective ?? "", objective: e.objective ?? "", assessment: e.assessment ?? "", plan: e.plan ?? "", heartRate: e.heartRate?.toString() ?? "", spo2: e.spo2?.toString() ?? "", bpSystolic: e.bpSystolic?.toString() ?? "", bpDiastolic: e.bpDiastolic?.toString() ?? "", temperature: e.temperature?.toString() ?? "", weightKg: e.weightKg?.toString() ?? "" });
export default function Visit() {
  const { appointmentId: id } = useLocalSearchParams<{ appointmentId: string }>();
  const { t } = useTranslation();
  const { ar } = useLang();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { boot, email } = useClinicBoot();
  const [encId, setEncId] = useState<string | null>(null);
  const [startErr, setStartErr] = useState<unknown>(null);
  const first = useRead<Enc>("clinic", `/encounters/${id}`, { enabled: !!id });
  // the route param is an encounter id (from lists) or an appointment id (from the queue): a 404 means "appointment" -> open/continue its draft
  useEffect(() => {
    if (first.data) setEncId(first.data.id);
    else if (first.error instanceof ApiError && (first.error.status === 404 || first.error.status === 400) && canStartVisit(boot)) {
      void api.post<{ encounterId: string }>("clinic", `/front-desk/appointments/${id}/start-visit`, {}).then((r) => setEncId(r.encounterId)).catch(setStartErr);
    }
  }, [first.data, first.error, id, boot]);
  const enc = useRead<Enc>("clinic", `/encounters/${encId}`, { enabled: !!encId });
  const refresh = usePullRefresh(enc);
  const [form, setForm] = useState<Form | null>(null);
  const base = useRef<Form | null>(null);
  const baseRev = useRef<string | null>(null);
  useEffect(() => { if (enc.data && (!form || (baseRev.current !== enc.data.updatedAt && form && JSON.stringify(form) === JSON.stringify(base.current)))) { const f = toForm(enc.data); setForm(f); base.current = f; baseRev.current = enc.data.updatedAt; } }, [enc.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  const draft = enc.data?.status === "DRAFT";
  const body = form && base.current ? diffForm(base.current, form) : {};
  const dirty = Object.keys(body).length > 0;
  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!enc.data || !dirty) return; setBusy(true);
    try {
      const r = await mutate("clinic", "PATCH", `/encounters/${enc.data.id}`, body, { label: `${t("clinic.visit.notes")} · ${enc.data.patientName}`, owner: email, queueable: true, precondition: { path: `/encounters/${enc.data.id}`, field: "updatedAt", base: baseRev.current } });
      if (r.queued) { toast.show(t("sync.queuedToast"), "info"); base.current = form; }
      else { haptic.success(); toast.show(t("common.saved")); base.current = form; await qc.invalidateQueries({ queryKey: ["clinic", `/encounters/${enc.data.id}`] }); const fresh = await enc.refetch(); if (fresh.data) baseRev.current = fresh.data.updatedAt; }
    } catch (e) { toast.show((e as ApiError).status === 403 ? t("common.notAllowed") : (e as ApiError).message, "error"); } finally { setBusy(false); }
  };
  const sign = async () => {
    if (!enc.data) return; setBusy(true);
    try {
      if (dirty) await api.patch("clinic", `/encounters/${enc.data.id}`, body);
      await api.post("clinic", `/encounters/${enc.data.id}/finalize`, {});
      haptic.success(); toast.show(t("clinic.visit.signed")); setConfirm(false); await qc.invalidateQueries({ queryKey: ["clinic"] }); router.back();
    } catch (e) { const er = e as ApiError; toast.show(er.status === 403 ? t("common.notAllowed") : er.message, "error"); setConfirm(false); } finally { setBusy(false); }
  };

  if (startErr) return <Screen><ClinicError error={startErr} /></Screen>;
  if (first.isError && !(first.error instanceof ApiError && first.error.status < 500 && first.error.status !== 0 && canStartVisit(boot)) && !encId) return <Screen><ClinicError error={first.error} onRetry={() => void first.refetch()} /></Screen>;
  const e = enc.data;
  return (
    <Screen refresh={refresh} testID="clinic-visit" footer={e && draft ? (
      <Row gap={8}>
        <Button variant="secondary" title={t("clinic.visit.saveDraft")} onPress={() => void save()} disabled={!dirty} loading={busy} style={{ flex: 1 }} testID="visit-save" />
        {canSign(boot) ? <Button title={t("clinic.visit.sign")} onPress={() => setConfirm(true)} style={{ flex: 1 }} testID="visit-sign" /> : null}
      </Row>) : undefined}>
      <Title text={e?.patientName ?? t("clinic.visit.title")} />
      {!e || !form ? <SkeletonList rows={4} /> : (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}><T variant="h2">{e.patientName}</T><Badge tone={draft ? "warning" : "success"} label={draft ? t("clinic.visits.draft") : t("clinic.visits.signed")} /></Row>
            <T variant="small" muted>{e.patientMrn} · {e.visitType}</T>
            <Button small variant="ghost" title={t("clinic.visit.openPatient")} onPress={() => router.push(`/clinic/patient/${e.patientId}` as never)} />
          </Card>
          {!canSign(boot) && draft ? <Banner tone="ink" body={t("clinic.visit.nurseNote")} /> : null}
          <SectionTitle title={t("clinic.visit.vitals")} />
          <Row gap={8}><View style={{ flex: 1 }}><Field label={t("clinic.vitals.sys")} value={form.bpSystolic} onChangeText={set("bpSystolic")} keyboardType="number-pad" editable={draft} testID="v-sys" /></View><View style={{ flex: 1 }}><Field label={t("clinic.vitals.dia")} value={form.bpDiastolic} onChangeText={set("bpDiastolic")} keyboardType="number-pad" editable={draft} /></View></Row>
          <Row gap={8}><View style={{ flex: 1 }}><Field label={t("clinic.vitals.pulse")} value={form.heartRate} onChangeText={set("heartRate")} keyboardType="number-pad" editable={draft} /></View><View style={{ flex: 1 }}><Field label="SpO2" value={form.spo2} onChangeText={set("spo2")} keyboardType="number-pad" editable={draft} /></View></Row>
          <Row gap={8}><View style={{ flex: 1 }}><Field label={t("clinic.vitals.temp")} value={form.temperature} onChangeText={set("temperature")} keyboardType="decimal-pad" editable={draft} /></View><View style={{ flex: 1 }}><Field label={t("clinic.vitals.weight")} value={form.weightKg} onChangeText={set("weightKg")} keyboardType="decimal-pad" editable={draft} /></View></Row>
          <SectionTitle title={t("clinic.visit.notes")} />
          <Field label={t("clinic.visit.complaint")} value={form.chiefComplaint} onChangeText={set("chiefComplaint")} editable={draft} testID="n-complaint" />
          <Field label="S · " value={form.subjective} onChangeText={set("subjective")} multiline editable={draft} style={{ minHeight: 84, textAlignVertical: "top" }} accessibilityLabel={t("clinic.visit.subjective")} testID="n-subjective" />
          <Field label="O · " value={form.objective} onChangeText={set("objective")} multiline editable={draft} style={{ minHeight: 84, textAlignVertical: "top" }} accessibilityLabel={t("clinic.visit.objective")} />
          <Field label="A · " value={form.assessment} onChangeText={set("assessment")} multiline editable={draft} style={{ minHeight: 84, textAlignVertical: "top" }} accessibilityLabel={t("clinic.visit.assessment")} />
          <Field label="P · " value={form.plan} onChangeText={set("plan")} multiline editable={draft} style={{ minHeight: 84, textAlignVertical: "top" }} accessibilityLabel={t("clinic.visit.plan")} />
          <SectionTitle title={t("clinic.visit.meds")} />
          <Card style={{ gap: 6 }}>{e.medications.length ? e.medications.map((m) => <KV key={m.id} k={m.drugName} v={[m.dosage, m.route].filter(Boolean).join(" · ")} />) : <T variant="small" muted>{t("common.none")}</T>}</Card>
          {e.diagnoses.length ? (<><SectionTitle title={t("clinic.visit.diagnoses")} /><Card style={{ gap: 6 }}>{e.diagnoses.map((d) => <T key={d.id} variant="small">• {(ar ? d.labelAr : d.labelEn) ?? d.description ?? d.labelEn} {d.icd10Code ? `(${d.icd10Code})` : ""}</T>)}</Card></>) : null}
        </View>
      )}
      <Sheet visible={confirm} onClose={() => setConfirm(false)} title={t("clinic.visit.signTitle")} testID="sign-sheet" footer={<Button title={t("clinic.visit.signConfirm")} onPress={() => void sign()} loading={busy} testID="sign-confirm" />}>
        <T>{t("clinic.visit.signBody")}</T>
      </Sheet>
    </Screen>
  );
}
