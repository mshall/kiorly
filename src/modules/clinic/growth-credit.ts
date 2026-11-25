/** GRW-P2-W / GRW-P2-S staff app: types and pure helpers for the Kiorex credit and sponsored promotion cards of the Clinic Growth module. No React, no I/O.
 *  Read endpoints are the Clinic's own `/credits/wallet` and `/promotions` (owner and finance roles only); pause and resume use `/promotions/:id/pause|resume`. */
export type CreditUse = "KIOREX_FEES" | "SUBSCRIPTION" | "USAGE" | "PROMOTIONS" | "MARKETING";
export const CREDIT_USES: CreditUse[] = ["KIOREX_FEES", "SUBSCRIPTION", "USAGE", "PROMOTIONS", "MARKETING"];
export interface CreditWallet {
  balance: string; currency: string;
  upcomingExpiries: { expiresAt: string; amount: string; entryId: string }[];
  spendableByUse?: Partial<Record<CreditUse, string>>;
  total: number;
}
export type PromotionStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ACTIVE" | "PAUSED" | "EXHAUSTED" | "EXPIRED" | "REJECTED" | "ARCHIVED";
export interface PromotionRow {
  id: string; status: PromotionStatus;
  version: { nameAr: string | null; nameEn: string | null; startsAt: string | null; endsAt: string | null; fundingMode?: string };
  budget: { capMinor: number; reservedMinor: number; debitedMinor: number; remainingMinor: number };
}

/** Wallet amounts are decimal strings in the major unit. Anything that is not a finite number reads as 0 (never NaN on screen). */
export const amountOf = (s: string | null | undefined): number => { const n = Number(s); return Number.isFinite(n) ? n : 0; };
export const hasCredit = (w: CreditWallet): boolean => amountOf(w.balance) > 0;
/** The next expiry that is still in the future, soonest first. */
export function nextExpiry(w: CreditWallet, now = new Date()): { expiresAt: string; amount: number } | null {
  const upcoming = w.upcomingExpiries.filter((e) => Date.parse(e.expiresAt) > now.getTime() && amountOf(e.amount) > 0).sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  return upcoming[0] ? { expiresAt: upcoming[0].expiresAt, amount: amountOf(upcoming[0].amount) } : null;
}
export const daysUntil = (iso: string, now = new Date()): number => Math.max(0, Math.ceil((Date.parse(iso) - now.getTime()) / 86_400_000));
/** Uses with money you can actually spend now (a use with 0 is left out). */
export const spendableUses = (w: CreditWallet): { use: CreditUse; amount: number }[] =>
  CREDIT_USES.map((use) => ({ use, amount: amountOf(w.spendableByUse?.[use]) })).filter((x) => x.amount > 0);

export const minorToMajor = (m: number): number => Math.round(m) / 100;
/** Share of the budget already spent or held, 0 to 100, null when there is no cap. */
export const budgetUsedPct = (b: PromotionRow["budget"]): number | null => (b.capMinor > 0 ? Math.min(100, Math.max(0, Math.round(((b.capMinor - b.remainingMinor) / b.capMinor) * 100))) : null);
export const canPause = (s: PromotionStatus): boolean => s === "ACTIVE" || s === "EXHAUSTED";
export const canResume = (s: PromotionStatus): boolean => s === "PAUSED";
/** Rows worth showing first: running, then paused, then the rest; archived last. */
const ORDER: Record<PromotionStatus, number> = { ACTIVE: 0, EXHAUSTED: 1, PAUSED: 2, APPROVED: 3, IN_REVIEW: 4, SUBMITTED: 5, DRAFT: 6, REJECTED: 7, EXPIRED: 8, ARCHIVED: 9 };
export const sortPromotions = (rows: PromotionRow[]): PromotionRow[] => [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
export const promotionTone = (s: PromotionStatus): "success" | "warning" | "muted" | "danger" =>
  s === "ACTIVE" ? "success" : s === "PAUSED" || s === "EXHAUSTED" || s === "IN_REVIEW" || s === "SUBMITTED" ? "warning" : s === "REJECTED" ? "danger" : "muted";
