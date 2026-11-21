import { TILES } from "@/modules/registry";
import { isLite, isUpgradeAdmin, lockedTilesFor, openRequestCount, openRequestsFor, requestFeature, roleGroup } from "@/lite/logic";
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
  it("follows the server canApprove only: no client-side role or owner guess", () => {
    expect(isUpgradeAdmin("clinic", lite([], {}, true))).toBe(true);
    expect(isUpgradeAdmin("clinic", lite([], { role: "NURSE" }, false))).toBe(false);
    // the server said no: an owner flag or an OWNER role on the client does not change that
    expect(isUpgradeAdmin("clinic", { ...lite([], { role: "NURSE", isOwner: true }, false) })).toBe(false);
    expect(isUpgradeAdmin("pharmacy", lite([], { role: "OWNER" }, false))).toBe(false);
    // a server that omits the flag (or no bootstrap) is "ask your admin"
    expect(isUpgradeAdmin("pharmacy", { entitlement: ent(false), user: { id: "u", name: "n", email: "e", role: "OWNER", roles: [] } })).toBe(false);
    expect(isUpgradeAdmin("lab", undefined)).toBe(false);
  });
  it("lab: LAB_DIRECTOR asks their admin (server canApprove=false); only the OWNER approves (canApprove=true)", () => {
    expect(isUpgradeAdmin("lab", lite([], { role: "LAB_DIRECTOR" }, false))).toBe(false);
    expect(isUpgradeAdmin("lab", lite([], { role: "OWNER" }, true))).toBe(true);
    // a LAB_DIRECTOR sees no owner-only request list either
    expect(openRequestCount("lab", { entitlement: ent(false), user: { id: "u", name: "n", email: "e", role: "LAB_DIRECTOR", roles: [] }, upgrade: { lockedModules: [], myRequest: null, openRequests: 3, canApprove: false } })).toBe(0);
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

describe("owner view of staff upgrade requests", () => {
  const item = (id: string, at: string, over: Record<string, unknown> = {}) => ({ id, featureKey: "clinic.vitals", requesterRole: "NURSE", requesterName: "Nadia Ali", requestedAt: at, ...over });
  const owner = (items: unknown[] | undefined, openRequests: number | null = items?.length ?? null, over: Record<string, unknown> = {}) => ({
    entitlement: ent(false), user: { id: "u", name: "n", email: "e", role: "CLINIC_ADMIN", roles: ["CLINIC_ADMIN"] },
    upgrade: { lockedModules: [], myRequest: null, openRequests, openRequestItems: items, canApprove: true, ...over },
  }) as never;
  it("approvers get newest-first items capped at 10", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`r${i}`, new Date(Date.UTC(2026, 10, 1 + i)).toISOString()));
    const out = openRequestsFor("clinic", owner(items, 12));
    expect(out).toHaveLength(10); expect(out[0].id).toBe("r11");
    expect(openRequestCount("clinic", owner(items, 12))).toBe(12); // server total wins when it exceeds the listed items
  });
  it("staff roles and Pro orgs get nothing (they keep the 'ask your admin' state)", () => {
    expect(openRequestsFor("clinic", owner([item("a", "2026-11-01T00:00:00Z")], 1, { canApprove: false }))).toEqual([]);
    expect(openRequestCount("clinic", owner([item("a", "2026-11-01T00:00:00Z")], 1, { canApprove: false }))).toBe(0);
    const pro = { ...(owner([item("a", "2026-11-01T00:00:00Z")]) as object), entitlement: ent(true) } as never;
    expect(openRequestCount("clinic", pro)).toBe(0);
  });
  it("older server (count only) still yields a count; garbage items are dropped", () => {
    expect(openRequestCount("clinic", owner(undefined, 3))).toBe(3);
    expect(openRequestsFor("clinic", owner([item("", "2026-11-01T00:00:00Z"), item("b", "nope"), item("c", "2026-11-01T00:00:00Z")], 3)).map((r) => r.id)).toEqual(["c"]);
    expect(openRequestCount("clinic", owner(undefined, null))).toBe(0);
  });
  it("unknown feature keys fall back to general", () => {
    expect(requestFeature({ featureKey: "clinic.vitals" })).toBe("clinic.vitals");
    expect(requestFeature({ featureKey: "pharmacy.nope" })).toBe("general");
    expect(requestFeature({ featureKey: "general" })).toBe("general");
  });
});
