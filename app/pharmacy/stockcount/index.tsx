import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Chip, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { ListRow, QueryView, Segmented } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { prefs } from "@/lib/storage";
import { usePh } from "@/modules/pharmacy/hooks";
import { countDrugsKey, drugName, errText } from "@/modules/pharmacy/lib";
import { formatDay, formatTime } from "@/lib/format";

interface Count { id: string; type: "CYCLE" | "FULL"; status: string; startedAt: string }

/** Stock count mode: list counts and start a new CYCLE (scan the drugs to count) or FULL count. */
export default function StockCounts() {
  const { t, ar, lang } = usePh();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useRead<Count[]>("pharmacy", "/inventory/counts");
  const refresh = usePullRefresh(q);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"CYCLE" | "FULL">("CYCLE");
  const [drugs, setDrugs] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const add = async (code: string) => {
    try {
      const r = await api.get<{ found: boolean; drug?: { id: string; brandName: string; brandNameAr?: string } }>("pharmacy", `/mobile/pharmacy/barcode/${encodeURIComponent(code)}`);
      if (!r.found || !r.drug) { toast.show(t("pharmacy.barcode.notFound"), "error"); return false; }
      const d = r.drug;
      setDrugs((x) => (x.some((y) => y.id === d.id) ? x : [...x, { id: d.id, name: drugName(d, ar) ?? "" }]));
    } catch (e) { toast.show(errText(e, t), "error"); return false; }
    return true;
  };
  const start = async () => {
    setBusy(true);
    try {
      const c = await api.post<Count>("pharmacy", "/inventory/counts", type === "FULL" ? { type } : { type, drugIds: drugs.map((d) => d.id) });
      await prefs.set(countDrugsKey(c.id), JSON.stringify(drugs.map((d) => d.id)));
      setOpen(false); setDrugs([]); await qc.invalidateQueries({ queryKey: ["pharmacy", "/inventory/counts"] });
      router.push(`/pharmacy/stockcount/${c.id}` as never);
    } catch (e) { toast.show(errText(e, t), "error"); } finally { setBusy(false); }
  };
  const tone = (s: string) => (s === "OPEN" ? "ocean" : s === "PENDING_APPROVAL" ? "warning" : s === "APPROVED" || s === "CLOSED" ? "success" : "muted") as "ocean" | "warning" | "success" | "muted";
  return (
    <Screen refresh={refresh} testID="stockcount" footer={<Button title={t("pharmacy.count.new")} icon="plus" onPress={() => setOpen(true)} testID="count-new" />}>
      <Stack.Screen options={{ title: t("pharmacy.tile.stockcount") }} />
      <QueryView q={q} cached={q.fromCache} isEmpty={(d) => !d.length} empty={{ icon: "box", title: t("pharmacy.count.empty"), hint: t("pharmacy.count.emptyHint") }}>
        {(d) => <View style={{ gap: 10 }}>{d.map((c) => <ListRow key={c.id} testID={`count-${c.id}`} icon="box" title={`${t(`pharmacy.count.type.${c.type}`)} · ${formatDay(c.startedAt, lang)} ${formatTime(c.startedAt, lang)}`} badge={t(`pharmacy.count.status.${c.status}`, { defaultValue: c.status })} badgeTone={tone(c.status)} onPress={() => router.push(`/pharmacy/stockcount/${c.id}` as never)} />)}</View>}
      </QueryView>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t("pharmacy.count.new")} footer={<Button title={t("pharmacy.count.start")} onPress={() => void start()} loading={busy} disabled={type === "CYCLE" && !drugs.length} testID="count-start" />}>
        <Segmented value={type} onChange={setType} options={[{ value: "CYCLE", label: t("pharmacy.count.type.CYCLE") }, { value: "FULL", label: t("pharmacy.count.type.FULL") }]} />
        {type === "CYCLE" ? (
          <>
            <T variant="small" muted>{t("pharmacy.count.cycleHint")}</T>
            <ScanField onCode={add} placeholder={t("pharmacy.barcode.placeholder")} testID="count-drug-scan" />
            <Row gap={6} style={{ flexWrap: "wrap" }}>{drugs.map((d) => <Chip key={d.id} label={d.name} selected onPress={() => setDrugs((x) => x.filter((y) => y.id !== d.id))} />)}</Row>
          </>
        ) : <Badge tone="warning" label={t("pharmacy.count.fullHint")} />}
      </Sheet>
    </Screen>
  );
}
