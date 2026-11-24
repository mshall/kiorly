import type { PartnerOverview } from "@/modules/partner-growth";
export * from "@/modules/partner-growth";
/** Kiorly Pharmacy Growth tab (GRW-P4-B3): module key, screen route and API paths. Staff-app product key `pharmacy`; payload from `/mobile/growth` of the Pharmacy API (GRW-P4-B1). */
export const PHARMACY_GROWTH = { product: "pharmacy" as const, moduleKey: "pharmacy.growth", route: "/pharmacy/growth", deepLink: "kiorly://open/growth:pharmacy", i18n: "pharmacy.growth" } as const;
export type PharmacyGrowthOverview = PartnerOverview;
