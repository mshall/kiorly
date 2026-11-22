import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { ActionSheet, QueryView, Segmented, type SheetAction } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { haptic } from "@/lib/haptics";
import { usePh } from "@/modules/pharmacy/hooks";
import { errText, money, slaLabel, slaMinutes, slaTone, validReason } from "@/modules/pharmacy/lib";
import { statusLabel } from "@/lib/status";

interface Order { id: string; externalOrderId: string; status: string; hasRx: boolean; customerName?: string; orderValue: string; prepaid: boolean; slaDueAt: string | null; deliveryMethod?: string; lines?: unknown[] }
const OPEN = ["RECEIVED", "ACCEPTED", "PARTIALLY_ACCEPTED"];

/** Kiorex orders (integrated tenants only). Accept / reject / ready; SLA countdown ticks every 30 s. */
export default function KiorexOrders() {
  const { t, lang } = usePh();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useRead<Order[]>("pharmacy", "/kiorex-orders", { refetchInterval: 30_000 });
  const refresh = usePullRefresh(q);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  const [sel, setSel] = useState<Order | null>(null);
  const [rej, setRej] = useState<Order | null>(null); const [reason, setReason] = useState("");
  // OFFLINE: order responses are time-critical and legally visible to the patient; online only.
  const call = async (o: Order, action: "accept" | "ready", body: object = {}) => {
    try { await api.post("pharmacy", `/kiorex-orders/${o.id}/${action}`, body); haptic.success(); toast.show(t(`pharmacy.orders.${action}Done`)); await qc.invalidateQueries({ queryKey: ["pharmacy"] }); } catch (e) { toast.show(errText(e, t), "error"); }
  };
  const reject = async () => { if (!rej) return; try { await api.post("pharmacy", `/kiorex-orders/${rej.id}/reject`, { reason: reason.trim() }); toast.show(t("pharmacy.orders.rejectDone")); setRej(null); setReason(""); await qc.invalidateQueries({ queryKey: ["pharmacy"] }); } catch (e) { toast.show(errText(e, t), "error"); } };
  const actions = (o: Order): SheetAction[] => [
    ...(o.status === "RECEIVED" ? [{ label: t("pharmacy.orders.accept"), icon: "check" as const, onPress: () => void call(o, "accept") }, { label: t("pharmacy.orders.reject"), icon: "close" as const, tone: "danger" as const, onPress: () => { setRej(o); setReason(""); } }] : []),
    ...(o.status === "ACCEPTED" || o.status === "PARTIALLY_ACCEPTED" ? [{ label: t("pharmacy.orders.ready"), icon: "box" as const, onPress: () => void call(o, "ready") }] : []),
  ];
  return (
    <Screen refresh={refresh} testID="kx-orders">
      <Stack.Screen options={{ title: t("pharmacy.tile.orders") }} />
      <Segmented value={tab} onChange={setTab} options={[{ value: "open", label: t("pharmacy.orders.open"), count: q.data?.filter((o) => OPEN.includes(o.status)).length }, { value: "done", label: t("pharmacy.orders.history") }]} />
      <QueryView q={q} cached={q.fromCache} isEmpty={(d) => !d.some((o) => OPEN.includes(o.status) === (tab === "open"))} empty={{ icon: "cart", title: t("pharmacy.orders.empty"), hint: t("pharmacy.orders.emptyHint") }}>
        {(d) => <View style={{ gap: 10 }}>{d.filter((o) => OPEN.includes(o.status) === (tab === "open")).map((o) => {
          const m = OPEN.includes(o.status) ? slaMinutes(o.slaDueAt, now) : null;
          return (
            <Card key={o.id} testID={`order-${o.id}`} onPress={() => setSel(o)} style={{ gap: 6 }}>
              <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{o.customerName ?? o.externalOrderId}</T><Badge tone={o.status === "RECEIVED" ? "warning" : o.status === "READY" || o.status === "DISPENSED" ? "success" : o.status === "REJECTED" || o.status === "CANCELLED" || o.status === "EXPIRED" ? "muted" : "ocean"} label={statusLabel(t, o.status, { scope: "pharmacy.orders" })} /></Row>
              <T variant="small" muted>{money(o.orderValue, lang)} · {o.prepaid ? t("pharmacy.orders.prepaid") : t("pharmacy.orders.pay")} · {o.deliveryMethod ?? ""}{o.hasRx ? ` · ${t("pharmacy.rx.title")}` : ""}</T>
              {m != null ? <Badge tone={slaTone(m)} label={`${t("pharmacy.orders.sla")} ${slaLabel(m, lang)}`} icon="clock" /> : null}
            </Card>);
        })}</View>}
      </QueryView>
      <ActionSheet visible={!!sel && actions(sel).length > 0} onClose={() => setSel(null)} title={sel?.customerName ?? ""} actions={sel ? actions(sel) : []} />
      <Sheet visible={!!rej} onClose={() => setRej(null)} title={t("pharmacy.orders.reject")} footer={<Button variant="danger" title={t("pharmacy.orders.reject")} disabled={!validReason(reason)} onPress={() => void reject()} testID="order-reject-confirm" />}>
        <Field label={t("common.reason")} value={reason} onChangeText={setReason} multiline />
      </Sheet>
    </Screen>
  );
}
