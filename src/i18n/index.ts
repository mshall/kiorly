import { I18nManager, Platform, DevSettings } from "react-native";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import { clinicStrings } from "./modules/clinic";
import { pharmacyStrings } from "./modules/pharmacy";
import { labStrings } from "./modules/lab";
import { prefs } from "@/lib/storage";

export type Lang = "ar" | "en";
const KEY = "kw-lang";
type Dict = Record<string, unknown>;
const merge = (...parts: Dict[]): Dict => parts.reduce((acc, p) => { for (const k of Object.keys(p)) { const a = acc[k]; const b = p[k]; acc[k] = a && b && typeof a === "object" && typeof b === "object" ? merge(a as Dict, b as Dict) : b; } return acc; }, {} as Dict);
/** Core strings + one bundle per product module (src/i18n/modules/<product>.ts, keys under `<product>.*`). */
export const resources = { en: { translation: merge(en as Dict, clinicStrings.en, pharmacyStrings.en, labStrings.en) }, ar: { translation: merge(ar as Dict, clinicStrings.ar, pharmacyStrings.ar, labStrings.ar) } };
export const isRtlLang = (l: string) => l.startsWith("ar");

void i18n.use(initReactI18next).init({
  resources,
  lng: "ar", // Arabic-first (KX-03 §03)
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  initImmediate: false,
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
    if (__DEV__ && DevSettings?.reload) DevSettings.reload();
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
