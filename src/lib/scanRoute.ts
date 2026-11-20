import type { Product } from "@/api/products";

const isGtin = (c: string) => /^\d{8}$|^\d{12,14}$/.test(c) || /^\(?01\)?\d{14}/.test(c);
const isLabAccession = (c: string) => /^[A-Z]{2,4}\d{8,12}$/i.test(c) || /^(SPC|SP|LAB)[-_]/i.test(c);

/** Pure router for the universal scanner (unit-tested). Returns null when no connected product can handle the code. */
export function routeForScan(raw: string, products: Product[]): string | null {
  const code = raw.trim();
  if (!code) return null;
  const has = (p: Product) => products.includes(p);
  const enc = encodeURIComponent(code);
  if (has("lab") && isLabAccession(code)) return `/lab/accession?code=${enc}`;
  if (has("pharmacy") && isGtin(code)) return `/pharmacy/barcode?code=${enc}`;
  if (has("clinic") && /^(MRN|P)[-_]?\w+/i.test(code)) return `/clinic/patients?q=${enc}`;
  if (has("pharmacy") && /^\d+$/.test(code)) return `/pharmacy/barcode?code=${enc}`;
  if (has("lab") && /^ORD[-_]/i.test(code)) return `/lab/accession?code=${enc}`;
  if (has("pharmacy")) return `/pharmacy/barcode?code=${enc}`;
  if (has("lab")) return `/lab/accession?code=${enc}`;
  if (has("clinic")) return `/clinic/patients?q=${enc}`;
  return null;
}
