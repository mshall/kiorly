/** GRW-P2-C staff app helpers: types and pure functions for the share, slots, statements and verification screens. No React, no I/O. */
export type TemplateKind = "POST" | "STORY" | "FLYER" | "WHATSAPP_MESSAGE" | "SMS_TEXT";
export interface ShareTemplate { id: string; slug: string; kind: TemplateKind; locale: "ar" | "en"; title: string; body: string; protectedFooter: string; shares30d: number; needsDoctor: boolean }
export interface RenderedCard { templateId: string; locale: "ar" | "en"; caption: string; link: string; linkCode: string; layout: string; svg: string }
export interface SlotItem { startsAt: string; endsAt: string; labelEn: string; labelAr: string }
export interface SlotsDto { clinicId: string; clinicianId: string; timezone: string; days: number; items: SlotItem[]; typeId: string }
export interface SlotCardDto { link: string; caption: string; svg: string; slots: string[] }
export type VerificationField = "LICENSE_NUMBER" | "SPECIALTY" | "ADDRESS" | "DISPLAY_NAME" | "PHOTO" | "DOCUMENT";
export type VerificationStatus = "SUBMITTED" | "NEEDS_INFO" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export interface VerificationItem { id: string; field: VerificationField; status: VerificationStatus; evidenceCount: number; decisionNote: string | null; createdAt: string }
export interface VerificationList { items: VerificationItem[]; badge: "VERIFIED" | "UPDATE_UNDER_REVIEW" }
export interface StatementLine { appointmentId: string; date: string; origin: string; decision: "CHARGE" | "NO_CHARGE" | "WAIVED"; amount: string | null; chargeStatus: string | null }
export interface StatementDto { webUrl: string; month: string; zone: string; currency: string; lines: StatementLine[]; totals: { active: string; activeCount: number; reversed: string; waived: string; providerLed: number } }

export const VERIFICATION_FIELDS: VerificationField[] = ["LICENSE_NUMBER", "SPECIALTY", "ADDRESS", "DISPLAY_NAME", "PHOTO", "DOCUMENT"];
export const needsEvidence = (f: string) => f === "PHOTO" || f === "DOCUMENT";
export const MAX_SLOTS = 5;

/** Toggle a slot in the selection, capped at 5, order preserved. */
export function toggleSlot(chosen: string[], iso: string): string[] {
  if (chosen.includes(iso)) return chosen.filter((x) => x !== iso);
  return chosen.length >= MAX_SLOTS ? chosen : [...chosen, iso];
}
export const slotLabel = (s: SlotItem, lang: string) => (lang.startsWith("ar") ? s.labelAr : s.labelEn);

const REF_RE = /^[A-Za-z0-9][A-Za-z0-9_./:-]{0,199}$/;
export function parseEvidence(text: string): { refs: string[]; invalid: string[] } {
  const refs: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    if (!REF_RE.test(s)) invalid.push(s);
    else if (!refs.includes(s)) refs.push(s);
  }
  if (refs.length > 10) invalid.push(...refs.splice(10));
  return { refs, invalid };
}
export function verificationReady(field: VerificationField, value: string, evidenceText: string): boolean {
  const ev = parseEvidence(evidenceText);
  return value.trim().length > 0 && ev.invalid.length === 0 && (!needsEvidence(field) || ev.refs.length > 0);
}

/** The recent months for the statement picker, newest first. */
export const recentMonths = (n: number, now = new Date()): string[] => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
});

/** A plain-text summary for the share sheet (totals only; no patient data exists in a statement line). */
export function statementSummary(s: StatementDto, template: string): string {
  return template.replace("{{month}}", s.month).replace("{{active}}", s.totals.active).replace("{{currency}}", s.currency).replace("{{providerLed}}", String(s.totals.providerLed));
}

/** Server error body code, when the request failed with a structured error (ApiError.code). */
export const codeOf = (e: unknown): string | null => ((e as { code?: string } | null)?.code ?? null);
export const isNetwork = (e: unknown): boolean => Boolean((e as { isNetwork?: boolean } | null)?.isNetwork);
