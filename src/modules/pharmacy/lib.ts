import type { Bootstrap } from "@/api/types";
import { ApiError } from "@/api/errors";
import { formatMoney } from "@/lib/format";

/** Pure helpers for the Pharmacy module (unit-tested in src/__tests__/pharmacy-lib.test.ts). */
export interface Lot { id: string; lotNumber: string; expiryDate: string; status?: string; qtyOnHand: number; qtyReserved?: number; expired?: boolean; daysToExpiry?: number; scannedLotMatch?: boolean }
export interface ExpiryItem { lotId: string; daysToExpiry: number; qtyOnHand: number }

export const hasScreen = (b: Bootstrap | undefined, key: string, screen: string) => !!b?.modules.find((m) => m.key === key)?.screens.includes(screen);

/** Money strings come from the API ("42.50"); formatted as EGP with piasters (a pharmacy price or a till variance of 0.50 must not round to a whole pound). */
export const money = (v: string | number | null | undefined, lang: string) => (v == null || v === "" ? "-" : formatMoney(Number(v), lang, 2));

/** First-expiring-first-out order (expired lots first, they must be quarantined). */
export const fefo = <T extends { expiryDate: string }>(lots: T[]) => [...lots].sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));

export type ExpiryBucket = "expired" | "d30" | "d60" | "d90" | "later";
export const bucketOf = (days: number): ExpiryBucket => (days < 0 ? "expired" : days <= 30 ? "d30" : days <= 60 ? "d60" : days <= 90 ? "d90" : "later");
export function bucketExpiry(items: ExpiryItem[]): Record<ExpiryBucket, { lots: number; units: number }> {
  const out = { expired: { lots: 0, units: 0 }, d30: { lots: 0, units: 0 }, d60: { lots: 0, units: 0 }, d90: { lots: 0, units: 0 }, later: { lots: 0, units: 0 } };
  for (const i of items) { const b = out[bucketOf(i.daysToExpiry)]; b.lots++; b.units += i.qtyOnHand; }
  return out;
}
export const expiryTone = (days: number): "danger" | "warning" | "ocean" | "success" => (days < 0 ? "danger" : days <= 30 ? "warning" : days <= 90 ? "ocean" : "success");

/** Parses a GS1 element string, either human form "(01)0123...(17)261231(10)LOT" or raw FNC1-less "01...17...10...". Falls back to the plain code. */
export function parseGs1(raw: string): { gtin?: string; expiry?: string; lot?: string; plain: string } {
  const s = raw.trim();
  const out: { gtin?: string; expiry?: string; lot?: string; plain: string } = { plain: s };
  const human = [...s.matchAll(/\((\d{2})\)([^(]+)/g)];
  const take = (ai: string, v: string) => {
    if (ai === "01") out.gtin = v.slice(0, 14);
    else if (ai === "17") { const m = /^(\d{2})(\d{2})(\d{2})$/.exec(v.slice(0, 6)); if (m) out.expiry = `20${m[1]}-${m[2]}-${m[3] === "00" ? "28" : m[3]}`; }
    else if (ai === "10") out.lot = v;
  };
  if (human.length) { for (const m of human) take(m[1], m[2]); return out; }
  const m = /^01(\d{14})(?:17(\d{6}))?(?:10(.+))?$/.exec(s);
  if (m) { take("01", m[1]); if (m[2]) take("17", m[2]); if (m[3]) take("10", m[3]); }
  return out;
}

export interface PoLine { id: string; drugId: string; qtyOrdered: number; qtyReceived: number; unitCost?: string }
export interface Po { id: string; poNumber: string; status: string; lines: PoLine[]; supplierId?: string; branchId?: string; supplier?: { name?: string } | null }
export const matchPoLine = (po: Pick<Po, "lines">, drugId: string | undefined) => (drugId ? po.lines.find((l) => l.drugId === drugId) ?? null : null);
export const lineRemaining = (l: PoLine, scanned = 0) => Math.max(0, l.qtyOrdered - l.qtyReceived - scanned);
export function poProgress(po: Pick<Po, "lines">, scanned: Record<string, number> = {}) {
  const ordered = po.lines.reduce((n, l) => n + l.qtyOrdered, 0);
  const done = po.lines.reduce((n, l) => n + Math.min(l.qtyOrdered, l.qtyReceived + (scanned[l.id] ?? 0)), 0);
  return { ordered, done, pct: ordered ? Math.round((done / ordered) * 100) : 0 };
}
export const isOpenPo = (s: string) => s === "SENT" || s === "PARTIALLY_RECEIVED" || s === "DRAFT";

export interface SafetyCheck { id: string; kind: string; outcome: "PASS" | "WARN" | "BLOCK" | "OVERRIDDEN_BY_PHARMACIST"; detail?: string; overridable?: boolean }
export function summarizeChecks(checks: SafetyCheck[]) {
  const block = checks.filter((c) => c.outcome === "BLOCK");
  const warn = checks.filter((c) => c.outcome === "WARN");
  return {
    block: block.length, warn: warn.length, pass: checks.filter((c) => c.outcome === "PASS").length, overridden: checks.filter((c) => c.outcome === "OVERRIDDEN_BY_PHARMACIST").length,
    /** Checks that must be overridden (or the draft cancelled) before sign-off. */
    open: [...block, ...warn], locked: block.filter((c) => c.overridable === false),
    // A WARN the server marks non-overridable (e.g. "prescriber has no Kiorly-verified badge") is informational: the API signs off with it, and nobody can clear it,
    // so it must not gate sign-off (it used to leave the pharmacist stuck on every Rx from an unverified prescriber).
    canSignOff: block.length === 0 && warn.every((c) => c.overridable === false),
  };
}
export const canOverride = (c: SafetyCheck, allowed: boolean) => allowed && c.overridable !== false && (c.outcome === "WARN" || c.outcome === "BLOCK");
export const validReason = (r: string) => r.trim().length >= 5;

/**
 * What the Rx detail screen offers for a prescription status and role. The queue holds RECEIVED / VALIDATING prescriptions; validating moves one to
 * VALIDATED (it then leaves the queue but must still be dispensable from this screen, or the flow dead-ends). Validate / reject need `rx.validate`;
 * the dispensing sign-off needs the licensed-signer screen (`rx.override`). Roles without either (cashier, assistant) get a read-only screen.
 */
export function rxActions(status: string | undefined, role: { canValidate: boolean; canSign: boolean }) {
  const needsValidation = status === "RECEIVED" || status === "VALIDATING";
  const dispensable = status === "VALIDATED" || status === "PARTIALLY_DISPENSED";
  const validate = needsValidation && role.canValidate;
  const dispense = (needsValidation && role.canValidate && role.canSign) || (dispensable && role.canSign);
  return { validate, reject: validate, dispense, footer: validate || dispense, needsValidation };
}

export interface CountLine { id?: string; lotId: string; qtyExpected: number; qtyCounted: number | null }
export const setCounted = <T extends CountLine>(lines: T[], lotId: string, delta: number, abs = false): T[] =>
  lines.map((l) => (l.lotId === lotId ? { ...l, qtyCounted: Math.max(0, abs ? delta : (l.qtyCounted ?? 0) + delta) } : l));
export const variance = (l: CountLine) => (l.qtyCounted == null ? 0 : l.qtyCounted - l.qtyExpected);
export function countStats(lines: CountLine[]) {
  const counted = lines.filter((l) => l.qtyCounted != null);
  const off = counted.filter((l) => variance(l) !== 0);
  return { total: lines.length, counted: counted.length, variances: off.length, netUnits: counted.reduce((n, l) => n + variance(l), 0), pct: lines.length ? Math.round((counted.length / lines.length) * 100) : 0 };
}

/** Minutes until SLA (negative = overdue). */
export const slaMinutes = (due: string | null | undefined, now = Date.now()) => (due ? Math.round((+new Date(due) - now) / 60000) : null);
export const slaLabel = (m: number | null) => (m == null ? "" : m < 0 ? `-${Math.abs(m)}m` : m >= 120 ? `${Math.floor(m / 60)}h` : `${m}m`);
export const slaTone = (m: number | null): "danger" | "warning" | "success" | "muted" => (m == null ? "muted" : m < 0 ? "danger" : m < 15 ? "warning" : "success");

/** 403 with a role/permission cause vs. the plan entitlement. */
export const isRoleDenied = (e: unknown) => e instanceof ApiError && e.status === 403 && !e.isFeatureDisabled;
export const errText = (e: unknown, t: (k: string) => string) => {
  if (isRoleDenied(e)) return t("common.notAllowed");
  if (e instanceof ApiError && e.isNetwork) return t("pharmacy.offlineOnly");
  if (e instanceof ApiError && e.code === "WITNESS_MUST_DIFFER") return t("pharmacy.controlled.mustDiffer");
  return (e as Error)?.message || t("common.failed");
};
export const drugName = (d: { brandName?: string; brandNameAr?: string | null; name?: string } | null | undefined, ar: boolean) => (ar ? d?.brandNameAr || d?.brandName : d?.brandName) ?? d?.name ?? "";

export const countDrugsKey = (id: string) => `kw-ph-count-${id}`;
