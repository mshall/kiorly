import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Card, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { KV, QueryView, SectionTitle, Segmented } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { usePh } from "@/modules/pharmacy/hooks";
import { drugName, errText } from "@/modules/pharmacy/lib";

interface Disc { id: string; drug: { brandName: string; brandNameAr?: string; strength?: string; controlledSchedule?: string }; expectedQty: number; countedQty: number; difference: number; notes?: string; reportedByName: string; createdAt: string; countersigns: { witnessId: string }[]; witnessPending: boolean; canCountersign: boolean }
interface Bal { drugId: string; drug: { brandName: string; brandNameAr?: string; strength?: string; controlledSchedule?: string }; onHand: number; registerBalance: number; inSync: boolean }

/** Controlled-register witness countersign (the witness uses their own phone and account). */
export default function Controlled() {
  const { t, ar } = usePh();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"witness" | "balances">("witness");
  const pend = useRead<{ items: Disc[] }>("pharmacy", "/mobile/pharmacy/controlled/pending-witness");
  const bal = useRead<Bal[]>("pharmacy", "/controlled/balances", { enabled: tab === "balances" });
  const refresh = usePullRefresh(tab === "witness" ? pend : bal);
  const [sel, setSel] = useState<Disc | null>(null);
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  // OFFLINE: countersign is a controlled-substance control; never queued (witness must be present and online).
  const sign = async () => {
    if (!sel) return;
    const ok = Platform.OS === "web" ? (typeof window === "undefined" || window.confirm(t("pharmacy.controlled.confirm"))) : await new Promise<boolean>((res) => Alert.alert(t("pharmacy.controlled.countersign"), t("pharmacy.controlled.confirm"), [{ text: t("common.cancel"), style: "cancel", onPress: () => res(false) }, { text: t("pharmacy.controlled.countersign"), onPress: () => res(true) }]));
    if (!ok) return; setBusy(true);
    try { await api.post("pharmacy", "/mobile/pharmacy/controlled/countersign", { discrepancyId: sel.id, note: note.trim() || undefined }); haptic.success(); toast.show(t("pharmacy.controlled.signed")); setSel(null); setNote(""); await qc.invalidateQueries({ queryKey: ["pharmacy"] }); }
    catch (e) { toast.show(errText(e, t), "error"); } finally { setBusy(false); }
  };
  return (
    <Screen refresh={refresh} testID="controlled">
      <Stack.Screen options={{ title: t("pharmacy.tile.controlled") }} />
      <Segmented value={tab} onChange={setTab} options={[{ value: "witness", label: t("pharmacy.controlled.pending"), count: pend.data?.items.length }, { value: "balances", label: t("pharmacy.controlled.balances") }]} />
      {tab === "witness" ? (
        <QueryView q={pend} cached={pend.fromCache} isEmpty={(d) => !d.items.length} empty={{ icon: "shield", title: t("pharmacy.controlled.none"), hint: t("pharmacy.controlled.noneHint") }}>
          {(d) => <View style={{ gap: 10 }}>{d.items.map((x) => (
            <Card key={x.id} testID={`disc-${x.id}`} onPress={() => setSel(x)} style={{ gap: 6, borderStartWidth: 4, borderStartColor: colors.danger }}>
              <Row style={{ justifyContent: "space-between" }}><T weight="semibold" style={{ flex: 1 }}>{drugName(x.drug, ar)}</T><Badge tone="danger" label={`${x.difference > 0 ? "+" : ""}${x.difference}`} /></Row>
              <T variant="small" muted>{t("pharmacy.controlled.reporter", { name: x.reportedByName })} · {x.drug.controlledSchedule?.replace("SCHEDULE_", "S")}</T>
              <Badge tone={x.canCountersign ? "warning" : "muted"} label={x.canCountersign ? t("pharmacy.controlled.canSign") : t("pharmacy.controlled.cannotSign")} />
            </Card>))}</View>}
        </QueryView>
      ) : (
        <QueryView q={bal} isEmpty={(d) => !d.length}>
          {(d) => <View style={{ gap: 10 }}>{d.map((b) => <Card key={b.drugId} style={{ gap: 4, padding: 12 }}><Row style={{ justifyContent: "space-between" }}><T weight="semibold" style={{ flex: 1 }}>{drugName(b.drug, ar)}</T><Icon name={b.inSync ? "check" : "alert"} size={18} color={b.inSync ? colors.success : colors.danger} /></Row><KV k={t("pharmacy.controlled.shelf")} v={b.onHand} /><KV k={t("pharmacy.controlled.register")} v={b.registerBalance} tone={b.inSync ? undefined : "danger"} /></Card>)}</View>}
        </QueryView>
      )}
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={t("pharmacy.controlled.countersign")} footer={<Button title={t("pharmacy.controlled.countersign")} onPress={() => void sign()} loading={busy} disabled={!sel?.canCountersign} testID="countersign-confirm" />}>
        {sel ? (
          <>
            <T weight="semibold">{drugName(sel.drug, ar)}</T>
            <KV k={t("pharmacy.count.expected")} v={sel.expectedQty} /><KV k={t("pharmacy.count.counted")} v={sel.countedQty} /><KV k={t("pharmacy.controlled.diff")} v={sel.difference} tone="danger" />
            {sel.notes ? <T variant="small" muted>{sel.notes}</T> : null}
            {!sel.canCountersign ? <Banner tone="warning" body={t("pharmacy.controlled.mustDiffer")} testID="witness-rule" /> : <Banner tone="ink" body={t("pharmacy.controlled.rule")} />}
            <Field label={t("common.notes")} value={note} onChangeText={setNote} multiline />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
