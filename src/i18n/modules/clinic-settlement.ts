import { partnerGrowthStrings } from "./partner-growth-base";
const s = partnerGrowthStrings({ en: { unit: "visit", units: "visits", place: "A clinic", counter: "reception desk" }, ar: { unit: "زيارة", units: "الزيارات", place: "عيادة", counter: "مكتب الاستقبال" } });
const page = {
  en: { title: "Kiorex commission", intro: "Your commission rate and settlement statement. Kiorex sets them; you can see them here but not change them.", forbidden: "Commission figures are visible to finance and, when your organisation allows it, to administrators.", open: "Kiorex commission statement" },
  ar: { title: "عمولة كيوريكس", intro: "نسبة العمولة وكشف التسوية الخاصين بك. تحددهما كيوريكس ويمكنك رؤيتهما هنا دون تعديلهما.", forbidden: "أرقام العمولة متاحة للمالية، وللمسؤولين عندما تسمح بذلك مؤسستك.", open: "كشف عمولة كيوريكس" },
};
/** Clinic settlement view (COM-2 / COM-3): the same read-only cards as Pharmacy and Lab, keys under `clinic.settlement` (cards) and `clinic.settlementPage` (screen). Merged by src/i18n/index.ts. */
export const clinicSettlementStrings = {
  en: { clinic: { settlement: (s.en as { commission: unknown }).commission, settlementPage: page.en } },
  ar: { clinic: { settlement: (s.ar as { commission: unknown }).commission, settlementPage: page.ar } },
} as { en: Record<string, unknown>; ar: Record<string, unknown> };
