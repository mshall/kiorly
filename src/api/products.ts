import Constants from "expo-constants";
import { theme } from "@/brand/theme";

export type Product = "clinic" | "pharmacy" | "lab";
export const PRODUCTS: readonly Product[] = ["clinic", "pharmacy", "lab"] as const;
export const APP_VERSION: string = (Constants.expoConfig?.version as string | undefined) ?? "0.1.0";
export const CLIENT_HEADER = `kiorly-work/${APP_VERSION}`;

type Env = Record<string, string | undefined>;
const env = (process.env ?? {}) as Env;

/** Base URLs (prefix included). Override per environment with EXPO_PUBLIC_*_API; defaults are the local workspace ports (INTEGRATION.md). */
export const API_BASE: Record<Product, string> = {
  clinic: env.EXPO_PUBLIC_CLINIC_API ?? "http://localhost:3010/api/v1",
  pharmacy: env.EXPO_PUBLIC_PHARMACY_API ?? "http://localhost:3100/api/v1",
  lab: env.EXPO_PUBLIC_LAB_API ?? "http://localhost:3200/api/v1",
};

export interface ProductMeta {
  key: Product;
  /** i18n key for the product name. */
  nameKey: string;
  accent: { graphic: string; text: string; dark: string };
  /** product login: password = email + password; devlogin = org slug + email (Lab dev IdP stand-in, replaced by Passport OIDC in production). */
  login: "password" | "devlogin";
  icon: "stethoscope" | "pill" | "flask";
}

export const PRODUCT_META: Record<Product, ProductMeta> = {
  clinic: { key: "clinic", nameKey: "product.clinic", accent: theme.products.clinic, login: "password", icon: "stethoscope" },
  pharmacy: { key: "pharmacy", nameKey: "product.pharmacy", accent: theme.products.pharmacy, login: "password", icon: "pill" },
  lab: { key: "lab", nameKey: "product.lab", accent: theme.products.lab, login: "devlogin", icon: "flask" },
};

export const accentFor = (p: Product, scheme: "light" | "dark") => (scheme === "dark" ? PRODUCT_META[p].accent.dark : PRODUCT_META[p].accent.graphic);

/** Demo accounts (dev only; TEST_DATA.md). Never shown in production builds. */
export const DEMO_ACCOUNTS: Record<Product, { label: string; plan: "PRO" | "ENTERPRISE" | "BASIC"; email: string; password?: string; org?: string }[]> = {
  clinic: [
    { label: "Doctor (Nile Care)", plan: "PRO", email: "nadia.na@demo.kiorex.test", password: "Demo@12345" },
    { label: "Nurse (Nile Care)", plan: "PRO", email: "nurse.na@demo.kiorex.test", password: "Demo@12345" },
    { label: "Owner (Nile Care)", plan: "PRO", email: "owner.na@demo.kiorex.test", password: "Demo@12345" },
    { label: "Solo nurse Mona", plan: "PRO", email: "mona@nurse-demo.kiorly.test", password: "Demo@12345" },
    { label: "Owner (Basic clinic)", plan: "BASIC", email: "owner.basic@demo.kiorex.test", password: "Demo@12345" },
  ],
  pharmacy: [
    { label: "Pharmacist", plan: "ENTERPRISE", email: "pharmacist@demo.kiorly.local", password: "Demo@12345" },
    { label: "Manager (witness)", plan: "ENTERPRISE", email: "manager@demo.kiorly.local", password: "Demo@12345" },
    { label: "Solo owner", plan: "PRO", email: "solo.owner@demo.kiorly.local", password: "Demo@12345" },
    { label: "Owner (Basic pharmacy)", plan: "BASIC", email: "owner.basic@demo.kiorly.local", password: "Demo@12345" },
  ],
  lab: [
    { label: "Pathologist", plan: "PRO", email: "signatory@demo-lab.test", org: "demo-lab" },
    { label: "Phlebotomist", plan: "PRO", email: "phleb@demo-lab.test", org: "demo-lab" },
    { label: "Technologist", plan: "PRO", email: "tech@demo-lab.test", org: "demo-lab" },
    { label: "Director (Basic lab)", plan: "BASIC", email: "director@basic-lab.test", org: "basic-lab" },
  ],
};
