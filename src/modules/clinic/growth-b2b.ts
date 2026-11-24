/** GRW-P4-C staff app helpers for "Refer a company": types and pure checks. No React, no I/O. Company data only. */
export const SIZE_BUCKETS = ["UNKNOWN", "1_49", "50_199", "200_999", "1000_PLUS"] as const;
export interface B2bItem { id: string; companyName: string; sizeBucket: string; contactRef: string | null; status: "SUBMITTED"; createdAt: string }
export interface B2bList { items: B2bItem[]; note: { reward: "NONE"; message: string } }
const toAscii = (t: string) => t.normalize("NFKC").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
const PERSONAL = [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, /(?:\+|00)?\d[\d\s().-]{8,}\d/, /\b[23]\d{13}\b/];
/** An e-mail address, a phone number or a national id (Arabic-Indic digits included): a person, not a company. */
export const looksPersonal = (text: string): boolean => PERSONAL.some((re) => re.test(toAscii(text)));
export type B2bProblem = "NAME" | "PERSONAL" | "REF_LENGTH" | null;
export function b2bProblem(i: { companyName: string; contactRef: string }): B2bProblem {
  const n = i.companyName.trim();
  if (n.length < 2 || n.length > 120) return "NAME";
  if (looksPersonal(n) || looksPersonal(i.contactRef)) return "PERSONAL";
  if (i.contactRef.trim().length > 80) return "REF_LENGTH";
  return null;
}
