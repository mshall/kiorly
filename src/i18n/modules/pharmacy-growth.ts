import { partnerGrowthStrings } from "./partner-growth-base";
const s = partnerGrowthStrings({ en: { unit: "order", units: "orders", place: "A branch", counter: "pharmacy counter" }, ar: { unit: "طلب", units: "الطلبات", place: "فرع", counter: "كاونتر الصيدلية" } });
/** Pharmacy Growth tab strings (GRW-P4-B3), keys under `pharmacy.growth.*`, merged by src/i18n/index.ts. */
export const pharmacyGrowthStrings = { en: { pharmacy: { growth: s.en } }, ar: { pharmacy: { growth: s.ar } } } as { en: Record<string, unknown>; ar: Record<string, unknown> };
