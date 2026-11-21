import type { Product } from "@/api/products";
import type { Bootstrap } from "@/api/types";
import { TILES, tileByKey, type Tile } from "@/modules/registry";

/** Lite = the org is below the Pro plan (entitlement `mobile_staff_app` off because of the PLAN). Safety alerts still work (ADR-025). */
type Ent = Pick<Bootstrap, "entitlement"> & Partial<Pick<Bootstrap, "upgrade" | "user">>;

/** True when upgrading would unlock the app: not entitled AND the reason is the plan (a FLAG_OFF switch-off is an admin decision, not a sale). */
export const isLite = (b: Ent | null | undefined): boolean => !!b && !b.entitlement.enabled && b.entitlement.reason !== "FLAG_OFF";

/**
 * The locked tiles to show on a Lite org: only modules the signed-in ROLE would get on Pro, in registry order, product-scoped.
 * Source of truth is the server (`bootstrap.upgrade.lockedModules`, computed from the same role rules as the Pro bootstrap). An older server that
 * does not send it falls back to every registry tile of the product (still never another product's).
 */
export function lockedTilesFor(product: Product, b: Ent | null | undefined): Tile[] {
  if (!isLite(b)) return [];
  const keys = b?.upgrade?.lockedModules;
  const all = TILES.filter((t) => t.product === product);
  if (!keys) return all;
  const set = new Set(keys);
  return all.filter((t) => set.has(t.key));
}

/** Roles that can change the plan themselves (owner / admins). Everyone else asks their admin; the request goes to the owner. */
const ADMIN_ROLES: Record<Product, string[]> = {
  clinic: ["GROUP_ADMIN", "CLINIC_ADMIN"],
  pharmacy: ["OWNER"],
  lab: ["OWNER"],
};
export function isUpgradeAdmin(product: Product, b: Ent | null | undefined): boolean {
  if (!b) return false;
  if (typeof b.upgrade?.canApprove === "boolean") return b.upgrade.canApprove;
  return !!b.user?.isOwner || ADMIN_ROLES[product].includes(b.user?.role ?? "");
}

/** Coarse role groups used to pick the benefit copy a person in that role cares about (`lite.benefit.<tile>.<group>`; falls back to `default`). */
export type RoleGroup = "manager" | "doctor" | "nurse" | "frontdesk" | "pharmacist" | "counter" | "signatory" | "tech" | "phleb" | "staff";
export function roleGroup(product: Product, role: string | undefined, isOwner = false): RoleGroup {
  const r = role ?? "";
  if (product === "clinic") {
    if (r === "PHYSICIAN") return "doctor";
    if (r === "NURSE") return "nurse";
    if (isOwner || ["GROUP_ADMIN", "CLINIC_ADMIN", "GROUP_SUPERVISOR", "BRANCH_MANAGER", "FINANCE_OFFICER"].includes(r)) return "manager";
    if (["RECEPTIONIST", "CALL_CENTER", "CLINIC_ASSISTANT"].includes(r)) return "frontdesk";
    return "staff";
  }
  if (product === "pharmacy") {
    if (["OWNER", "BRANCH_MANAGER", "CHAIN_OPS"].includes(r)) return "manager";
    if (r === "PHARMACIST") return "pharmacist";
    if (["CASHIER", "ASSISTANT"].includes(r)) return "counter";
    return "staff";
  }
  if (["OWNER", "LAB_DIRECTOR", "BRANCH_MANAGER", "SUPERVISOR", "FINANCE"].includes(r)) return "manager";
  if (r === "AUTHORIZED_SIGNATORY") return "signatory";
  if (r === "TECHNOLOGIST") return "tech";
  if (r === "PHLEBOTOMIST") return "phleb";
  return "staff";
}

/** i18n keys for a locked feature: the role-specific line first, then the generic one. */
export const benefitKeys = (tileKey: string, group: RoleGroup) => [`lite.benefit.${tileKey}.${group}`, `lite.benefit.${tileKey}.default`];

export const GENERAL_FEATURE = "general";
export const isFeatureKey = (k: string | undefined): k is string => !!k && (k === GENERAL_FEATURE || !!tileByKey(k));
