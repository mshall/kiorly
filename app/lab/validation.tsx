import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Checkbox, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { KV, ListRow, QueryView, Segmented } from "@/components/kit";
import { api } from "@/api/client";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { haptic } from "@/lib/haptics";
import { useLab } from "@/modules/lab/useLab";
import { flagTone, labErrorKey, needsDeltaAck, rangeText, resultValue, type ResultRow } from "@/modules/lab/helpers";

type Stage = "tech" | "medical" | "release";
interface Release { readyToSign: { orderId: string; orderNumber: string; patient: string }[]; signedNotReleased: { reportId?: string; id?: string; orderNumber?: string; patient?: string }[] }

// OFFLINE: validation, sign-off and release are never queued; they need a live, audited server decision.
export default function Validation() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { canSign, can } = useLab();
  const [stage, setStage] = useState<Stage>("tech");
  const [sel, setSel] = useState<ResultRow | null>(null);
  const [signOrder, setSignOrder] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [ack, setAck] = useState(false); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const queue = useRead<ResultRow[]>("lab", "/validation-queue", { query: { stage: stage === "release" ? "medical" : stage }, enabled: stage !== "release" });
  const rel = useRead<Release>("lab", "/release-queue", { enabled: stage === "release" });
  const refresh = usePullRefresh({ refetch: async () => { await Promise.all([queue.refetch(), rel.refetch()]); } });
  const reload = () => qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === "/validation-queue" || q.queryKey[1] === "/release-queue" || q.queryKey[1] === "/mobile/summary" });
  const grouped = useMemo(() => { const m = new Map<string, ResultRow[]>(); for (const r of queue.data ?? []) { const k = r.orderItem?.order?.orderNumber ?? "-"; m.set(k, [...(m.get(k) ?? []), r]); } return [...m.entries()]; }, [queue.data]);
  const close = () => { setSel(null); setAck(false); setNote(""); setErr(null); };

  const validate = async () => {
    if (!sel) return; setBusy(true); setErr(null);
    try {
      if (stage === "tech") await api.post("lab", `/results/${sel.id}/tech-validate`, { deltaAcknowledged: ack, ...(note ? { note } : {}) });
      else await api.post("lab", `/results/${sel.id}/medical-validate`, note ? { note } : {});
      haptic.success(); toast.show(t("lab.validated")); close(); await reload();
    } catch (e) { haptic.error(); setErr(t(labErrorKey(e))); } finally { setBusy(false); }
  };
  const sign = async () => {
    if (!signOrder) return; setBusy(true); setErr(null);
    try { await api.post("lab", `/orders/${signOrder.orderId}/reports`, {}); haptic.success(); toast.show(t("lab.signed")); setSignOrder(null); await reload(); }
    catch (e) { haptic.error(); setErr(t(labErrorKey(e))); } finally { setBusy(false); }
  };
  return (
    <Screen refresh={refresh} testID="lab-validation">
      <Stack.Screen options={{ title: t("tiles.lab.validation.title") }} />
      <Segmented value={stage} onChange={setStage} options={[{ value: "tech", label: t("lab.stageTech") }, { value: "medical", label: t("lab.stageMedical") }, { value: "release", label: t("lab.stageRelease") }]} />
      {stage !== "release" && stage === "medical" && !canSign && !can("results.medical_validate") ? <Banner tone="ink" body={t("lab.viewOnlyMedical")} /> : null}
      {stage !== "release" ? (
        <QueryView q={queue} cached={queue.fromCache} isEmpty={(d) => !d.length} empty={{ icon: "award", title: t("lab.queueEmpty") }}>
          {() => <View style={{ gap: 14 }}>{grouped.map(([order, rows]) => (
            <View key={order} style={{ gap: 8 }} testID={`order-${order}`}>
              <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{order}</T><T variant="small" muted>{rows[0].orderItem?.order?.patient?.fullName}</T></Row>
              {rows.map((r) => (
                <ListRow key={r.id} testID={`res-${r.id}`} icon={needsDeltaAck(r) ? "alert" : "activity"} iconTone={needsDeltaAck(r) ? "warning" : "ink"} title={`${r.analyte?.nameEn ?? r.analyte?.code} · ${resultValue(r)}`} subtitle={`${t("lab.range")} ${rangeText(r) || "-"}`} meta={r.specimen?.accessionNumber}
                  badge={needsDeltaAck(r) ? t("lab.deltaFailed") : r.flag} badgeTone={needsDeltaAck(r) ? "warning" : flagTone(r.flag)} onPress={() => setSel(r)} />
              ))}
            </View>))}</View>}
        </QueryView>
      ) : (
        <QueryView q={rel} isEmpty={(d) => !d.readyToSign.length && !d.signedNotReleased.length} empty={{ icon: "file", title: t("lab.queueEmpty") }}>
          {(d) => <View style={{ gap: 10 }}>
            {d.readyToSign.map((o) => <ListRow key={o.orderId} testID={`ready-${o.orderNumber}`} icon="file" title={o.orderNumber} subtitle={o.patient} badge={t("lab.readyToSign")} badgeTone="success" onPress={canSign ? () => setSignOrder(o) : undefined} />)}
            {d.signedNotReleased.map((o, i) => <ListRow key={i} icon="check" title={o.orderNumber ?? "-"} subtitle={o.patient} badge={t("lab.signedNotReleased")} badgeTone="ocean" />)}
            {!canSign ? <Banner tone="ink" body={t("lab.signaturesOnly")} /> : null}
          </View>}
        </QueryView>
      )}
      <Sheet visible={!!sel} onClose={close} title={sel?.analyte?.nameEn ?? ""} testID="validate-sheet"
        footer={<Button title={stage === "tech" ? t("lab.techValidate") : t("lab.medicalValidate")} onPress={() => void validate()} loading={busy} disabled={!!sel && stage === "tech" && needsDeltaAck(sel) && !ack} testID="validate-confirm" />}>
        {sel ? (<>
          <Row gap={8}><Badge tone={flagTone(sel.flag)} label={sel.flag} />{needsDeltaAck(sel) ? <Badge tone="warning" label={t("lab.deltaFailed")} /> : null}</Row>
          <KV k={t("lab.result")} v={resultValue(sel)} /><KV k={t("lab.range")} v={rangeText(sel)} /><KV k={t("lab.delta")} v={sel.deltaPercent != null ? `${sel.deltaPercent}%` : "-"} /><KV k={t("lab.accession")} v={sel.specimen?.accessionNumber} />
          {stage === "tech" && needsDeltaAck(sel) ? <Checkbox checked={ack} onChange={setAck} label={t("lab.deltaAck")} testID="delta-ack" /> : null}
          <Field label={t("common.notes")} value={note} onChangeText={setNote} multiline />
          {err ? <Banner tone="danger" body={err} testID="validate-error" /> : null}
        </>) : null}
      </Sheet>
      <Sheet visible={!!signOrder} onClose={() => { setSignOrder(null); setErr(null); }} title={t("lab.signReport")} footer={<Button title={t("lab.signReport")} onPress={() => void sign()} loading={busy} testID="sign-confirm" />}>
        <T>{signOrder?.orderNumber}</T><T variant="small" muted>{t("lab.signHint")}</T>
        {err ? <Banner tone="danger" body={err} /> : null}
      </Sheet>
    </Screen>
  );
}
