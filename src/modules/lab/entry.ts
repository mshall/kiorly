/** Lab result entry on the phone (technologist bench work): pure types and rules. The server owns every rule (reference ranges, critical limits, delta check, dual control, QC cover); nothing is computed or decided here. */
import { ApiError } from "@/api/errors";

export interface EntryAnalyte { id: string; code: string; nameEn: string; nameAr?: string | null; unit?: string | null; valueType: "NUMERIC" | "CHOICE" | "SEMI_QUANT" | "TEXT" | string; allowedValues?: string[]; calculated?: boolean }
export interface EntryResult { id: string; analyteId: string; status: string; flag: string; valueNumeric: number | null; valueText: string | null; secondEntryBy: string | null; deltaCheckFailed?: boolean; autoVerified?: boolean; source: string }
export interface EntryItem { id: string; status: string; test: { code: string; nameEn: string; section: string }; analytes: EntryAnalyte[]; results: EntryResult[] }
export interface EntrySpecimen { id: string; accessionNumber: string; specimenType: string; status: string; order?: { id: string; orderNumber?: string; priority?: string; patient?: { fullName?: string; sex?: string } }; items?: EntryItem[] }
export interface Instrument { id: string; name: string; kind: "ANALYZER" | "MANUAL_BENCH" | string; active: boolean }

/** Entry is offered by permission only (the Lab bootstrap returns the role's permissions); the server still decides. */
export const mayEnter = (can: (p: string) => boolean) => can("results.enter");
export const mayConfirm = (can: (p: string) => boolean) => can("results.second_entry");
export const mayOpenEntry = (can: (p: string) => boolean) => mayEnter(can) || mayConfirm(can);

/** Eastern Arabic and Persian digits and the Arabic decimal separator to a plain number string; anything else is left alone so the server's own check refuses it. */
export function normalizeNumber(raw: string): string {
  return raw.trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".");
}
/** Numeric value from the keyboard, or null when it is not a finite number (the Save button stays disabled). */
export function parseNumber(raw: string): number | null {
  const s = normalizeNumber(raw);
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
/** Body of `POST /results` for one analyte, or null when the input is not enterable yet. */
export function entryBody(a: EntryAnalyte, raw: string, ctx: { orderItemId: string; instrumentId: string }): { orderItemId: string; analyteId: string; instrumentId: string; value?: number; valueText?: string } | null {
  if (!ctx.instrumentId) return null;
  const base = { orderItemId: ctx.orderItemId, analyteId: a.id, instrumentId: ctx.instrumentId };
  if (a.valueType === "NUMERIC") { const v = parseNumber(raw); return v == null ? null : { ...base, value: v }; }
  const text = raw.trim();
  if (!text) return null;
  if ((a.valueType === "CHOICE" || a.valueType === "SEMI_QUANT") && !(a.allowedValues ?? []).includes(text)) return null;
  return { ...base, valueText: text };
}
/** Body of `POST /results/:id/second-entry` (a different person re-keys the value blind). */
export function secondBody(a: EntryAnalyte, raw: string): { value?: number; valueText?: string } | null {
  if (a.valueType === "NUMERIC") { const v = parseNumber(raw); return v == null ? null : { value: v }; }
  return raw.trim() ? { valueText: raw.trim() } : null;
}
export const currentResult = (item: EntryItem, analyteId: string): EntryResult | undefined => item.results.find((r) => r.analyteId === analyteId);
/** A manual first entry still waits for a second person. */
export const needsSecondEntry = (r: EntryResult | undefined) => !!r && r.source === "MANUAL" && r.status === "ENTERED" && !r.secondEntryBy;
export const isCritical = (flag: string | undefined) => !!flag && /CRIT/i.test(flag);
/** Calculated analytes are filled by the server; the phone never offers a field for them. */
export const enterable = (a: EntryAnalyte) => !a.calculated;
/** The one bench instrument to preselect: the only active one, else the only active manual bench; otherwise the person chooses (the server has no default). */
export function defaultInstrument(list: Instrument[] | undefined): string | null {
  const active = (list ?? []).filter((i) => i.active);
  if (active.length === 1) return active[0]!.id;
  const bench = active.filter((i) => i.kind === "MANUAL_BENCH");
  return bench.length === 1 ? bench[0]!.id : null;
}
export const entryDone = (item: EntryItem) => item.analytes.filter(enterable).every((a) => !!currentResult(item, a.id));
export const specimenProgress = (s: EntrySpecimen) => {
  const items = s.items ?? []; const total = items.reduce((n, i) => n + i.analytes.filter(enterable).length, 0);
  const done = items.reduce((n, i) => n + i.analytes.filter(enterable).filter((a) => !!currentResult(i, a.id)).length, 0);
  return { total, done };
};

/** i18n key for a failed entry or confirmation (codes are the Lab API's; unknown ones fall back to the generic message). */
export function entryErrorKey(e: unknown): string {
  if (!(e instanceof ApiError)) return "lab.err.generic";
  if (e.isNetwork) return "lab.err.network";
  const code = e.code;
  const map: Record<string, string> = {
    RESULT_EXISTS: "lab.entry.err.exists", VALUE_NOT_ALLOWED: "lab.entry.err.notAllowed", VALUE_REQUIRED: "lab.entry.err.required", VALUE_INVALID: "lab.entry.err.invalid",
    NO_SPECIMEN: "lab.entry.err.processFirst", SPECIMEN_NOT_PROCESSABLE: "lab.entry.err.processFirst", INSTRUMENT_NOT_FOUND: "lab.entry.err.instrument",
    DUAL_ENTRY_MISMATCH: "lab.entry.err.mismatch", DUAL_CONTROL_SAME_USER: "lab.entry.err.sameUser", ALREADY_CONFIRMED: "lab.entry.err.alreadyConfirmed", RESULT_NOT_ENTERED: "lab.entry.err.alreadyConfirmed",
    ANALYTE_NOT_IN_TEST: "lab.entry.err.generic", ORDER_ITEM_NOT_FOUND: "lab.entry.err.generic",
  };
  if (map[code]) return map[code]!;
  if (e.status === 403) return e.code === "MFA_REQUIRED" ? "states.mfaBody" : "common.notAllowed";
  if (e.status === 401) return "lab.entry.err.session";
  if (e.status >= 500) return "lab.entry.err.server";
  return "lab.err.generic";
}
