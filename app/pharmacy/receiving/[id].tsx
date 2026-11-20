import { useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Card, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { KV, Progress, QueryView, SectionTitle } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { usePh } from "@/modules/pharmacy/hooks";
import { drugName, errText, lineRemaining, matchPoLine, parseGs1, poProgress, type Po } from "@/modules/pharmacy/lib";
import { uid } from "@/offline/queue";
import { haptic } from "@/lib/haptics";

interface Drug { id: string; brandName: string; brandNameAr?: string; coldChain?: boolean }
interface Entry { lineId: string; drugId: string; lotNumber: string; expiryDate: string; quantity: number; unitCost: string; temperatureC?: number }

/** Receive against a PO by scanning packs. OFFLINE: receipts are posted online only (stock + PO ledger; idempotencyKey makes a retry safe). */
export default function ReceivePo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, ar, boot } = usePh();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const po = useRead<Po>("pharmacy", `/purchase-orders/${id}`);
  const refresh = usePullRefresh(po);
  const drugIds = useMemo(() => po.data?.lines.map((l) => l.drugId) ?? [], [po.data]);
  const drugs = useQueries({ queries: drugIds.map((d) => ({ queryKey: ["pharmacy", "drug", d], queryFn: () => api.get<Drug>("pharmacy", `/catalogue/drugs/${d}`), staleTime: 600_000 })) });
  const nameOf = (drugId: string) => { const d = drugs.find((x) => x.data?.id === drugId)?.data; return d ? drugName(d, ar) : drugId.slice(-6); };
  const coldOf = (drugId: string) => !!drugs.find((x) => x.data?.id === drugId)?.data?.coldChain;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<(Entry & { cold: boolean; name: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState("");
  const scanned = useMemo(() => entries.reduce<Record<string, number>>((m, e) => ({ ...m, [e.lineId]: (m[e.lineId] ?? 0) + e.quantity }), {}), [entries]);

  const onScan = async (code: string) => {
    if (!po.data) return false;
    try {
      const g = parseGs1(code);
      const r = await api.post<{ gtin: string; lotNumber?: string | null; expiryDate?: string | null; drug?: Drug }>("pharmacy", "/inventory/scan/parse", { code: g.plain });
      const line = matchPoLine(po.data, r.drug?.id);
      if (!line) { haptic.error(); toast.show(t("pharmacy.receiving.notOnPo"), "error"); return false; }
      haptic.success();
      setDraft({ lineId: line.id, drugId: line.drugId, lotNumber: r.lotNumber ?? "", expiryDate: (r.expiryDate ?? "").slice(0, 10), quantity: Math.min(1, lineRemaining(line, scanned[line.id] ?? 0)) || 1, unitCost: line.unitCost ?? "0", cold: !!r.drug?.coldChain, name: r.drug ? drugName(r.drug, ar) : nameOf(line.drugId) });
    } catch (e) { toast.show(errText(e, t), "error"); return false; }
    return true;
  };
  const validDraft = !!draft && draft.lotNumber.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(draft.expiryDate) && draft.quantity > 0 && (!draft.cold || draft.temperatureC != null);
  const addEntry = () => { if (!draft || !validDraft) return; const { cold: _c, name: _n, ...e } = draft; setEntries((x) => [...x, e]); setDraft(null); };
  const post = async () => {
    if (!po.data || !entries.length) return; setBusy(true);
    try {
      await api.post("pharmacy", "/inventory/receipts", { branchId: po.data.branchId, supplierId: po.data.supplierId, purchaseOrderId: po.data.id, invoiceNo: invoice || undefined, idempotencyKey: `kw-${po.data.id}-${uid()}`, lines: entries.map(({ lineId: _l, ...e }) => ({ ...e, expiryDate: e.expiryDate })) });
      haptic.success(); toast.show(t("pharmacy.receiving.posted")); setEntries([]); await qc.invalidateQueries({ queryKey: ["pharmacy"] }); router.back();
    } catch (e) { toast.show(errText(e, t), "error"); } finally { setBusy(false); }
  };
  void boot;
  return (
    <Screen refresh={refresh} testID="receive-po" footer={entries.length ? <Button title={t("pharmacy.receiving.post", { count: entries.length })} icon="check" onPress={() => void post()} loading={busy} testID="post-receipt" /> : undefined}>
      <Stack.Screen options={{ title: po.data?.poNumber ?? t("pharmacy.tile.receiving") }} />
      <QueryView q={po}>
        {(p) => {
          const pr = poProgress(p, scanned);
          return (
            <View style={{ gap: 12 }}>
              <Card style={{ gap: 8 }}><Row style={{ justifyContent: "space-between" }}><T variant="h2">{p.poNumber}</T><Badge tone="ocean" label={p.status} /></Row><Progress value={pr.pct} tone={pr.pct >= 100 ? "success" : "ink"} /><T variant="caption" muted>{pr.done}/{pr.ordered} · {pr.pct}%</T></Card>
              <ScanField onCode={onScan} placeholder={t("pharmacy.receiving.scanPlaceholder")} hint={t("pharmacy.receiving.scanHint")} testID="receive-scan" />
              <SectionTitle title={t("pharmacy.receiving.lines")} />
              {p.lines.map((l) => {
                const got = l.qtyReceived + (scanned[l.id] ?? 0);
                return (
                  <Card key={l.id} testID={`po-line-${l.id}`} style={{ gap: 6, padding: 12 }}>
                    <Row style={{ justifyContent: "space-between" }}><T weight="semibold" style={{ flex: 1 }}>{nameOf(l.drugId)}</T>{coldOf(l.drugId) ? <Badge tone="ocean" label={t("pharmacy.coldChain")} /> : null}</Row>
                    <Progress value={l.qtyOrdered ? (got / l.qtyOrdered) * 100 : 0} tone={got >= l.qtyOrdered ? "success" : "ink"} height={6} />
                    <T variant="caption" muted>{got}/{l.qtyOrdered} · {t("pharmacy.receiving.unitCost")} {l.unitCost}</T>
                  </Card>
                );
              })}
              {entries.length ? <><SectionTitle title={t("pharmacy.receiving.toPost")} />{entries.map((e, i) => <Card key={i} style={{ padding: 12 }}><KV k={`${nameOf(e.drugId)}`} v={`${e.lotNumber} · ${e.expiryDate} · ×${e.quantity}`} /></Card>)}<Field label={t("pharmacy.receiving.invoiceNo")} value={invoice} onChangeText={setInvoice} /></> : null}
            </View>
          );
        }}
      </QueryView>
      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.name ?? ""} footer={<Button title={t("pharmacy.receiving.add")} disabled={!validDraft} onPress={addEntry} testID="receive-add" />}>
        {draft ? (
          <>
            <Field label={t("pharmacy.lot")} value={draft.lotNumber} onChangeText={(v) => setDraft({ ...draft, lotNumber: v })} autoCapitalize="characters" testID="receive-lot" />
            <Field label={t("pharmacy.expiryDate")} value={draft.expiryDate} onChangeText={(v) => setDraft({ ...draft, expiryDate: v })} placeholder="YYYY-MM-DD" testID="receive-expiry" />
            <Field label={t("pharmacy.qty")} value={String(draft.quantity)} keyboardType="number-pad" onChangeText={(v) => setDraft({ ...draft, quantity: Math.max(0, parseInt(v || "0", 10) || 0) })} testID="receive-qty" />
            <Field label={t("pharmacy.receiving.unitCost")} value={draft.unitCost} keyboardType="decimal-pad" onChangeText={(v) => setDraft({ ...draft, unitCost: v })} />
            {draft.cold ? <><Banner tone="ink" body={t("pharmacy.receiving.coldHint")} /><Field label={t("pharmacy.receiving.temp")} value={draft.temperatureC == null ? "" : String(draft.temperatureC)} keyboardType="decimal-pad" onChangeText={(v) => setDraft({ ...draft, temperatureC: v === "" ? undefined : Number(v) })} testID="receive-temp" /></> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
