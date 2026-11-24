import { partnerGrowthStrings } from "./partner-growth-base";
const s = partnerGrowthStrings({ en: { unit: "booking", units: "bookings", place: "A site", counter: "reception desk" }, ar: { unit: "حجز", units: "الحجوزات", place: "فرع", counter: "مكتب الاستقبال" } });
/** Lab Growth tab strings (GRW-P4-B3), keys under `lab.growth.*`, merged by src/i18n/index.ts. */
export const labGrowthStrings = { en: { lab: { growth: s.en } }, ar: { lab: { growth: s.ar } } } as { en: Record<string, unknown>; ar: Record<string, unknown> };
