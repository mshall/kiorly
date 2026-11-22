import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { FadeIn, KV, ListRow, QueryView, Segmented } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { haptic } from "@/lib/haptics";
import { formatDay } from "@/lib/format";
import { ClinicError, Title, useClinicBoot, useLang } from "@/modules/clinic/shared";
import { canSign, nameOf } from "@/modules/clinic/helpers";

interface Rx { encounterId: string; status: string; visitType?: string; updatedAt: string; signedAt?: string | null; patient: { id: string; mrn: string; name: string; nameAr?: string }; clinician?: { displayName: string }; diagnoses: { labelEn?: string; labelAr?: string; icd10Code?: string }[]; medications: { id: string; drugName: string; dosage?: string; route?: string; safetyOverride?: boolean; unverified?: boolean }[] }

export default function Prescriptions() {
  const { t, i18n } = useTranslation();
  const { lang, ar } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const { boot } = useClinicBoot();
  const [tab, setTab] = useState<"pending" | "signed">("pending");
  const q = useRead<{ items: Rx[] }>("clinic", "/mobile/prescriptions", { query: { status: tab } });
  const refresh = usePullRefresh(q);
  const [sel, setSel] = useState<Rx | null>(null); const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const mayWrite = canSign(boot);
  const sign = async () => {
    if (!sel) return; setBusy(true);
    try { await api.post("clinic", `/mobile/prescriptions/${sel.encounterId}/sign`, {}); haptic.success(); toast.show(t("clinic.rx.signed")); setConfirm(false); setSel(null); await qc.invalidateQueries({ queryKey: ["clinic"] }); }
    catch (e) { const er = e as ApiError; toast.show(er.code === "ALREADY_SIGNED" ? t("clinic.rx.already") : er.status === 403 ? t("common.notAllowed") : er.message, "error"); setConfirm(false); } finally { setBusy(false); }
  };
  return (
    <Screen refresh={refresh} testID="clinic-rx" title={t("tiles.clinic.prescriptions.title")}>
      <Title k="tiles.clinic.prescriptions.title" />
      <Segmented value={tab} onChange={setTab} options={[{ value: "pending", label: t("clinic.rx.pending") }, { value: "signed", label: t("clinic.rx.signedTab") }]} />
      <View style={{ gap: 10, marginTop: 12 }}>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} isEmpty={(d) => d.items.length === 0} empty={{ icon: "pill", title: t("clinic.rx.empty") }}>
            {(d) => <>{d.items.map((r, i) => (
              <FadeIn key={r.encounterId} delay={Math.min(i, 5) * 40}>
                <ListRow testID={`rx-${r.encounterId}`} icon="pill" iconTone={tab === "pending" ? "warning" : "success"} title={nameOf(r.patient, lang)}
                  subtitle={r.medications.map((m) => m.drugName).join("، ")} meta={formatDay(r.signedAt ?? r.updatedAt, i18n.language)}
                  badge={`${r.medications.length}`} badgeTone={r.medications.some((m) => m.safetyOverride || m.unverified) ? "warning" : "muted"} onPress={() => { haptic.tap(); setSel(r); }} />
              </FadeIn>
            ))}</>}
          </QueryView>
        )}
      </View>
      <Sheet visible={!!sel && !confirm} onClose={() => setSel(null)} title={sel ? nameOf(sel.patient, lang) : ""} testID="rx-sheet"
        footer={sel && tab === "pending" && mayWrite ? <Button title={t("clinic.rx.sign")} icon="check" onPress={() => setConfirm(true)} testID="rx-sign" /> : undefined}>
        {sel ? (<>
          <T variant="small" muted>{sel.patient.mrn} · {sel.visitType}</T>
          {sel.medications.map((m) => (
            <View key={m.id} style={{ gap: 4 }}><KV k={m.drugName} v={[m.dosage, m.route].filter(Boolean).join(" · ")} />{m.safetyOverride ? <Badge tone="warning" label={t("clinic.rx.override")} /> : null}{m.unverified ? <Badge tone="warning" label={t("clinic.rx.unverified")} /> : null}</View>
          ))}
          {sel.diagnoses.length ? <T variant="small">{sel.diagnoses.map((d) => (ar ? d.labelAr : d.labelEn) ?? d.labelEn).join("، ")}</T> : null}
          {tab === "pending" && !mayWrite ? <Banner tone="ink" body={t("clinic.rx.readOnly")} /> : null}
        </>) : null}
      </Sheet>
      <Sheet visible={confirm} onClose={() => setConfirm(false)} title={t("clinic.rx.confirmTitle")} testID="rx-confirm" footer={<Row gap={8}><Button variant="secondary" title={t("common.cancel")} onPress={() => setConfirm(false)} style={{ flex: 1 }} /><Button title={t("clinic.rx.sign")} onPress={() => void sign()} loading={busy} style={{ flex: 1 }} testID="rx-confirm-yes" /></Row>}>
        <T>{t("clinic.rx.confirmBody", { name: sel ? nameOf(sel.patient, lang) : "" })}</T>
      </Sheet>
    </Screen>
  );
}
