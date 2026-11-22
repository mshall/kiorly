import type { TFunction } from "i18next";

/** "PARTIALLY_DISPENSED" -> "Partially dispensed": last-resort label for an enum value we have no translation for. */
export const humanizeEnum = (raw: string): string => {
  const s = raw.replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
};

/**
 * Display label for a raw API enum (status, priority, ...). Looks up, in order: `<scope>.status.<VALUE>` (module-specific wording),
 * `api.status.<VALUE>` (generic), then a humanised version of the value. Never returns the raw SHOUTY enum and never throws.
 * `kind` is "status" (default) or "priority".
 */
export function statusLabel(t: TFunction | ((k: string, o?: Record<string, unknown>) => string), raw: string | null | undefined, opts: { scope?: string; kind?: "status" | "priority" } = {}): string {
  if (!raw) return "";
  const kind = opts.kind ?? "status";
  const tt = t as (k: string, o?: Record<string, unknown>) => string;
  const keys = [...(opts.scope ? [`${opts.scope}.${kind}.${raw}`] : []), `api.${kind}.${raw}`];
  for (const k of keys) {
    const v = tt(k, { defaultValue: "\u0000" });
    if (v && v !== "\u0000" && v !== k) return v;
  }
  return humanizeEnum(raw);
}
