import { TILES } from "@/modules/registry";
import { isLite, isUpgradeAdmin, lockedTilesFor, roleGroup } from "@/lite/logic";
import type { Bootstrap } from "@/api/types";

const ent = (enabled: boolean, reason: Bootstrap["entitlement"]["reason"] = enabled ? null : "PLAN_BELOW_PRO") => ({ key: "mobile_staff_app" as const, enabled, requiredPlan: "PRO" as const, reason });
const lite = (locked: string[] | undefined, user: Partial<Bootstrap["user"]> = {}, canApprove = false) => ({
  entitlement: ent(false),
  user: { id: "u", name: "n", email: "e", role: "NURSE", roles: ["NURSE"], ...user },
  upgrade: locked ? { lockedModules: locked, myRequest: null, openRequests: null, canApprove } : undefined,
});
const keys = (x: { key: string }[]) => x.map((t) => t.key);

describe("locked-tile rule", () => {
  it("shows only the tiles the server says this ROLE gets on Pro, in registry order", () => {
    expect(keys(lockedTilesFor("clinic", lite(["clinic.vitals", "clinic.homevisits", "clinic.schedule"])))).toEqual(["clinic.schedule", "clinic.vitals", "clinic.homevisits"]);
    // a physician and a manager see different sets from the same registry
    expect(keys(lockedTilesFor("clinic", lite(["clinic.visits", "clinic.prescriptions"], { role: "PHYSICIAN" })))).toEqual(["clinic.visits", "clinic.prescriptions"]);
    expect(keys(lockedTilesFor("clinic", lite(["clinic.revenue"], { role: "CLINIC_ADMIN" })))).toEqual(["clinic.revenue"]);
  });
  it("never leaks another product's tiles or unknown keys", () => {
    expect(keys(lockedTilesFor("pharmacy", lite(["clinic.vitals", "pharmacy.rx", "pharmacy.search", "nope"])))).toEqual(["pharmacy.rx"]);
    for (const p of ["clinic", "pharmacy", "lab"] as const) for (const t of lockedTilesFor(p, lite(undefined))) expect(t.product).toBe(p);
  });
  it("an older server without the upgrade block falls back to the product's registry tiles", () => {
    expect(keys(lockedTilesFor("lab", lite(undefined)))).toEqual(keys(TILES.filter((t) => t.product === "lab")));
  });
  it("shows nothing for entitled orgs, for admin switch-off (FLAG_OFF) and for missing bootstrap", () => {
    expect(lockedTilesFor("clinic", { entitlement: ent(true) })).toEqual([]);
    expect(lockedTilesFor("clinic", { entitlement: ent(false, "FLAG_OFF"), upgrade: { lockedModules: ["clinic.vitals"], myRequest: null, openRequests: null, canApprove: false } })).toEqual([]);
    expect(lockedTilesFor("clinic", undefined)).toEqual([]);
    expect(isLite({ entitlement: ent(false) })).toBe(true);
    expect(isLite({ entitlement: ent(false, "FLAG_OFF") })).toBe(false);
  });
  it("an empty server list means no locked tiles (role has no Pro modules)", () => {
    expect(lockedTilesFor("clinic", lite([]))).toEqual([]);
  });
});

describe("upgrade wording: admin vs staff", () => {
  it("server canApprove wins; otherwise owner flag or admin role", () => {
    expect(isUpgradeAdmin("clinic", lite([], {}, true))).toBe(true);
    expect(isUpgradeAdmin("clinic", lite([], { role: "NURSE" }, false))).toBe(false);
    expect(isUpgradeAdmin("clinic", { entitlement: ent(false), user: { id: "u", name: "n", email: "e", role: "NURSE", roles: [], isOwner: true } })).toBe(true);
    expect(isUpgradeAdmin("pharmacy", { entitlement: ent(false), user: { id: "u", name: "n", email: "e", role: "OWNER", roles: [] } })).toBe(true);
    expect(isUpgradeAdmin("pharmacy", { entitlement: ent(false), user: { id: "u", name: "n", email: "e", role: "CASHIER", roles: [] } })).toBe(false);
    expect(isUpgradeAdmin("lab", undefined)).toBe(false);
  });
  it("maps roles onto benefit-copy groups", () => {
    expect(roleGroup("clinic", "NURSE")).toBe("nurse");
    expect(roleGroup("clinic", "PHYSICIAN")).toBe("doctor");
    expect(roleGroup("clinic", "RECEPTIONIST")).toBe("frontdesk");
    expect(roleGroup("clinic", "HR_OFFICER", true)).toBe("manager");
    expect(roleGroup("pharmacy", "CASHIER")).toBe("counter");
    expect(roleGroup("pharmacy", "PHARMACIST")).toBe("pharmacist");
    expect(roleGroup("lab", "AUTHORIZED_SIGNATORY")).toBe("signatory");
    expect(roleGroup("lab", "PHLEBOTOMIST")).toBe("phleb");
    expect(roleGroup("lab", "WHO")).toBe("staff");
  });
});
