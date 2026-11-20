import type { Product } from "@/api/products";
import type { IconName } from "@/components/Icon";

/** Module tiles. `key` is the `modules[].key` returned by `/mobile/bootstrap`; the route files live under app/<product>/. Titles: i18n `tiles.<key>.title|desc`. */
export interface Tile { key: string; product: Product; route: string; icon: IconName; /** shown as a quick action on Home */ quick?: boolean }

export const TILES: Tile[] = [
  { key: "clinic.schedule", product: "clinic", route: "/clinic/schedule", icon: "calendar", quick: true },
  { key: "clinic.patients", product: "clinic", route: "/clinic/patients", icon: "users" },
  { key: "clinic.visits", product: "clinic", route: "/clinic/visits", icon: "stethoscope" },
  { key: "clinic.prescriptions", product: "clinic", route: "/clinic/prescriptions", icon: "pill" },
  { key: "clinic.labs", product: "clinic", route: "/clinic/lab-results", icon: "flask" },
  { key: "clinic.vitals", product: "clinic", route: "/clinic/vitals", icon: "activity", quick: true },
  { key: "clinic.homevisits", product: "clinic", route: "/clinic/rounds", icon: "navigation", quick: true },
  { key: "clinic.revenue", product: "clinic", route: "/clinic/revenue", icon: "chart" },
  { key: "pharmacy.rx", product: "pharmacy", route: "/pharmacy/rx", icon: "clipboard", quick: true },
  { key: "pharmacy.barcode", product: "pharmacy", route: "/pharmacy/barcode", icon: "scan", quick: true },
  { key: "pharmacy.receiving", product: "pharmacy", route: "/pharmacy/receiving", icon: "truck" },
  { key: "pharmacy.stockcount", product: "pharmacy", route: "/pharmacy/stockcount", icon: "box" },
  { key: "pharmacy.expiry", product: "pharmacy", route: "/pharmacy/expiry", icon: "clock" },
  { key: "pharmacy.controlled", product: "pharmacy", route: "/pharmacy/controlled", icon: "shield" },
  { key: "pharmacy.shift", product: "pharmacy", route: "/pharmacy/shift", icon: "receipt" },
  { key: "pharmacy.customers", product: "pharmacy", route: "/pharmacy/customers", icon: "users" },
  { key: "pharmacy.orders", product: "pharmacy", route: "/pharmacy/orders", icon: "cart" },
  { key: "lab.phlebotomy", product: "lab", route: "/lab/phlebotomy", icon: "syringe", quick: true },
  { key: "lab.accession", product: "lab", route: "/lab/accession", icon: "scan", quick: true },
  { key: "lab.critical", product: "lab", route: "/lab/critical", icon: "alert" },
  { key: "lab.validation", product: "lab", route: "/lab/validation", icon: "award" },
  { key: "lab.worklist", product: "lab", route: "/lab/worklist", icon: "list" },
  { key: "lab.qc", product: "lab", route: "/lab/qc", icon: "activity" },
  { key: "lab.tat", product: "lab", route: "/lab/tat", icon: "clock" },
  { key: "lab.orders", product: "lab", route: "/lab/orders", icon: "file" },
  { key: "lab.reagents", product: "lab", route: "/lab/reagents", icon: "thermometer" },
];

export const tileByKey = (k: string) => TILES.find((t) => t.key === k);

/** Tiles the signed-in user may open: enabled modules from the product bootstrap (entitlement off => none). */
export function tilesFor(product: Product, modules: { key: string; enabled: boolean }[] | undefined): Tile[] {
  if (!modules) return [];
  const on = new Set(modules.filter((m) => m.enabled).map((m) => m.key));
  return TILES.filter((t) => t.product === product && on.has(t.key));
}

/** Deep-link target for a push / inbox item (`data` from the product). Used by the inbox and by notification taps. */
export function routeForPush(product: Product, data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : null);
  if (product === "pharmacy") {
    if (s("rxId")) return `/pharmacy/rx/${s("rxId")}`;
    if (s("orderId")) return "/pharmacy/orders";
    if (s("discrepancyId")) return "/pharmacy/controlled";
    if (s("lotId") || s("alertId")) return "/pharmacy/expiry";
  } else if (product === "lab") {
    const t = s("template") ?? "";
    if (/crit/i.test(t) || s("criticalAlertId")) return "/lab/critical";
    if (/sla|tat/i.test(t)) return "/lab/tat";
    if (/reagent/i.test(t)) return "/lab/reagents";
    if (/valid|sign/i.test(t) || s("orderId")) return "/lab/validation";
  } else {
    if (s("appointmentId") && /check/i.test(s("template") ?? "")) return "/clinic/schedule";
    if (s("encounterId")) return `/clinic/visit/${s("encounterId")}`;
    if (s("patientId")) return `/clinic/patient/${s("patientId")}`;
    if (s("homeVisitId")) return `/clinic/round/${s("homeVisitId")}`;
    if (s("orderId")) return "/clinic/lab-results";
  }
  return null;
}
