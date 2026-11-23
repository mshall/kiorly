import Constants from "expo-constants";
import { theme } from "@/brand/theme";

export type Product = "clinic" | "pharmacy" | "lab";
export const PRODUCTS: readonly Product[] = ["clinic", "pharmacy", "lab"] as const;
export const APP_VERSION: string = (Constants.expoConfig?.version as string | undefined) ?? "0.1.0";
/** Sent as `X-Kiorly-Client` on every request. The backends also still accept the retired client names (see their Docs/MOBILE.md). */
export const CLIENT_HEADER = `kiorly/${APP_VERSION}`;

// Literal `process.env.EXPO_PUBLIC_*` member reads only: Metro/Babel inline exactly these at build time (an aliased `const env = process.env` is NOT inlined, so every web/production build silently fell back to the localhost defaults).

/** Base URLs (prefix included). Override per environment with EXPO_PUBLIC_*_API; defaults are the local workspace ports (INTEGRATION.md). */
export const API_BASE: Record<Product, string> = {
  clinic: process.env.EXPO_PUBLIC_CLINIC_API ?? "http://localhost:3010/api/v1",
  pharmacy: process.env.EXPO_PUBLIC_PHARMACY_API ?? "http://localhost:3100/api/v1",
  lab: process.env.EXPO_PUBLIC_LAB_API ?? "http://localhost:3200/api/v1",
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

/** Sign-in entry points. "nurse" is a front door to the clinic backend (nurses, aides and dispatchers have Kiorly Clinic accounts): it signs in as the clinic product and lands on today's home visits. */
export type SignInEntry = Product | "nurse";
export const SIGN_IN_ENTRIES: readonly SignInEntry[] = ["clinic", "nurse", "pharmacy", "lab"] as const;
export const productOf = (e: SignInEntry): Product => (e === "nurse" ? "clinic" : e);

export const accentFor = (p: Product, scheme: "light" | "dark") => (scheme === "dark" ? PRODUCT_META[p].accent.dark : PRODUCT_META[p].accent.graphic);
