import { evaluateSafety } from "@kiorly/field-visit";
import type { Bootstrap } from "@/api/types";

// ---- roles ----
const SIGNERS = new Set(["PHYSICIAN", "GROUP_ADMIN", "GROUP_SUPERVISOR"]);
export const canSignClinical = (b: Pick<Bootstrap, "user"> | undefined) => !!b && SIGNERS.has(b.user.role);
export const hasScreen = (b: Bootstrap | undefined, moduleKey: string, screen: string) => !!b?.modules.find((m) => m.key === moduleKey && m.enabled)?.screens.includes(screen);
export const hasModule = (b: Bootstrap | undefined, moduleKey: string) => !!b?.modules.find((m) => m.key === moduleKey && m.enabled);
/** Visits and signing are doctor-only; a nurse-edition user carries role PHYSICIAN + profession NURSE, so the backend module screens are the source of truth. */
export const canStartVisit = (b: Bootstrap | undefined) => hasScreen(b, "clinic.visits", "start");
export const canSign = (b: Bootstrap | undefined) => hasScreen(b, "clinic.prescriptions", "sign");
export const canApproveLab = (b: Bootstrap | undefined) => hasScreen(b, "clinic.labs", "approve");

// ---- names ----
export const nameOf = (o: { name?: string; nameAr?: string | null } | null | undefined, lang: string) => (lang.startsWith("ar") ? o?.nameAr || o?.name : o?.name || o?.nameAr) || "";
export const patientName = (p: { firstNameEn?: string; lastNameEn?: string; firstNameAr?: string; lastNameAr?: string; name?: string; nameAr?: string | null }, lang: string) => {
  if (p.name || p.nameAr) return nameOf(p, lang);
  const en = `${p.firstNameEn ?? ""} ${p.lastNameEn ?? ""}`.trim(); const ar = `${p.firstNameAr ?? ""} ${p.lastNameAr ?? ""}`.trim();
  return (lang.startsWith("ar") ? ar || en : en || ar);
};

// ---- queue ----
export type QueueStage = "WAITING" | "IN_EXAM" | "CALLED" | "DONE" | string | null | undefined;
export type Tone = "ink" | "ocean" | "success" | "warning" | "danger" | "muted";
export interface QueueView { key: "scheduled" | "waiting" | "inExam" | "completed" | "cancelled" | "noShow"; tone: Tone }
/** Appointment status + queue stage -> one display bucket. */
export function queueView(status: string, stage?: QueueStage): QueueView {
  if (status === "CANCELLED") return { key: "cancelled", tone: "muted" };
  if (status === "NO_SHOW") return { key: "noShow", tone: "danger" };
  if (status === "COMPLETED" || stage === "DONE") return { key: "completed", tone: "success" };
  if (stage === "IN_EXAM" || stage === "CALLED" || status === "IN_PROGRESS") return { key: "inExam", tone: "ocean" };
  if (status === "CHECKED_IN" || stage === "WAITING") return { key: "waiting", tone: "warning" };
  return { key: "scheduled", tone: "ink" };
}
export const waitMinutes = (checkedInAt: string | null | undefined, now = Date.now()) => (checkedInAt ? Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 60000)) : null);
export const canCheckIn = (status: string) => ["SCHEDULED", "CONFIRMED", "PENDING"].includes(status);
export const canStartFrom = (status: string, stage?: QueueStage) => queueView(status, stage).key === "waiting" || queueView(status, stage).key === "inExam";

// ---- vitals ----
export interface VitalsDraft { systolic: string; diastolic: string; pulse: string; temperatureC: string; spo2: string; respiratoryRate: string; glucoseMgDl: string; painScore: string }
export const emptyVitals = (): VitalsDraft => ({ systolic: "", diastolic: "", pulse: "", temperatureC: "", spo2: "", respiratoryRate: "", glucoseMgDl: "", painScore: "" });
export const VITAL_RANGES: Record<keyof VitalsDraft, [number, number]> = {
  systolic: [50, 260], diastolic: [30, 160], pulse: [20, 250], temperatureC: [30, 45], spo2: [50, 100], respiratoryRate: [4, 60], glucoseMgDl: [20, 800], painScore: [0, 10],
};
const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
export function validateVitals(d: VitalsDraft): { ok: boolean; errors: Partial<Record<keyof VitalsDraft, "range" | "nan" | "pair">>; body: Record<string, number> } {
  const errors: Partial<Record<keyof VitalsDraft, "range" | "nan" | "pair">> = {}; const body: Record<string, number> = {};
  (Object.keys(VITAL_RANGES) as (keyof VitalsDraft)[]).forEach((k) => {
    const v = num(d[k]); if (v === undefined) return;
    if (!Number.isFinite(v)) { errors[k] = "nan"; return; }
    const [lo, hi] = VITAL_RANGES[k]; if (v < lo || v > hi) { errors[k] = "range"; return; }
    body[k] = v;
  });
  if ((d.systolic.trim() !== "") !== (d.diastolic.trim() !== "")) errors[d.systolic.trim() ? "diastolic" : "systolic"] = "pair";
  else if (body.systolic != null && body.diastolic != null && body.diastolic >= body.systolic) errors.diastolic = "range";
  const any = Object.keys(body).length > 0;
  return { ok: any && Object.keys(errors).length === 0, errors, body };
}
/** Advisory pre-submit hint only; the server applies the CMO-pending thresholds and decides `critical`. */
export function vitalsHints(body: Record<string, number>): string[] {
  const h: string[] = [];
  if (body.spo2 != null && body.spo2 < 92) h.push("spo2");
  if (body.systolic != null && (body.systolic >= 180 || body.systolic < 90)) h.push("bp");
  if (body.pulse != null && (body.pulse > 130 || body.pulse < 45)) h.push("pulse");
  if (body.temperatureC != null && (body.temperatureC >= 39.5 || body.temperatureC < 35)) h.push("temp");
  if (body.glucoseMgDl != null && (body.glucoseMgDl < 60 || body.glucoseMgDl > 400)) h.push("glucose");
  return h;
}

// ---- home-visit rounds (state machine mirrors @kiorly/field-visit lifecycle) ----
export type RoundState = "REQUESTED" | "CONFIRMED" | "ON_MY_WAY" | "ARRIVED" | "FINISHED" | "ABORTED_UNSAFE" | "CANCELLED" | "NO_SHOW";
export type RoundAction = "depart" | "arrive" | "finish" | "abort" | "sos";
export const ROUND_TERMINAL: RoundState[] = ["FINISHED", "ABORTED_UNSAFE", "CANCELLED", "NO_SHOW"];
export function roundActions(state: string): RoundAction[] {
  switch (state) {
    case "CONFIRMED": return ["depart"];
    case "ON_MY_WAY": case "EN_ROUTE": return ["arrive", "abort", "sos"];
    case "ARRIVED": return ["finish", "abort", "sos"];
    default: return [];
  }
}
export const roundStepIndex = (state: string) => ({ CONFIRMED: 0, ON_MY_WAY: 1, EN_ROUTE: 1, ARRIVED: 2, FINISHED: 3 } as Record<string, number>)[state] ?? -1;
export const roundTone = (state: string): Tone => (state === "FINISHED" ? "success" : state === "ABORTED_UNSAFE" ? "danger" : state === "ARRIVED" || state === "ON_MY_WAY" ? "ocean" : state === "CANCELLED" || state === "NO_SHOW" ? "muted" : "ink");
export const roundCounts = (items: { state: string }[]) => ({ total: items.length, done: items.filter((i) => i.state === "FINISHED").length, active: items.filter((i) => i.state === "ON_MY_WAY" || i.state === "ARRIVED").length });
/** Sample collection needs at least two patient identifiers (name + DOB / MRN / national id). */
export const IDENTIFIER_KINDS = ["FULL_NAME", "DATE_OF_BIRTH", "PHONE"] as const;
export const identifiersOk = (ids: { kind: string; value: string }[]) => new Set(ids.filter((i) => i.value.trim().length > 0 && (IDENTIFIER_KINDS as readonly string[]).includes(i.kind)).map((i) => i.kind)).size >= 2;
export const TUBE_LABEL_RE = /^[\x21-\x7E]{3,40}$/;
export const tubeLabelOk = (l: string) => TUBE_LABEL_RE.test(l.trim());

// ---- revenue ----
export interface RevenueSnapshot { currency: string; today: { net: number; gross: number }; last7: { net: number; gross: number }; last30: { net: number; gross: number }; daily: { date: string; net: number; gross: number }[]; completedVisitsToday: number }
export function revenueSeries(s: RevenueSnapshot, lang: string) {
  const fmt = new Intl.DateTimeFormat(lang.startsWith("ar") ? "ar-EG-u-nu-latn" : "en-GB", { weekday: "short", timeZone: "UTC" });
  return s.daily.map((d) => ({ label: fmt.format(new Date(`${d.date}T12:00:00Z`)), value: Math.round(d.net) }));
}
/** % change of the last day with revenue vs the average of the previous days. */
export function revenueTrend(daily: { net: number }[]): number | null {
  const v = daily.map((d) => d.net).filter((n) => n > 0); if (v.length < 2) return null;
  const last = v[v.length - 1]; const avg = v.slice(0, -1).reduce((a, b) => a + b, 0) / (v.length - 1);
  return avg ? Math.round(((last - avg) / avg) * 100) : null;
}
export const compactMoney = (n: number, lang: string, cur = "EGP") => new Intl.NumberFormat(lang.startsWith("ar") ? "ar-EG-u-nu-latn" : "en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n) + " " + cur;

// ---- visit draft diff (PATCH only what changed; numeric fields sent as numbers) ----
export const VISIT_NUMERIC = ["heartRate", "spo2", "bpSystolic", "bpDiastolic", "temperature", "weightKg"] as const;
export function diffForm<T extends Record<string, string>>(base: T, cur: T, numeric: readonly string[] = VISIT_NUMERIC): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  (Object.keys(cur) as (keyof T & string)[]).forEach((k) => {
    if (cur[k] === base[k]) return;
    if (numeric.includes(k)) { if (cur[k].trim() !== "" && Number.isFinite(Number(cur[k]))) out[k] = Number(cur[k]); } else out[k] = cur[k];
  });
  return out;
}

export const isAbnormalFlag = (f?: string | null) => !!f && f !== "N" && f !== "NORMAL";

/** HVSAF01 via @kiorly/field-visit: 30 min after the planned end without "finished" the clinician is prompted; 10 min later the safety contact is alerted. */
export function safetyPrompt(v: { id: string; state: string; plannedEndsAt: string }, now = Date.now()): "none" | "prompt" {
  const r = evaluateSafety({ id: v.id, state: (v.state === "EN_ROUTE" ? "ON_MY_WAY" : v.state) as never, plannedEndMs: new Date(v.plannedEndsAt).getTime() }, {}, now);
  return r.actions.some((a) => a.type === "PROMPT_CLINICIAN") ? "prompt" : "none";
}
