import { I18nManager, Platform } from "react-native";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import { clinicStrings } from "./modules/clinic";
import { clinicB2bStrings } from "./modules/clinic-b2b";
import { clinicCreditStrings } from "./modules/clinic-credit";
import { qrSaveStrings } from "./modules/qr-save";
import { pharmacyStrings } from "./modules/pharmacy";
import { labStrings } from "./modules/lab";
import { pharmacyGrowthStrings } from "./modules/pharmacy-growth";
import { labGrowthStrings } from "./modules/lab-growth";
import { statusStrings } from "./modules/status";
import { prefs } from "@/lib/storage";
import { localizeDigits } from "@/lib/format";

export type Lang = "ar" | "en";
const KEY = "kw-lang";
type Dict = Record<string, unknown>;
const merge = (...parts: Dict[]): Dict => parts.reduce((acc, p) => { for (const k of Object.keys(p)) { const a = acc[k]; const b = p[k]; acc[k] = a && b && typeof a === "object" && typeof b === "object" ? merge(a as Dict, b as Dict) : b; } return acc; }, {} as Dict);
/** Core strings + one bundle per product module (src/i18n/modules/<product>.ts, keys under `<product>.*`). */
export const resources = { en: { translation: merge(en as Dict, clinicStrings.en, clinicB2bStrings.en, clinicCreditStrings.en, qrSaveStrings.en, pharmacyStrings.en, labStrings.en, pharmacyGrowthStrings.en, labGrowthStrings.en, statusStrings.en) }, ar: { translation: merge(ar as Dict, clinicStrings.ar, clinicB2bStrings.ar, clinicCreditStrings.ar, qrSaveStrings.ar, pharmacyStrings.ar, labStrings.ar, pharmacyGrowthStrings.ar, labGrowthStrings.ar, statusStrings.ar) } };
export const isRtlLang = (l: string) => l.startsWith("ar");

/**
 * i18next 27 dropped `interpolation.format`; the supported hook is a `formatter` module. With `alwaysFormat` every interpolated value goes through it: numbers get Arabic-Indic digits in
 * Arabic ("{{count}} أصناف"), string params (names, order numbers, lot ids) pass through untouched. `{{x, number}}` style formats are not used in this app's strings.
 */
const digitFormatter = {
  type: "formatter" as const,
  init() {},
  add() {},
  addCached() {},
  format: (value: unknown, _fmt?: string, lng?: string) => (typeof value === "number" && lng?.startsWith("ar") ? localizeDigits(value, lng) : (value as string)),
};

void i18n.use(initReactI18next).use(digitFormatter).init({
  resources,
  lng: "ar", // Arabic-first (KX-03 §03)
  fallbackLng: "en",
  // Numbers interpolated into Arabic strings ("{{count}} أصناف") use Arabic-Indic digits; string params (names, order numbers, lot ids) are passed through untouched.
  interpolation: { escapeValue: false, alwaysFormat: true },
  initAsync: false,
});

/** Applies layout direction. Returns true when a native restart is required for the direction to flip. */
export function applyDirection(lang: string): boolean {
  const rtl = isRtlLang(lang);
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.dir = rtl ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
    return false;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true;
  }
  return false;
}

/** Loads the saved language (default ar) and applies RTL. Call once before first render. */
export async function bootstrapI18n(): Promise<{ lang: Lang; needsRestart: boolean }> {
  const saved = (await prefs.get(KEY)) as Lang | null;
  const lang: Lang = saved === "en" ? "en" : "ar";
  await i18n.changeLanguage(lang);
  return { lang, needsRestart: applyDirection(lang) };
}

export async function setLanguage(lang: Lang): Promise<boolean> {
  await prefs.set(KEY, lang);
  await i18n.changeLanguage(lang);
  return applyDirection(lang);
}

export default i18n;
