import { useState } from "react";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Banner, Button, Card, Field, Row, T, useToast } from "@/components/ui";
import { KV, SectionTitle } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { useRead } from "@/hooks/useRead";
import { mutate } from "@/offline/mutate";
import { haptic } from "@/lib/haptics";
import { formatDay, formatTime } from "@/lib/format";
import { useLab } from "./useLab";
import { isQueueable, labErrorKey, usableActions, type CustodyEvent, type ScanResult } from "./helpers";
import { useTheme } from "@/theme";

/** Specimen/order card for a scan result: next actions (API `allowed`), label confirmation, temperature, chain of custody. */
export default function SpecimenCard({ scan, scannedCode, onChanged }: { scan: ScanResult; scannedCode: string; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const { owner } = useLab();
  const sp = scan.specimen;
  const labelOk = (c: string) => !!sp && [sp.barcode, sp.accessionNumber].some((x) => x.toLowerCase() === c.toLowerCase());
  const [label, setLabel] = useState(sp && labelOk(scannedCode) ? scannedCode : "");
  const [temp, setTemp] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const custody = useRead<CustodyEvent[]>("lab", `/specimens/${sp?.id}/custody`, { enabled: !!sp });
  if (scan.type === "ORDER") return null;
  const actions = usableActions(scan.nextActions);
  const run = async (action: string) => {
    if (!sp) return;
    const needScan = scan.nextActions?.find((a) => a.action === action)?.requiresScan;
    if (needScan && !label) { setError(t("lab.scanLabelFirst")); haptic.error(); return; }
    if (action === "reject" && reason.trim().length < 3) { setError(t("lab.reasonRequired")); return; }
    setBusy(action); setError(null);
    const body: Record<string, unknown> = action === "reject" ? { reason: reason.trim() } : { scannedBarcode: label };
    const tc = Number(temp); if (temp && !Number.isNaN(tc)) body.temperatureC = tc;
    try {
      const r = await mutate("lab", "POST", `/specimens/${sp.id}/${action}`, body, { label: `${t(`lab.action.${action}`)} ${sp.accessionNumber}`, owner, queueable: isQueueable(action) });
      toast.show(r.queued ? t("sync.queuedToast") : t(`lab.done.${action}`, { defaultValue: t("common.saved") }), r.queued ? "info" : "success");
      onChanged(); void custody.refetch();
    } catch (e) { haptic.error(); setError(t(labErrorKey(e))); } finally { setBusy(null); }
  };
  return (
    <Card testID="specimen-card" style={{ gap: 10 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T variant="h2">{sp?.accessionNumber}</T>
        <Badge tone={sp?.status === "REJECTED" ? "danger" : "ink"} label={sp?.status ?? ""} />
      </Row>
      <KV k={t("lab.order")} v={scan.order?.orderNumber} />
      <KV k={t("common.patient")} v={scan.order?.patient?.fullName} />
      <KV k={t("lab.specimenType")} v={`${sp?.specimenType ?? ""} · ${sp?.container ?? ""}`} />
      <KV k={t("lab.tests")} v={scan.tests?.join(", ")} />
      {scan.order?.priority && scan.order.priority !== "ROUTINE" ? <Badge tone="danger" label={scan.order.priority} /> : null}
      {actions.length ? (
        <View style={{ gap: 10 }}>
          {!label ? (<><T variant="small" weight="semibold">{t("lab.confirmLabel")}</T><ScanField testID="label-field" hint={t("lab.confirmLabelHint")} onCode={(c) => { setLabel(c); setError(null); }} /></>) : <Badge tone="success" icon="check" label={`${t("lab.labelScanned")}: ${label}`} />}
          <Field label={`${t("lab.temperature")} (°C, ${t("common.optional")})`} value={temp} onChangeText={setTemp} keyboardType="decimal-pad" testID="temp-field" />
          {actions.some((a) => a.action === "reject") ? <Field label={t("lab.rejectReason")} value={reason} onChangeText={setReason} testID="reject-reason" /> : null}
          {error ? <Banner tone="danger" body={error} testID="specimen-error" /> : null}
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            {actions.map((a) => <Button key={a.action} style={{ flexGrow: 1 }} variant={a.action === "reject" ? "danger" : "primary"} title={t(`lab.action.${a.action}`)} loading={busy === a.action} onPress={() => void run(a.action)} testID={`act-${a.action}`} />)}
          </Row>
        </View>
      ) : <Banner tone="ink" body={t("lab.noActions")} />}
      <SectionTitle title={t("lab.custody")} />
      {(custody.data ?? scan.custody ?? []).length ? (custody.data ?? scan.custody ?? []).map((c, i, arr) => (
        <Row key={c.id} gap={10} style={{ alignItems: "flex-start" }}>
          <View style={{ alignItems: "center" }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink }} />{i < arr.length - 1 ? <View style={{ width: 2, height: 26, backgroundColor: colors.border }} /> : null}</View>
          <View style={{ flex: 1 }}><T variant="small" weight="semibold">{c.type}{c.temperatureC != null ? ` · ${c.temperatureC}°C` : ""}</T><T variant="caption" muted>{formatDay(c.occurredAt, i18n.language)} {formatTime(c.occurredAt, i18n.language)}{c.location ? ` · ${c.location}` : ""}</T></View>
        </Row>
      )) : <T variant="small" muted>{t("lab.noCustody")}</T>}
      {sp ? <Button small variant="ghost" title={t("lab.label")} onPress={() => void Linking.openURL(`/labels/${sp.id}`).catch(() => {})} /> : null}
    </Card>
  );
}
