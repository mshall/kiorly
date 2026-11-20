const loc = (lang: string) => (lang.startsWith("ar") ? "ar-EG" : "en-GB");
const TZ = "Africa/Cairo";

export const formatMoney = (egp: number, lang: string) =>
  new Intl.NumberFormat(loc(lang), { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(egp);
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
