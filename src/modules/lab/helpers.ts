import { ApiError } from "@/api/errors";

export interface NextAction { action: string; to: string; requiresScan: boolean; allowed: boolean }
export interface ScanResult {
  type: "SPECIMEN" | "ORDER";
  matchedBy?: string;
  specimen?: { id: string; accessionNumber: string; barcode: string; specimenType: string; container: string; status: string; collectedAt: string | null };
  order?: { id: string; orderNumber: string; priority: string; status: string; patient?: { fullName?: string; sex?: string } };
  specimens?: { id: string; accessionNumber: string; status: string }[];
  tests?: string[];
  custody?: CustodyEvent[];
  nextActions?: NextAction[];
}
export interface CustodyEvent { id: string; type: string; actorId?: string; location?: string | null; temperatureC?: number | null; note?: string | null; occurredAt: string }

/** Endpoint for a specimen next action (see kiorly-lab Docs/MOBILE.md). Only actions the API marks `allowed` are offered. */
export const ACTION_ENDPOINT: Record<string, string> = { collect: "collect", transport: "transport", receive: "receive", process: "process", reject: "reject" };
export const usableActions = (a: NextAction[] | undefined) => (a ?? []).filter((x) => x.allowed && ACTION_ENDPOINT[x.action]);
/** OFFLINE: only collect is queueable (idempotent append-only custody event). */
export const isQueueable = (action: string) => action === "collect";

export type TatStatus = "OK" | "AT_RISK" | "BREACHED" | "DONE_ON_TIME" | "DONE_LATE" | "NO_TARGET" | string;
export const tatTone = (s: TatStatus): "success" | "warning" | "danger" | "muted" | "ocean" =>
  s === "BREACHED" || s === "DONE_LATE" ? "danger" : s === "AT_RISK" ? "warning" : s === "OK" || s === "DONE_ON_TIME" ? "success" : "muted";

/** Minutes until due (negative = overdue). */
export const minutesLeft = (dueAt: string | null | undefined, now = Date.now()) => (dueAt ? Math.round((new Date(dueAt).getTime() - now) / 60000) : null);
export const countdownLabel = (m: number | null) => (m == null ? "" : `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 60) ? `${Math.floor(Math.abs(m) / 60)}h ` : ""}${Math.abs(m) % 60}m`);

export const LAB_CRITICAL_KINDS = ["CRITICAL_VALUE", "TAT_BREACH_CRITICAL"] as const;
export const isCriticalKind = (k: string) => (LAB_CRITICAL_KINDS as readonly string[]).includes(k);

export interface Section { section: string; total: number; pending: number; inProgress: number; resulted: number; validated: number; released: number; percentDone: number }
export const sectionPercent = (s: Pick<Section, "total" | "released" | "validated">) => (s.total ? Math.round(((s.released + s.validated) / s.total) * 100) : 0);
export const sectionTone = (p: number) => (p >= 70 ? "success" : p >= 35 ? "ocean" : "warning") as "success" | "ocean" | "warning";

export interface ResultRow { id: string; status: string; valueNumeric: number | null; valueText: string | null; unit: string | null; flag: string; refLow: number | null; refHigh: number | null; deltaPercent: number | null; deltaCheckFailed: boolean; analyte?: { code: string; nameEn: string; unit?: string }; specimen?: { accessionNumber: string }; orderItem?: { order?: { id: string; orderNumber: string; patient?: { fullName?: string } } } }
/** Delta-check rule: a failed delta needs an explicit acknowledgement before tech validation. */
export const needsDeltaAck = (r: Pick<ResultRow, "deltaCheckFailed">) => !!r.deltaCheckFailed;
export const flagTone = (f: string): "success" | "warning" | "danger" | "muted" => (/CRIT/i.test(f) ? "danger" : /HIGH|LOW|ABN/i.test(f) ? "warning" : f === "NORMAL" ? "success" : "muted");
export const rangeText = (r: Pick<ResultRow, "refLow" | "refHigh">) => (r.refLow != null && r.refHigh != null ? `${r.refLow} - ${r.refHigh}` : r.refLow != null ? `>= ${r.refLow}` : r.refHigh != null ? `<= ${r.refHigh}` : "");
export const resultValue = (r: Pick<ResultRow, "valueNumeric" | "valueText" | "unit">) => `${r.valueNumeric ?? r.valueText ?? "-"}${r.unit ? ` ${r.unit}` : ""}`;

/** Friendly error key for lab API failures. */
export function labErrorKey(e: unknown): string {
  if (!(e instanceof ApiError)) return "lab.err.generic";
  if (e.isNetwork) return "lab.err.network";
  if (e.status === 403 && e.code === "FORBIDDEN") return "common.notAllowed";
  const c = e.code + " " + e.message;
  if (/LABEL|BARCODE|MISMATCH/i.test(c)) return "lab.err.labelMismatch";
  if (/DELTA_CHECK/i.test(c)) return "lab.err.delta";
  if (/DUAL_CONTROL/i.test(c)) return "lab.err.dual";
  if (/QC/i.test(c)) return "lab.err.qc";
  return "lab.err.generic";
}
