const loc = (lang: string) => (lang.startsWith("ar") ? "ar-EG-u-nu-latn" : "en-GB");
const TZ = "Africa/Cairo";

/** `digits` = 0 for dashboards; pass 2 where piasters matter (unit prices, cash counts, variances). */
export const formatMoney = (egp: number, lang: string, digits = 0) =>
  new Intl.NumberFormat(loc(lang), { style: "currency", currency: "EGP", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(egp);
export const formatTime = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(loc(lang), { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
export const formatDay = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(loc(lang), { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
export const formatDayLong = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(loc(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
export const formatNumber = (n: number, lang: string, digits = 1) =>
  new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits }).format(n);

/** Calendar-day key in Africa/Cairo, used to group slots. */
export const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

export const pick = (o: object, base: string, lang: string): string => {
  const rec = o as Record<string, unknown>;
  const ar = rec[`${base}Ar`] as string | null | undefined;
  const en = rec[`${base}En`] as string | null | undefined;
  return (lang.startsWith("ar") ? ar ?? en : en ?? ar) ?? "";
};

export const formatCountdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// ---- digits and durations -------------------------------------------------------------------------------------------------------------------------
// Convention (founder, 28 Nov 2026): Western digits 0-9 in Arabic and English alike. Identifiers (order/accession/lot numbers, MRN, barcodes) stay Latin too.
/** Kept for call sites: digits are Western in every language now, so this returns the text unchanged. */
export const localizeDigits = (value: string | number, _lang: string): string => String(value);
/** A whole number / count in the active language's digits (no grouping change for small counts; uses Intl grouping for large ones). */
export const formatInt = (n: number, lang: string) => new Intl.NumberFormat(loc(lang), { maximumFractionDigits: 0 }).format(n);

const UNITS = { en: { d: "d", h: "h", m: "m", over: "+" }, ar: { d: "ي", h: "س", m: "د", over: "+" } } as const;
/** Longest duration we print exactly; beyond this a stale timestamp or bad clock would show absurd values, so we cap it. */
export const MAX_DURATION_DAYS = 999;

/**
 * Compact duration for countdowns / SLAs: "45m", "2h 5m", "3d 4h", and just days from 30 days up ("364d"), capped at "999d+".
 * Negative input is "overdue" and gets a leading "-". Digits and unit letters follow the language (Arabic: ٢س ٥د).
 */
export function formatDuration(totalMinutes: number | null | undefined, lang: string): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes)) return "";
  const u = lang.startsWith("ar") ? UNITS.ar : UNITS.en;
  const neg = totalMinutes < 0; const abs = Math.round(Math.abs(totalMinutes));
  const days = Math.floor(abs / 1440); const hours = Math.floor((abs % 1440) / 60); const mins = abs % 60;
  let body: string;
  if (days > MAX_DURATION_DAYS) body = `${MAX_DURATION_DAYS}${u.d}${u.over}`;
  else if (days >= 30) body = `${days}${u.d}`;
  else if (days >= 1) body = hours ? `${days}${u.d} ${hours}${u.h}` : `${days}${u.d}`;
  else if (hours >= 1) body = mins ? `${hours}${u.h} ${mins}${u.m}` : `${hours}${u.h}`;
  else body = `${mins}${u.m}`;
  return localizeDigits(`${neg ? "-" : ""}${body}`, lang);
}
