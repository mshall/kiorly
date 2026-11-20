import { useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Card, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { KV, QueryView, SectionTitle } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { usePh } from "@/modules/pharmacy/hooks";
import { canOverride, drugName, errText, hasScreen, summarizeChecks, validReason, type SafetyCheck } from "@/modules/pharmacy/lib";
import { useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { uid } from "@/offline/queue";

interface Line { id: string; drugId?: string | null; drug?: { id: string; brandName: string; brandNameAr?: string } | null; drugName?: string; strength?: string; quantity?: number; directions?: string; controlled?: boolean }
interface Rx { id: string; status: string; priority?: string; prescriberName?: string; verificationNotes?: string | null; lines: Line[]; patient?: { id: string; displayName: string; allergies?: string[]; chronicConditions?: string[] } | null }
interface Dispensing { id: string; status: string; safetyChecks: SafetyCheck[] }

export default function RxDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, ar, boot } = usePh();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const rx = useRead<Rx>("pharmacy", `/prescriptions/${id}`);
  const refresh = usePullRefresh(rx);
  const [disp, setDisp] = useState<Dispensing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ov, setOv] = useState<SafetyCheck | null>(null);
  const [reason, setReason] = useState("");
  const [rej, setRej] = useState(false);
  const [rejReason, setRejReason] = useState("");
  const mayOverride = hasScreen(boot, "pharmacy.rx", "rx.override");
  const sum = disp ? summarizeChecks(disp.safetyChecks) : null;

  // OFFLINE: every call here is online-only (validate, dispense, override, sign-off are clinical sign-off paths and are never queued).
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) toast.show(ok); void qc.invalidateQueries({ queryKey: ["pharmacy"] }); }
    catch (e) { toast.show(errText(e, t), "error"); } finally { setBusy(null); }
  };
  const createDraft = () => run("draft", async () => {
    const items = (rx.data?.lines ?? []).filter((l) => l.drugId ?? l.drug?.id).map((l) => ({ prescriptionLineId: l.id, drugId: (l.drugId ?? l.drug?.id) as string, quantity: l.quantity ?? 1 }));
    const d = await api.post<Dispensing>("pharmacy", "/dispensings", { prescriptionId: id, items });
    setDisp(d);
  });
  const reload = async () => { if (disp) setDisp(await api.get<Dispensing>("pharmacy", `/dispensings/${disp.id}`)); };
  const doOverride = () => ov && disp && run("ov", async () => { await api.post("pharmacy", `/dispensings/${disp.id}/override/${ov.id}`, { reason: reason.trim() }); setOv(null); setReason(""); await reload(); }, t("pharmacy.rx.overridden"));
  const signOff = () => disp && run("sign", async () => { await api.post("pharmacy", `/dispensings/${disp.id}/signoff`, {}); await api.post("pharmacy", `/dispensings/${disp.id}/complete`, { idempotencyKey: uid() + uid() }); haptic.success(); await reload(); }, t("pharmacy.rx.completed"));

  const tone = (o: string) => (o === "BLOCK" ? "danger" : o === "WARN" ? "warning" : o === "PASS" ? "success" : "ocean") as "danger" | "warning" | "success" | "ocean";
  return (
    <Screen refresh={refresh} testID="rx-detail" footer={rx.data && ["RECEIVED", "VALIDATING"].includes(rx.data.status) ? (
      <Row gap={8}>
        {!disp ? <Button title={t("pharmacy.rx.runChecks")} icon="shield" onPress={() => void createDraft()} loading={busy === "draft"} style={{ flex: 1 }} testID="rx-run-checks" /> :
          <Button title={t("pharmacy.rx.signOff")} icon="check" disabled={!sum?.canSignOff || disp.status === "COMPLETED"} onPress={() => void signOff()} loading={busy === "sign"} style={{ flex: 1 }} testID="rx-signoff" />}
        <Button variant="secondary" title={t("pharmacy.rx.reject")} onPress={() => setRej(true)} testID="rx-reject" />
      </Row>) : undefined}>
      <Stack.Screen options={{ title: t("pharmacy.rx.detail") }} />
      <QueryView q={rx}>
        {(r) => (
          <View style={{ gap: 12 }}>
            <Card style={{ gap: 8 }}>
              <Row style={{ justifyContent: "space-between" }}><T variant="h2">{r.patient?.displayName}</T><Badge tone={r.priority === "URGENT" ? "danger" : "ink"} label={r.status} /></Row>
              <T variant="small" muted>{r.prescriberName}</T>
              {r.patient?.allergies?.length ? <Banner tone="danger" title={t("pharmacy.rx.allergies")} body={r.patient.allergies.join(", ")} testID="rx-allergies" /> : <Row gap={6}><Icon name="check" size={14} color={colors.success} /><T variant="caption" muted>{t("pharmacy.rx.noAllergies")}</T></Row>}
              {r.verificationNotes ? <T variant="small">{r.verificationNotes}</T> : null}
            </Card>
            <SectionTitle title={t("pharmacy.rx.lineItems")} />
            {r.lines.map((l) => (
              <Card key={l.id} style={{ gap: 4, padding: 12 }}>
                <T weight="semibold">{l.drug ? drugName(l.drug, ar) : l.drugName ?? "-"}</T>
                <T variant="small" muted>{[l.strength, l.directions].filter(Boolean).join(" · ")}</T>
                {l.quantity ? <KV k={t("pharmacy.qty")} v={l.quantity} /> : null}
                {!l.drug && !l.drugId ? <Badge tone="warning" label={t("pharmacy.rx.unmapped")} /> : null}
              </Card>
            ))}
            {disp && sum ? (
              <>
                <SectionTitle title={t("pharmacy.rx.safety")} />
                <Row gap={8}><Badge tone="success" label={`${t("pharmacy.rx.pass")} ${sum.pass}`} /><Badge tone="warning" label={`${t("pharmacy.rx.warn")} ${sum.warn}`} /><Badge tone="danger" label={`${t("pharmacy.rx.block")} ${sum.block}`} /></Row>
                {disp.safetyChecks.map((c) => (
                  <Card key={c.id} testID={`check-${c.kind}`} style={{ gap: 6, padding: 12, borderStartWidth: 4, borderStartColor: c.outcome === "PASS" ? colors.success : c.outcome === "BLOCK" ? colors.danger : c.outcome === "WARN" ? colors.warning : colors.ink2 }}>
                    <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{t(`pharmacy.rx.kind.${c.kind}`, { defaultValue: c.kind })}</T><Badge tone={tone(c.outcome)} label={t(`pharmacy.rx.outcome.${c.outcome}`)} /></Row>
                    {c.detail ? <T variant="small" muted>{c.detail}</T> : null}
                    {c.overridable === false && c.outcome !== "PASS" ? <Row gap={6}><Icon name="lock" size={14} color={colors.danger} /><T variant="caption" color={colors.danger}>{t("pharmacy.rx.locked")}</T></Row> : null}
                    {canOverride(c, mayOverride) ? <Button small variant="secondary" title={t("pharmacy.rx.override")} onPress={() => { setOv(c); setReason(""); }} testID={`override-${c.kind}`} /> : null}
                    {(c.outcome === "WARN" || c.outcome === "BLOCK") && c.overridable !== false && !mayOverride ? <T variant="caption" muted>{t("pharmacy.rx.needsPharmacist")}</T> : null}
                  </Card>
                ))}
              </>
            ) : null}
          </View>
        )}
      </QueryView>
      <Sheet visible={!!ov} onClose={() => setOv(null)} title={t("pharmacy.rx.overrideTitle")} footer={<Button title={t("pharmacy.rx.confirmOverride")} variant="danger" disabled={!validReason(reason)} loading={busy === "ov"} onPress={() => void doOverride()} testID="override-confirm" />}>
        <Banner tone="warning" body={ov?.detail ?? ""} />
        <Field label={t("pharmacy.rx.overrideReason")} value={reason} onChangeText={setReason} multiline testID="override-reason" />
        <T variant="caption" muted>{t("pharmacy.rx.overrideHint")}</T>
      </Sheet>
      <Sheet visible={rej} onClose={() => setRej(false)} title={t("pharmacy.rx.reject")} footer={<Button title={t("pharmacy.rx.reject")} variant="danger" disabled={!validReason(rejReason)} onPress={() => void run("rej", async () => { await api.post("pharmacy", `/prescriptions/${id}/reject`, { reason: rejReason.trim() }); setRej(false); }, t("pharmacy.rx.rejected"))} />}>
        <Field label={t("common.reason")} value={rejReason} onChangeText={setRejReason} multiline />
      </Sheet>
      {rx.data && ["RECEIVED"].includes(rx.data.status) && !disp ? <Button variant="ghost" title={t("pharmacy.rx.markValidated")} onPress={() => void run("val", () => api.post("pharmacy", `/prescriptions/${id}/validate`, {}), t("pharmacy.rx.validated"))} /> : null}
    </Screen>
  );
}
