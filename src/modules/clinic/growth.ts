/** Kiorly Growth tab (GRW-P1-L): types and pure helpers (share links, conversion, formatting). No React, no I/O. */
export type GrowthLevel = "admin" | "marketing" | "read" | "doctor";
export interface GrowthLink {
  id: string; code: string; label: string; ownerScope: string; channelKind: string; status: "ACTIVE" | "PAUSED" | "REVOKED"; shortUrl: string;
  targetNameEn: string; targetNameAr: string; last30: { visits: number; bookings: number; attended: number };
}
export interface OriginStats { bookings: number; attended: number; cancelledOrNoShow: number; newPatients: number; attendedRate: number | null; cancellationRate: number | null }
export interface GrowthPerformance {
  days: number; providerOriginated: OriginStats; marketplaceOriginated: OriginStats;
  links: { visits: number; bookings: number; attended: number; visitToBooking: number | null; bookingToAttended: number | null };
  incrementalMarketplaceRevenue: number;
  commission: { currency: string; total: number; incrementalRevenueNet: number };
}
export interface GrowthRecommendation { id: string; severity: "high" | "medium" | "low"; params: Record<string, number>; action: string }
export interface GrowthCommission {
  period: string; currency: string; chargesByStatus: Record<string, { count: number; amount: string }>; providerLedBookings: number;
  byDecision: Record<string, number>; totals: { expectedFromDecisions: string; activeCharges: string; reversedOrWaived: string }; reconciled: boolean; statement: string;
}
export interface GrowthOverview {
  /** Optional: `NURSE` when the Clinic marks the Nurse edition in the payload (request to the Clinic owner). */
  product?: "CLINIC" | "NURSE";
  level: GrowthLevel;
  can: { create: boolean; pause: boolean; widget: boolean };
  plan: { key: string; maxActiveLinks: number; linksUsed: number } | null;
  clinic: { id: string; nameEn: string; nameAr: string } | null;
  profile: { kind: "clinic" | "doctor"; kiorexUrl: string | null; pageUrl: string | null; ready: boolean };
  links: GrowthLink[];
  summary: { days: number; totals: { visits: number; bookings: number; attended: number }; links: number };
  performance: GrowthPerformance | null;
  recommendations: GrowthRecommendation[];
  commission: GrowthCommission | null;
  webGrowthUrl: string;
  promise: string;
  serverTime: string;
}
export interface GrowthQr { url: string; svg: string; linkId: string | null }

/** Text pre-filled into WhatsApp / SMS / the share sheet. The URL is always last so chat apps preview it. */
export const shareMessage = (name: string, url: string, lang: string, nurse = false) =>
  nurse
    ? (lang.startsWith("ar") ? `احجز زيارة منزلية مع ${name} عبر كيوريكس: ${url}` : `Book a home visit with ${name} on Kiorex: ${url}`) // GRW-P4-B3: Nurse edition wording
    : lang.startsWith("ar") ? `احجز موعدك مع ${name} عبر كيوريكس: ${url}` : `Book with ${name} on Kiorex: ${url}`;
/** GRW-P4-B3: the Nurse edition of Kiorly Clinic serves the same Growth tab; its wording is about home visits. The edition comes from the bootstrap (`org.edition`) or the Growth payload (`product`, when the Clinic sends it). */
export const isNurseEdition = (edition?: string | null, product?: string | null) => String(edition ?? "").toUpperCase() === "NURSE" || String(product ?? "").toUpperCase() === "NURSE";

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
/** `sms:?&body=` works on iOS, `sms:?body=` on Android; the iOS form is also accepted by Android messaging apps. */
export const smsUrl = (text: string) => `sms:?&body=${encodeURIComponent(text)}`;

/** Whole-percent string of a 0..1 ratio, or null when there is nothing to divide by. */
export const pct = (r: number | null | undefined): number | null => (r == null ? null : Math.round(r * 100));

/** Visit-to-booking conversion for the summary, computed from counts (never NaN). */
export const conversion = (visits: number, bookings: number): number | null => (visits > 0 ? Math.round((bookings / visits) * 100) : null);

/** Share of provider-originated bookings among all attributed bookings (0..100), null when none. */
export function providerShare(p: GrowthPerformance | null): number | null {
  if (!p) return null;
  const a = p.providerOriginated.bookings, b = p.marketplaceOriginated.bookings;
  return a + b > 0 ? Math.round((a / (a + b)) * 100) : null;
}

export const activeLinks = (links: GrowthLink[]) => links.filter((l) => l.status === "ACTIVE");
/** Best link to put on the QR card: the most-booked active link, else the first active one. */
export function featuredLink(links: GrowthLink[]): GrowthLink | null {
  const act = activeLinks(links);
  return [...act].sort((a, b) => b.last30.bookings - a.last30.bookings)[0] ?? null;
}
export const linkName = (l: GrowthLink, lang: string) => (lang.startsWith("ar") ? l.targetNameAr || l.targetNameEn : l.targetNameEn) || l.label;
export const nextLinkQuota = (plan: GrowthOverview["plan"]) => (plan ? Math.max(0, plan.maxActiveLinks - plan.linksUsed) : null);
