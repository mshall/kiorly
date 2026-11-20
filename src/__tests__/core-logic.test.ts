import { shouldLock } from "@/auth/lock";
import { routeForPush, tilesFor, TILES } from "@/modules/registry";
import { routeForScan } from "@/lib/scanRoute";
import { buildHits } from "@/lib/search";
import { parseErrorBody, ApiError } from "@/api/errors";
import { buildUrl } from "@/api/client";
import { shouldAccept } from "@/components/scanner";
import { resources } from "@/i18n";

describe("app lock", () => {
  test("locks only after the grace period in background", () => {
    expect(shouldLock(true, 1_000, 31_000, 30)).toBe(true);
    expect(shouldLock(true, 1_000, 20_000, 30)).toBe(false);
    expect(shouldLock(false, 1_000, 99_000, 30)).toBe(false);
    expect(shouldLock(true, null, 99_000, 30)).toBe(false);
    expect(shouldLock(true, 1_000, 1_000, 0)).toBe(true);
  });
});
describe("module registry (per-role modules)", () => {
  test("only enabled modules of the product are shown; entitlement off => none", () => {
    const mods = [{ key: "clinic.schedule", enabled: true }, { key: "clinic.revenue", enabled: false }, { key: "lab.qc", enabled: true }];
    expect(tilesFor("clinic", mods).map((t) => t.key)).toEqual(["clinic.schedule"]);
    expect(tilesFor("clinic", [])).toEqual([]);
    expect(tilesFor("clinic", undefined)).toEqual([]);
  });
  test("every tile has AR + EN titles and a route", () => {
    const en = resources.en.translation as any, ar = resources.ar.translation as any;
    for (const t of TILES) {
      const [a, b] = t.key.split(".");
      expect(en.tiles[a][b].title).toBeTruthy(); expect(ar.tiles[a][b].title).toBeTruthy(); expect(t.route.startsWith(`/${t.product}/`)).toBe(true);
    }
  });
  test("push deep links", () => {
    expect(routeForPush("pharmacy", { rxId: "r1" })).toBe("/pharmacy/rx/r1");
    expect(routeForPush("pharmacy", { discrepancyId: "d" })).toBe("/pharmacy/controlled");
    expect(routeForPush("lab", { template: "critical.value" })).toBe("/lab/critical");
    expect(routeForPush("clinic", { patientId: "p1" })).toBe("/clinic/patient/p1");
    expect(routeForPush("clinic", null)).toBeNull();
  });
});
describe("scan routing", () => {
  test("routes by symbology and connected products", () => {
    expect(routeForScan("6221234567890", ["pharmacy", "lab"])).toBe("/pharmacy/barcode?code=6221234567890");
    expect(routeForScan("CAI2611200089", ["lab"])).toBe("/lab/accession?code=CAI2611200089");
    expect(routeForScan("MRN-1001", ["clinic"])).toBe("/clinic/patients?q=MRN-1001");
    expect(routeForScan("x", [])).toBeNull();
    expect(routeForScan("  ", ["lab"])).toBeNull();
  });
  test("debounces repeated frames", () => {
    expect(shouldAccept("a", null, 0)).toBe(true);
    expect(shouldAccept("a", { code: "a", at: 0 }, 500)).toBe(false);
    expect(shouldAccept("a", { code: "a", at: 0 }, 2000)).toBe(true);
    expect(shouldAccept("b", { code: "a", at: 0 }, 100)).toBe(true);
  });
});
describe("global search mapping", () => {
  test("normalises the three product payloads", () => {
    expect(buildHits("clinic", { patients: [{ id: "1", name: "Amal", mrn: "M1" }] })[0]).toMatchObject({ route: "/clinic/patient/1", group: "patients" });
    expect(buildHits("pharmacy", { drugs: [{ id: "d", brandName: "Panadol", strength: "500mg", gtin: "123" }], customers: [], prescriptions: [{ id: "r", patientName: "X", status: "RECEIVED" }] }).map((h) => h.group)).toEqual(["drugs", "prescriptions"]);
    expect(buildHits("lab", { orders: [{ id: "o", orderNumber: "ORD-1", status: "X" }], specimens: [{ id: "s", accessionNumber: "A1" }] })).toHaveLength(2);
    expect(buildHits("lab", null)).toEqual([]);
  });
});
describe("api errors", () => {
  test("parses product error bodies", () => {
    const e = parseErrorBody(403, { statusCode: 403, code: "FEATURE_DISABLED", key: "mobile_staff_app", scope: "org", message: "off" }, "x");
    expect(e.isFeatureDisabled).toBe(true); expect(e.featureKey).toBe("mobile_staff_app");
    expect(parseErrorBody(401, { code: "DEVICE_REVOKED" }, "x").isDeviceRevoked).toBe(true);
    expect(parseErrorBody(400, { message: ["a", "b"] }, "x").message).toBe("a, b");
    expect(new ApiError(0, "NETWORK", "n").retryable).toBe(true);
    expect(new ApiError(422, "V", "n").retryable).toBe(false);
  });
  test("builds urls with query", () => {
    expect(buildUrl("clinic", "/x", { a: 1, b: undefined, c: "d e" })).toMatch(/\/x\?a=1&c=d%20e$/);
  });
});
describe("i18n parity", () => {
  const flat = (o: any, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  test("Arabic and English have the same keys", () => {
    const en = flat(resources.en.translation).sort(), ar = flat(resources.ar.translation).sort();
    expect(ar).toEqual(en);
  });
});
