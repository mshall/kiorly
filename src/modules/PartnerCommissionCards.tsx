import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Banner, Button, Card, Row, T } from "@/components/ui";
import { KV, SectionTitle } from "@/components/kit";
import { ErrorState } from "@/components/states";
import { ApiError } from "@/api/errors";
import { useRead } from "@/hooks/useRead";
import { formatMoney, localizeDigits } from "@/lib/format";
import { currentPeriod, pickWording, reconTone, shiftPeriod, type PartnerRateView, type PartnerStatement, type RateSpec } from "@/modules/partner-commission";
import type { PartnerProduct } from "@/modules/partner-growth";

/**
 * Commission rate and settlement statement cards of the Pharmacy and Lab Growth tab (read only; Kiorex sets both). Shown to the roles the API names in `can.commission`.
 * Every figure and text comes from Kiorex through the product API: nothing is computed, estimated or worded here beyond neutral labels. Cash is never paid out: payouts are bank transfers.
 */
export function PartnerCommissionCards({ product }: { product: PartnerProduct }) {
  const { t, i18n } = useTranslation(); const lang = i18n.language; const ns = `${product}.growth.commission`;
  const [period, setPeriod] = useState(currentPeriod());
  const rate = useRead<PartnerRateView>(product, "/mobile/growth/commission-rate");
  const stmt = useRead<PartnerStatement>(product, "/mobile/growth/commission-statement", { query: { period } });
  const money = (minor: number | null) => (minor === null ? "—" : formatMoney(minor / 100, lang, 2));
  const spec = (s: RateSpec) => {
    const base = s.feeType === "PERCENT" ? t(`${ns}.percentOf`, { pct: localizeDigits(`${Math.round((s.percentBps ?? 0) / 100 * 100) / 100}%`, lang) }) : t(`${ns}.flatPer`, { amount: money(s.flatMinor ?? 0) });
    const bounds = [s.minMinor != null ? `${t(`${ns}.min`)} ${money(s.minMinor)}` : null, s.maxMinor != null ? `${t(`${ns}.max`)} ${money(s.maxMinor)}` : null].filter(Boolean).join(", ");
    return bounds ? `${base} (${bounds})` : base;
  };
  const r = rate.data; const s = stmt.data;
  const blocks = r?.disclosure ? (["rateDisclosure", "termsSummary"] as const).map((k) => { const w = pickWording(r.disclosure![k], lang); return w ? { k, ...w } : null; }).filter((b) => b !== null) : [];
  const notConnected = stmt.error instanceof ApiError && stmt.error.code === "STATEMENT_NOT_CONNECTED";
  const rows: [string, number | null][] = s ? [["cOnline", s.onlineCollectionsMinor], ["cCashAccrued", s.cashVisitCommissionAccruedMinor], ["cCashNetted", s.cashVisitCommissionNettedMinor], ["cCashOpen", s.cashVisitCommissionOpenMinor], ["cDedCommission", s.deductions.commissionMinor], ["cDedFees", s.deductions.feesMinor], ["cDedRefunds", s.deductions.refundsMinor], ["cDedChargebacks", s.deductions.chargebacksMinor], ["cNet", s.netPayableMinor], ["cPaid", s.paidByBankTransferMinor]] : [];

  return (
    <View style={{ gap: 12 }} testID="growth-commission-cards">
      <Card style={{ gap: 8 }} testID="growth-rate-card">
        <SectionTitle title={t(`${ns}.rate.title`)} />
        {rate.isError && !r ? <ErrorState error={rate.error} onRetry={() => void rate.refetch()} /> : null}
        {r ? (
          <>
            <T variant="small" muted>{t(`${ns}.rate.hint`)}</T>
            {r.effective.state === "SET" && r.effective.spec ? (
              <>
                <T weight="semibold" testID="growth-rate-effective">{spec(r.effective.spec)}</T>
                <T variant="caption" muted>{t(`${ns}.rate.source${r.effective.source ?? "DEFAULT"}`)}</T>
              </>
            ) : (
              <View style={{ gap: 4 }} testID="growth-rate-not-set"><Badge tone="warning" label={t(`${ns}.rate.notSet`)} /><T variant="small" muted>{t(`${ns}.rate.notSetHint`)}</T></View>
            )}
            {r.counsel ? <Row gap={6}><T variant="caption" muted>{t(`${ns}.rate.counselLabel`)}</T><Badge tone={r.counsel.status === "APPROVED" ? "success" : "muted"} label={t(`${ns}.rate.counsel.${r.counsel.status}`)} testID="growth-counsel" /></Row> : null}
            {blocks.map((b) => (
              <View key={b!.k} style={{ gap: 2 }} testID={`growth-disclosure-${b!.k}`}>
                <T variant="small" weight="semibold">{t(`${ns}.rate.${b!.k}`)}</T>
                <T variant="small" style={{ writingDirection: b!.lang === "ar" ? "rtl" : "ltr" }}>{b!.text}</T>
              </View>
            ))}
          </>
        ) : null}
      </Card>

      <Card style={{ gap: 8 }} testID="growth-statement-card">
        <SectionTitle title={t(`${ns}.stmt.title`)} />
        <Row gap={8} style={{ justifyContent: "space-between" }}>
          <Button small variant="secondary" title={t(`${ns}.stmt.prev`)} onPress={() => setPeriod(shiftPeriod(period, -1))} testID="growth-stmt-prev" />
          <T weight="semibold" forceLatin testID="growth-stmt-period">{localizeDigits(period, lang)}</T>
          <Button small variant="secondary" title={t(`${ns}.stmt.next`)} onPress={() => setPeriod(shiftPeriod(period, 1))} disabled={period >= currentPeriod()} testID="growth-stmt-next" />
        </Row>
        {stmt.isError && !s ? (notConnected ? <Banner tone="ink" body={t(`${ns}.stmt.notConnected`)} testID="growth-stmt-unavailable" /> : <ErrorState error={stmt.error} onRetry={() => void stmt.refetch()} />) : null}
        {s ? (
          <>
            <T variant="small" muted>{t(`${ns}.stmt.source`)}</T>
            <T variant="small">{t(`${ns}.stmt.bankOnly`)}</T>
            <Row gap={8}><T variant="small" weight="semibold">{t(`${ns}.stmt.reconciliation`)}</T><Badge tone={reconTone(s.reconciliation)} label={t(`${ns}.stmt.recon.${s.reconciliation}`)} testID="growth-stmt-recon" /></Row>
            <View style={{ gap: 2 }} testID="growth-stmt-figures">{rows.map(([k, v]) => <KV key={k} k={t(`${ns}.stmt.${k}`)} v={v === null ? "—" : localizeDigits(money(v), lang)} />)}</View>
            <T variant="small" weight="semibold">{t(`${ns}.stmt.payouts`)}</T>
            {s.payouts.length === 0 ? <T variant="small" muted>{t(`${ns}.stmt.noPayouts`)}</T> : s.payouts.map((p) => (
              <View key={p.payoutRef} style={{ gap: 2 }} testID={`growth-stmt-payout-${p.payoutRef}`}>
                <Row style={{ justifyContent: "space-between" }} gap={8}><T variant="small" weight="medium" forceLatin>{p.payoutRef}</T><Badge tone={reconTone(p.reconciliation)} label={t(`${ns}.stmt.recon.${p.reconciliation}`)} /></Row>
                <T variant="caption" muted>{`${p.paidAt?.slice(0, 10) ?? "—"} · ${money(p.cashMinor)} · ${t(`${ns}.stmt.colDeducted`)} ${money(p.commissionDeductedMinor)}${p.bankReference ? ` · ${p.bankReference}` : ""}`}</T>
              </View>
            ))}
          </>
        ) : null}
      </Card>
    </View>
  );
}
