import type { Product } from "@/api/products";
import type { IconName } from "@/components/Icon";

export type HitGroup = "patients" | "drugs" | "customers" | "prescriptions" | "orders" | "specimens" | "appointments";
export interface Hit { id: string; product: Product; group: HitGroup; title: string; subtitle?: string; route: string; icon: IconName }

export const searchPath = (p: Product) => (p === "pharmacy" ? "/mobile/pharmacy/search" : "/mobile/search");

type R = Record<string, unknown>;
const arr = (v: unknown): R[] => (Array.isArray(v) ? (v as R[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Normalises the three product search payloads into one list of routed hits (see each product Docs/MOBILE.md). */
export function buildHits(p: Product, raw: unknown): Hit[] {
  const r = (raw ?? {}) as R;
  const out: Hit[] = [];
  if (p === "clinic") {
    for (const x of arr(r.patients)) out.push({ id: str(x.id), product: p, group: "patients", title: str(x.name ?? x.nameAr ?? x.fullName ?? `${str(x.firstNameEn)} ${str(x.lastNameEn)}`).trim(), subtitle: [x.mrn, x.phone].filter(Boolean).map(str).join(" · "), route: `/clinic/patient/${str(x.id)}`, icon: "user" });
    for (const x of arr(r.appointments)) out.push({ id: str(x.id), product: p, group: "appointments", title: str((x.patient as R | undefined)?.name ?? x.patientName ?? "Appointment"), subtitle: str(x.startsAt ?? x.status), route: "/clinic/schedule", icon: "calendar" });
  } else if (p === "pharmacy") {
    for (const x of arr(r.drugs)) out.push({ id: str(x.id), product: p, group: "drugs", title: str(x.brandName ?? x.name), subtitle: [x.strength, x.dosageForm].filter(Boolean).map(str).join(" · "), route: `/pharmacy/barcode?code=${encodeURIComponent(str(x.gtin ?? x.brandName ?? x.id))}`, icon: "pill" });
    for (const x of arr(r.customers)) out.push({ id: str(x.id), product: p, group: "customers", title: str(x.displayName), subtitle: [x.customerNo, x.phone].filter(Boolean).map(str).join(" · "), route: `/pharmacy/customers?q=${encodeURIComponent(str(x.displayName))}`, icon: "user" });
    for (const x of arr(r.prescriptions)) out.push({ id: str(x.id), product: p, group: "prescriptions", title: str(x.patientName ?? x.prescriberName ?? x.id), subtitle: str(x.status), route: `/pharmacy/rx/${str(x.id)}`, icon: "clipboard" });
  } else {
    for (const x of arr(r.patients)) out.push({ id: str(x.id), product: p, group: "patients", title: str(x.fullName ?? x.name), subtitle: str(x.mrn ?? x.phone), route: `/lab/orders?q=${encodeURIComponent(str(x.fullName ?? x.name))}`, icon: "user" });
    for (const x of arr(r.orders)) out.push({ id: str(x.id), product: p, group: "orders", title: str(x.orderNumber), subtitle: [x.status, x.priority].filter(Boolean).map(str).join(" · "), route: `/lab/orders?q=${encodeURIComponent(str(x.orderNumber))}`, icon: "file" });
    for (const x of arr(r.specimens)) out.push({ id: str(x.id), product: p, group: "specimens", title: str(x.accessionNumber ?? x.barcode), subtitle: str(x.status), route: `/lab/accession?code=${encodeURIComponent(str(x.accessionNumber ?? x.barcode))}`, icon: "syringe" });
  }
  return out.filter((h) => h.id && h.title);
}
