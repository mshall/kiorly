import type { Product } from "@/api/products";

/**
 * SUB-01: plans are bought, renewed and cancelled on the WEB (Clinic, Pharmacy and Lab web apps, route `/plan`), never inside the iOS or Android app.
 * Store policy for SaaS subscriptions is a founder check (LG-SUB-4); until it is cleared the app only shows the plan and points to the web.
 * The web origin per product comes from `EXPO_PUBLIC_WEB_URL_<PRODUCT>` (no hard-coded domains); without it the note is shown without a link.
 */
export function webPlanUrl(product: Product, env: Record<string, string | undefined> = process.env): string | null {
  const base = env[`EXPO_PUBLIC_WEB_URL_${product.toUpperCase()}`]?.trim();
  if (!base || !/^https:\/\/[^\s/]+/.test(base)) return null;
  return `${base.replace(/\/+$/, "")}/plan`;
}
