/** Pharmacy and Lab Growth tab (GRW-P4-B3): shared types and pure helpers. Copied from the Clinic module's shape (src/modules/clinic/growth.ts), adapted to ORDERS (not bookings): counts only, no money, no customer data. No React, no I/O. */
import { smsUrl, whatsappUrl } from "@/modules/clinic/growth";
export { smsUrl, whatsappUrl };

export type PartnerProduct = "pharmacy" | "lab";
export type PartnerLevel = "admin" | "read" | "none";
export interface PartnerLink {
  id: string; code: string; label: string; ownerScope: "ORG" | "BRANCH" | "DESK"; channelKind: string; status: "ACTIVE" | "PAUSED" | "REVOKED"; shortUrl: string;
  branchName?: string | null; labName?: string | null; last30: { visits: number; orders: number; completed: number };
}
export interface PartnerOrigin { orders: number; completed: number; completionRate: number | null }
export interface PartnerRecommendation { id: "CREATE_FIRST_LINK" | "PRINT_COUNTER_CARD" | "BRANCH_NOT_LISTED" | "LINKS_UNUSED" | "HIGH_REJECTION"; severity: "high" | "medium" | "low"; params: Record<string, number>; action: string }
export interface PartnerOverview {
  product: "PHARMACY" | "LAB"; level: PartnerLevel; can: { view?: boolean; create: boolean; update?: boolean; revoke?: boolean; commission?: boolean }; plan: { key?: string; maxActiveLinks: number; linksUsed: number } | null;
  profileUrl: string; links: PartnerLink[];
  performance: { days: number; links: { visits: number; orders: number; completed: number; visitToOrder: number | null; orderToCompleted: number | null }; providerOriginated: PartnerOrigin; marketplaceOriginated: PartnerOrigin; acquisitionPending: boolean };
  recommendations: PartnerRecommendation[]; statement: { configured: boolean; note: string }; organisation: string; webGrowthPath: string; webGrowthUrl?: string | null;
}
export interface PartnerQr { url: string; svg: string; linkId: string }

/** Closed channel list a staff member may pick (the API accepts more; the phone offers the four that make sense on a counter or reception desk). */
export const PARTNER_CHANNELS = ["WHATSAPP_SHARE", "QR_DESK", "SOCIAL", "WEB_LINK"] as const;
export const scopeForChannel = (c: string): "DESK" | "ORG" => (c === "QR_DESK" ? "DESK" : "ORG");

/** Share text. The URL is last so chat apps preview it. Pharmacy: orders; Lab: bookings (the person books a test). Never a price, discount or health claim. */
export function partnerShareMessage(product: PartnerProduct, name: string, url: string, lang: string): string {
  const ar = lang.startsWith("ar");
  if (product === "pharmacy") return ar ? `اطلب من ${name} عبر كيوريكس: ${url}` : `Order from ${name} on Kiorex: ${url}`;
  return ar ? `احجز تحاليلك لدى ${name} عبر كيوريكس: ${url}` : `Book your tests with ${name} on Kiorex: ${url}`;
}
export const activePartnerLinks = (l: PartnerLink[]) => l.filter((x) => x.status === "ACTIVE");
/** The most-ordered active link, else the first active one (its QR goes on the card). */
export const featuredPartnerLink = (l: PartnerLink[]): PartnerLink | null => [...activePartnerLinks(l)].sort((a, b) => b.last30.orders - a.last30.orders)[0] ?? null;
export const linkSite = (l: PartnerLink) => l.branchName ?? l.labName ?? null;
export const percent = (r: number | null | undefined): number | null => (r == null ? null : Math.round(r * 100));
/** Share of link-originated orders among all attributed Kiorex orders (0..100), null when none. */
export function partnerShare(p: PartnerOverview["performance"] | null): number | null {
  if (!p) return null;
  const a = p.providerOriginated.orders, b = p.marketplaceOriginated.orders;
  return a + b > 0 ? Math.round((a / (a + b)) * 100) : null;
}
/** Which controls the role sees; mirrors the API matrix (admin: create, pause; read: view only; none: no tab). Revoke is web only. */
export const partnerCapabilities = (level: PartnerLevel) => ({ view: level !== "none", create: level === "admin", pause: level === "admin", revoke: false });
