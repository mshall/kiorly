/** Pharmacy and Lab staff-app cards for the Kiorex commission rate and settlement statement (COM-2 / COM-3): read-only types and pure helpers. Figures are minor units (piasters). No React, no I/O. */
export type RateSpec = { feeType: "PERCENT" | "FLAT"; percentBps: number | null; flatMinor: number | null; minMinor: number | null; maxMinor: number | null; mode: string | null };
export interface RateEffective { state: "SET" | "NOT_SET"; source: "OVERRIDE" | "DEFAULT" | null; version: number | null; reason: string | null; spec: RateSpec | null }
export interface PartnerRateView {
  known: boolean; state: "SET" | "NOT_SET"; effective: RateEffective;
  disclosure?: { rateDisclosure: { en: string; ar: string }; termsSummary: { en: string; ar: string } } | null;
  counsel?: { status: "NOT_REVIEWED" | "APPROVED_WITH_CONDITIONS" | "APPROVED" | "REJECTED" } | null;
}
export type Recon = "MATCHED" | "UNMATCHED" | "DISPUTED";
export type TenderKind = { accruedMinor: number; nettedMinor: number; openMinor: number; charges: number };
/** The mobile statement route answers 200 with this when Kiorex is not connected for the organisation (a normal state, not a server error). */
export interface PartnerStatementNotConnected { connected: false; code: "STATEMENT_NOT_CONNECTED"; period: string | null }
export interface PartnerStatement {
  connected?: true;
  /** LG-COM-20: the cash-type commission split into plain cash and cash transfer, as Kiorex finance sees it (absent on an older API). */
  cashBreakdown?: { cash: TenderKind; cashTransfer: TenderKind & { byDetail: Record<string, number>; unspecifiedDetail: number } } | null;
  unknownTender?: { charges: number; commissionMinor: number } | null;
  currency: string; period: { from: string; to: string; key: string };
  onlineCollectionsMinor: number; cashVisitCommissionAccruedMinor: number; cashVisitCommissionNettedMinor: number; cashVisitCommissionOpenMinor: number;
  deductions: { commissionMinor: number; feesMinor: number | null; refundsMinor: number | null; chargebacksMinor: number | null };
  netPayableMinor: number; paidByBankTransferMinor: number;
  payouts: { payoutRef: string; paidAt: string | null; cashMinor: number; commissionDeductedMinor: number; bankReference: string | null; reconciliation: Recon }[];
  reconciliation: Recon | "NO_PAYOUT";
}

export const currentPeriod = (now = new Date()) => now.toISOString().slice(0, 7);
/** `YYYY-MM` moved by whole months (UTC); never past the current month. */
export function shiftPeriod(period: string, by: number, now = new Date()): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1)); const k = d.toISOString().slice(0, 7);
  return k > currentPeriod(now) ? currentPeriod(now) : k;
}
/** One disclosure text in the app language, falling back to the other language when only that one is set (exactly as the web workspace does). Never invents text. */
export function pickWording(x: { en: string; ar: string }, lang: string): { text: string; lang: "en" | "ar" } | null {
  const pref = lang.startsWith("ar") ? "ar" : "en"; const other = pref === "ar" ? "en" : "ar";
  if (x[pref]?.trim()) return { text: x[pref], lang: pref };
  if (x[other]?.trim()) return { text: x[other], lang: other };
  return null;
}
export const reconTone = (s: string): "success" | "warning" | "muted" => (s === "MATCHED" ? "success" : s === "DISPUTED" ? "warning" : "muted");

export const isNotConnected = (x: PartnerStatement | PartnerStatementNotConnected | undefined): x is PartnerStatementNotConnected => !!x && (x as PartnerStatementNotConnected).connected === false;
