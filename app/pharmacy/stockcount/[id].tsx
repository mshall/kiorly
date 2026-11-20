import { useEffect, useMemo, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Row, Screen, T, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { Progress, QueryView, SectionTitle, StatTile } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { mutate } from "@/offline/mutate";
import { prefs } from "@/lib/storage";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { usePh } from "@/modules/pharmacy/hooks";
import { countDrugsKey, countStats, drugName, errText, hasScreen, setCounted, variance, type CountLine } from "@/modules/pharmacy/lib";

interface Count { id: string; type: string; status: string; lines: (CountLine & { id: string })[] }
interface LotInfo { id: string; lotNumber: string; expiryDate: string; drug?: { brandName: string; brandNameAr?: string } }

export default function StockCount() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, ar, boot, owner } = usePh();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useRead<Count>("pharmacy", `/inventory/counts/${id}`);
  const refresh = usePullRefresh(q);
  const [lines, setLines] = useState<(CountLine & { id: string })[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [drugIds, setDrugIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setLines(q.data.lines); }, [q.data]);
  useEffect(() => { void prefs.get(countDrugsKey(String(id))).then((v) => { if (v) setDrugIds(JSON.parse(v)); }); }, [id]);
  const lotQs = useQueries({ queries: (drugIds.length ? drugIds : ["*"]).map((d) => ({ queryKey: ["pharmacy", "lots", d], queryFn: async () => (await api.get<{ items: LotInfo[] }>("pharmacy", "/inventory/lots", { query: d === "*" ? { pageSize: 200 } : { drugId: d, pageSize: 200 } })).items, staleTime: 120_000 })) });
  const lotMap = useMemo(() => { const m = new Map<string, LotInfo>(); lotQs.forEach((r) => r.data?.forEach((l) => m.set(l.id, l))); return m; }, [lotQs]);
  const editable = q.data?.status === "OPEN";
  const canApprove = hasScreen(boot, "pharmacy.stockcount", "count.approve") || boot?.user.role === "OWNER" || boot?.user.role === "BRANCH_MANAGER";
  const st = countStats(lines);

  const bump = (lotId: string, delta: number) => { haptic.tap(); setLines((l) => setCounted(l, lotId, delta)); setDirty((d) => new Set(d).add(lotId)); };
  const onScan = async (code: string) => {
    try {
      const r = await api.get<{ found: boolean; lots?: { id: string; scannedLotMatch?: boolean | null }[] }>("pharmacy", `/mobile/pharmacy/barcode/${encodeURIComponent(code)}`);
      const ids = new Set(lines.map((l) => l.lotId));
      const cand = (r.lots ?? []).filter((x) => ids.has(x.id));
      const hit = cand.find((x) => x.scannedLotMatch) ?? (cand.length === 1 ? cand[0] : cand[0]);
      if (!r.found || !hit) { toast.show(t("pharmacy.count.notInCount"), "error"); return false; }
      bump(hit.id, 1);
    } catch (e) { toast.show(errText(e, t), "error"); return false; }
    return true;
  };
  /** OFFLINE: line counts are queueable (PUT, last write wins per lot); submit/approve stay online. */
  const save = async () => {
    const payload = lines.filter((l) => dirty.has(l.lotId) && l.qtyCounted != null).map((l) => ({ lotId: l.lotId, qtyCounted: l.qtyCounted as number }));
    if (!payload.length) return true;
    const r = await mutate("pharmacy", "PUT", `/inventory/counts/${id}/lines`, { lines: payload }, { label: t("pharmacy.count.queueLabel"), owner, queueable: true });
    setDirty(new Set());
    if (r.queued) toast.show(t("common.offlineSaved"), "info");
    return !r.queued;
  };
  const act = async (action: "save" | "submit" | "approve" | "reject") => {
    setBusy(true);
    try {
      const online = await save();
      if (action === "save") { if (online) toast.show(t("common.saved")); }
      else if (!online) toast.show(t("pharmacy.offlineOnly"), "error");
      else { await api.post("pharmacy", `/inventory/counts/${id}/${action}`, {}); toast.show(t(`pharmacy.count.${action}Done`)); haptic.success(); }
      await qc.invalidateQueries({ queryKey: ["pharmacy"] });
    } catch (e) { toast.show(errText(e, t), "error"); } finally { setBusy(false); }
  };
  const status = q.data?.status;
  return (
    <Screen refresh={refresh} testID="count-detail" footer={editable ? <Row gap={8}><Button variant="secondary" title={t("common.save")} onPress={() => void act("save")} loading={busy} style={{ flex: 1 }} testID="count-save" /><Button title={t("pharmacy.count.submit")} onPress={() => void act("submit")} loading={busy} disabled={st.counted === 0} style={{ flex: 1 }} testID="count-submit" /></Row>
      : status === "PENDING_APPROVAL" && canApprove ? <Row gap={8}><Button variant="secondary" title={t("pharmacy.count.reject")} onPress={() => void act("reject")} style={{ flex: 1 }} /><Button title={t("pharmacy.count.approve")} onPress={() => void act("approve")} style={{ flex: 1 }} testID="count-approve" /></Row> : undefined}>
      <Stack.Screen options={{ title: t("pharmacy.count.title") }} />
      <QueryView q={q}>
        {() => (
          <View style={{ gap: 12 }}>
            <Row gap={10}><StatTile label={t("pharmacy.count.counted")} value={`${st.counted}/${st.total}`} icon="check" /><StatTile label={t("pharmacy.count.variances")} value={st.variances} tone={st.variances ? "warning" : "success"} icon="alert" hint={`${t("pharmacy.count.net")} ${st.netUnits > 0 ? "+" : ""}${st.netUnits}`} /></Row>
            <Progress value={st.pct} tone={st.pct === 100 ? "success" : "ink"} />
            {status !== "OPEN" ? <Badge tone="warning" label={t(`pharmacy.count.status.${status}`, { defaultValue: status ?? "" })} /> : <ScanField onCode={onScan} placeholder={t("pharmacy.count.scanPlaceholder")} hint={t("pharmacy.count.scanHint")} testID="count-scan" />}
            <SectionTitle title={t("pharmacy.count.lots")} />
            {lines.map((l) => {
              const lot = lotMap.get(l.lotId); const v = variance(l);
              return (
                <Card key={l.id} testID={`cl-${l.lotId}`} style={{ padding: 12, gap: 8 }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}><T weight="semibold" numberOfLines={1}>{lot?.drug ? drugName(lot.drug, ar) : l.lotId.slice(-6)}</T><T variant="caption" muted>{lot?.lotNumber ?? ""} · {t("pharmacy.count.expected")} {l.qtyExpected}</T></View>
                    {l.qtyCounted != null && v !== 0 ? <Badge tone={v < 0 ? "danger" : "warning"} label={`${v > 0 ? "+" : ""}${v}`} /> : l.qtyCounted != null ? <Icon name="check" size={18} color={colors.success} /> : null}
                  </Row>
                  {editable ? (
                    <Row gap={12} style={{ justifyContent: "center" }}>
                      <Pressable onPress={() => bump(l.lotId, -1)} accessibilityRole="button" accessibilityLabel="-1" testID={`dec-${l.lotId}`} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}><T variant="h2">−</T></Pressable>
                      <T variant="display" style={{ minWidth: 64, textAlign: "center" }} testID={`qty-${l.lotId}`}>{l.qtyCounted ?? "-"}</T>
                      <Pressable onPress={() => bump(l.lotId, 1)} accessibilityRole="button" accessibilityLabel="+1" testID={`inc-${l.lotId}`} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}><T variant="h2" color={colors.onInk}>+</T></Pressable>
                    </Row>
                  ) : <T variant="small">{t("pharmacy.count.counted")}: {l.qtyCounted ?? "-"}</T>}
                </Card>
              );
            })}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
