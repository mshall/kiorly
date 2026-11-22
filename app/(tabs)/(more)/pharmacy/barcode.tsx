import { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Badge, Card, Row, Screen, T } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { FadeIn, KV, SectionTitle, SkeletonList, StatTile, toneColor } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { api } from "@/api/client";
import { usePh } from "@/modules/pharmacy/hooks";
import { DrugBadges } from "@/modules/pharmacy/DrugBadges";
import { drugName, errText, expiryTone, fefo, money, parseGs1, type Lot } from "@/modules/pharmacy/lib";
import { formatDay } from "@/lib/format";
import { useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { statusLabel } from "@/lib/status";
import { localizeDigits } from "@/lib/format";

interface Result { found: boolean; code: string; drug?: { id: string; brandName: string; brandNameAr?: string; strength?: string; dosageForm?: string; rxOnly?: boolean; controlled?: boolean; coldChain?: boolean }; price?: string; requiresPrescription?: boolean; stock?: { onHand: number; available: number; nearestExpiry: string | null }; lots?: Lot[]; scan?: { lotNumber?: string | null; expiryDate?: string | null } }

/** Barcode lookup: price / stock / lots (FEFO). Accepts ?code= (deep link, global search, universal scanner). */
export default function Barcode() {
  const { code: initial } = useLocalSearchParams<{ code?: string }>();
  const { t, ar, lang } = usePh();
  const { colors } = useTheme();
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lookup = useCallback(async (raw: string) => {
    setBusy(true); setErr(null);
    try {
      const g = parseGs1(raw);
      const r = await api.get<Result>("pharmacy", `/mobile/pharmacy/barcode/${encodeURIComponent(g.plain)}`);
      setRes(r); r.found ? haptic.success() : haptic.warn();
    } catch (e) { setErr(errText(e, t)); } finally { setBusy(false); }
    return true;
  }, [t]);
  useEffect(() => { if (initial) void lookup(String(initial)); }, [initial, lookup]);
  const lots = res?.lots ? fefo(res.lots) : [];
  return (
    <Screen testID="barcode">
      <Stack.Screen options={{ title: t("pharmacy.tile.barcode") }} />
      <ScanField onCode={lookup} placeholder={t("pharmacy.barcode.placeholder")} hint={t("pharmacy.barcode.hint")} testID="barcode-input" autoFocus={!initial} />
      {busy ? <SkeletonList rows={3} /> : null}
      {err ? <T color={colors.danger}>{err}</T> : null}
      {!busy && !res && !err ? <EmptyState icon="scan" title={t("pharmacy.barcode.empty")} hint={t("pharmacy.barcode.emptyHint")} /> : null}
      {!busy && res && !res.found ? <EmptyState icon="search" title={t("pharmacy.barcode.notFound")} hint={res.code} /> : null}
      {!busy && res?.found && res.drug ? (
        <FadeIn>
          <View style={{ gap: 12 }} testID="barcode-result">
            <Card style={{ gap: 8 }}>
              <T variant="h2">{drugName(res.drug, ar)}</T>
              <T variant="small" muted>{[res.drug.strength, res.drug.dosageForm].filter(Boolean).join(" · ")}</T>
              <DrugBadges rxOnly={res.requiresPrescription ?? res.drug.rxOnly} controlled={res.drug.controlled} coldChain={res.drug.coldChain} />
              <T variant="display" style={{ fontSize: 30 }} color={colors.ink}>{money(res.price, lang)}</T>
            </Card>
            <Row gap={10}>
              <StatTile label={t("pharmacy.barcode.onHand")} value={res.stock?.onHand ?? 0} icon="box" tone={res.stock?.onHand ? "ink" : "danger"} />
              <StatTile label={t("pharmacy.barcode.available")} value={res.stock?.available ?? 0} icon="check" tone={res.stock?.available ? "success" : "danger"} />
            </Row>
            {res.stock?.nearestExpiry ? <KV k={t("pharmacy.barcode.nearest")} v={formatDay(res.stock.nearestExpiry, lang)} /> : null}
            <SectionTitle title={t("pharmacy.barcode.lots")} />
            {!lots.length ? <T muted>{t("pharmacy.barcode.noLots")}</T> : lots.map((l, i) => {
              const tone = expiryTone(l.daysToExpiry ?? 999);
              return (
                <Card key={l.id} testID={`lot-${l.lotNumber}`} style={{ gap: 6, padding: 12, borderStartWidth: 4, borderStartColor: toneColor(colors, tone) }}>
                  <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{l.lotNumber}</T><Row gap={6}>{i === 0 && !l.expired ? <Badge tone="ink" label={t("pharmacy.barcode.fefo")} /> : null}{l.scannedLotMatch ? <Badge tone="success" label={t("pharmacy.barcode.scannedLot")} icon="check" /> : null}<Badge tone={tone} label={l.expired ? t("pharmacy.expired") : `${l.daysToExpiry}d`} /></Row></Row>
                  <T variant="small" muted>{formatDay(l.expiryDate, lang)} · {statusLabel(t, l.status, { scope: "pharmacy.lot" })} · {t("pharmacy.qty")} {localizeDigits(l.qtyOnHand, lang)}{l.qtyReserved ? ` (${t("pharmacy.reserved")} ${localizeDigits(l.qtyReserved, lang)})` : ""}</T>
                </Card>
              );
            })}
          </View>
        </FadeIn>
      ) : null}
    </Screen>
  );
}
