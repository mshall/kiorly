import type { PartnerOverview } from "@/modules/partner-growth";
export * from "@/modules/partner-growth";
/** Kiorly Lab Growth tab (GRW-P4-B3): module key, screen route and API paths. Staff-app product key `lab`; payload from `/mobile/growth` of the Lab API (GRW-P4-B1). */
export const LAB_GROWTH = { product: "lab" as const, moduleKey: "lab.growth", route: "/lab/growth", deepLink: "kiorly://open/growth:lab", i18n: "lab.growth" } as const;
export type LabGrowthOverview = PartnerOverview;
