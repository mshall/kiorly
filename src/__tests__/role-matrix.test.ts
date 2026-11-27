import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { TILES, tilesFor } from "@/modules/registry";
import { resources } from "@/i18n";
import { CLINIC_ROLES, clinicModulesFor } from "./fixtures/clinic-role-modules";
import matrix from "./fixtures/role-modules.generated.json";

type Mods = Record<string, string[]>;
const enabled = (m: { key: string; enabled: boolean; screens: string[] }[]): Mods => Object.fromEntries(m.filter((x) => x.enabled).map((x) => [x.key, x.screens]));
const keysOf = (m: Mods) => Object.keys(m).sort();
const asList = (m: Mods) => Object.entries(m).map(([key, screens]) => ({ key, enabled: true, screens }));
const pharmacy = matrix.pharmacy as Record<string, Mods>;
const lab = matrix.lab as Record<string, { licence: Mods; noLicence: Mods; permissions: string[] }>;
const appDir = path.join(__dirname, "../../app/(tabs)/(more)");
const routeFile = (route: string) => { const p = path.join(appDir, route); return existsSync(`${p}.tsx`) || existsSync(path.join(p, "index.tsx")); };
const tr = (lang: "en" | "ar", key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], resources[lang].translation);

describe("tile registry", () => {
  it("every tile has a route file, an English and an Arabic title and description", () => {
    for (const t of TILES) {
      expect(routeFile(t.route)).toBe(true);
      for (const lang of ["en", "ar"] as const) { expect(typeof tr(lang, `tiles.${t.key}.title`)).toBe("string"); expect(typeof tr(lang, `tiles.${t.key}.desc`)).toBe("string"); }
    }
  });
  it("tile keys are unique and every product has tiles", () => {
    expect(new Set(TILES.map((t) => t.key)).size).toBe(TILES.length);
    for (const p of ["clinic", "pharmacy", "lab"] as const) expect(TILES.some((t) => t.product === p)).toBe(true);
  });
  it("the extra capability routes exist (result entry, clinic commission)", () => {
    expect(existsSync(path.join(appDir, "lab/results/[specimenId].tsx"))).toBe(true);
    expect(existsSync(path.join(appDir, "clinic/commission.tsx"))).toBe(true);
    expect(readdirSync(path.join(appDir, "clinic")).length).toBeGreaterThan(10);
  });
});

describe("Clinic: each role gets only its tiles (mirror of the server table)", () => {
  it("every enabled module maps to a registered clinic tile", () => {
    for (const role of CLINIC_ROLES) for (const m of clinicModulesFor(role)) if (m.enabled) expect(TILES.some((t) => t.key === m.key && t.product === "clinic")).toBe(true);
  });
  const k = (role: Parameters<typeof clinicModulesFor>[0], o?: Parameters<typeof clinicModulesFor>[1]) => keysOf(enabled(clinicModulesFor(role, o)));
  it("doctor: schedule, patients, visits, prescriptions, lab results, vitals, growth; no revenue; home visits only in the Nurse edition", () => {
    expect(k("PHYSICIAN")).toEqual(["clinic.growth", "clinic.labs", "clinic.patients", "clinic.prescriptions", "clinic.schedule", "clinic.visits", "clinic.vitals"]);
    expect(k("PHYSICIAN", { edition: "NURSE" })).toContain("clinic.homevisits");
  });
  it("nurse: schedule, patients, vitals and home visits; never visits, prescriptions, lab review, revenue or growth", () => {
    expect(k("NURSE")).toEqual(["clinic.homevisits", "clinic.patients", "clinic.schedule", "clinic.vitals"]);
  });
  it("a nurse-profession user with the doctor role (Nurse edition) loses visits, prescriptions and lab review", () => {
    expect(k("PHYSICIAN", { edition: "NURSE", profession: "NURSE" })).toEqual(["clinic.growth", "clinic.homevisits", "clinic.patients", "clinic.schedule", "clinic.vitals"]);
  });
  it("receptionist: schedule (check-in) and patient lookup only; call centre the same; dispatcher gets home visits only in the Nurse edition", () => {
    expect(k("RECEPTIONIST")).toEqual(["clinic.patients", "clinic.schedule"]);
    expect(k("CALL_CENTER")).toEqual(["clinic.patients", "clinic.schedule"]);
    expect(k("RECEPTIONIST", { edition: "NURSE" })).toEqual(["clinic.homevisits", "clinic.patients", "clinic.schedule"]);
  });
  it("billing (finance officer): schedule and revenue (with the commission statement); no patients, no clinical", () => {
    expect(k("FINANCE_OFFICER")).toEqual(["clinic.revenue", "clinic.schedule"]);
  });
  it("clinic admin: operations tiles, revenue and growth; never visits or prescriptions (those sign clinical records); the owner gets every table module except home visits (Nurse edition or nurse role)", () => {
    expect(k("CLINIC_ADMIN")).toEqual(["clinic.growth", "clinic.patients", "clinic.revenue", "clinic.schedule", "clinic.vitals"]);
    expect(k("CLINIC_ADMIN", { owner: true })).toEqual(["clinic.growth", "clinic.labs", "clinic.patients", "clinic.prescriptions", "clinic.revenue", "clinic.schedule", "clinic.visits", "clinic.vitals"]);
  });
  it("tilesFor never returns a tile whose module is disabled or absent", () => {
    for (const role of CLINIC_ROLES) {
      const mods = clinicModulesFor(role); const got = tilesFor("clinic", mods).map((t) => t.key).sort();
      expect(got).toEqual(keysOf(enabled(mods)).filter((key) => TILES.some((t) => t.key === key)));
    }
  });
});

describe("Pharmacy: each role gets only its tiles (generated from the Pharmacy API source)", () => {
  it("every enabled module maps to a registered tile (the global search module is the search screen, not a tile)", () => {
    for (const [role, mods] of Object.entries(pharmacy)) for (const key of Object.keys(mods)) { if (key === "pharmacy.search") continue; expect([role, TILES.some((t) => t.key === key && t.product === "pharmacy")]).toEqual([role, true]); }
  });
  it("owner and pharmacist: everything including Kiorex orders, controlled drugs, receiving and stock count", () => {
    for (const r of ["OWNER", "PHARMACIST", "BRANCH_MANAGER"]) expect(keysOf(pharmacy[r]!)).toEqual(["pharmacy.barcode", "pharmacy.controlled", "pharmacy.customers", "pharmacy.expiry", "pharmacy.growth", "pharmacy.orders", "pharmacy.receiving", "pharmacy.rx", "pharmacy.search", "pharmacy.shift", "pharmacy.stockcount"]);
  });
  it("cashier: Rx queue, barcode, expiry, customers, shift and growth (read); no Kiorex orders, controlled, receiving or stock count", () => {
    expect(keysOf(pharmacy.CASHIER!)).toEqual(["pharmacy.barcode", "pharmacy.customers", "pharmacy.expiry", "pharmacy.growth", "pharmacy.rx", "pharmacy.search", "pharmacy.shift"]);
  });
  it("only roles with rx.validate get the validate screen and only the signer gets the override screen", () => {
    expect(pharmacy.PHARMACIST!["pharmacy.rx"]).toEqual(expect.arrayContaining(["rx.validate", "rx.override"]));
    expect(pharmacy.OWNER!["pharmacy.rx"]).toEqual(expect.arrayContaining(["rx.validate", "rx.override"]));
    expect(pharmacy.CASHIER!["pharmacy.rx"]).not.toContain("rx.validate");
    expect(pharmacy.BRANCH_MANAGER!["pharmacy.rx"]).toContain("rx.validate");
    expect(pharmacy.BRANCH_MANAGER!["pharmacy.rx"]).not.toContain("rx.override");
  });
  it("only admin Growth roles may create links", () => {
    expect(pharmacy.OWNER!["pharmacy.growth"]).toContain("growth.create"); expect(pharmacy.BRANCH_MANAGER!["pharmacy.growth"]).toContain("growth.create");
    expect(pharmacy.CASHIER!["pharmacy.growth"]).not.toContain("growth.create"); expect(pharmacy.PHARMACIST!["pharmacy.growth"]).not.toContain("growth.create");
  });
  it("tilesFor mirrors the enabled modules for every role", () => {
    for (const [role, mods] of Object.entries(pharmacy)) expect([role, tilesFor("pharmacy", asList(mods)).map((t) => t.key).sort()]).toEqual([role, keysOf(mods).filter((k) => TILES.some((t) => t.key === k))]);
  });
});

describe("Lab: each role gets only its tiles (generated from the Lab API source)", () => {
  it("every enabled module maps to a registered tile", () => {
    for (const [role, v] of Object.entries(lab)) for (const key of Object.keys(v.licence)) expect([role, TILES.some((t) => t.key === key && t.product === "lab")]).toEqual([role, true]);
  });
  it("technologist: accession, worklist (with result entry), validation, QC, critical, reagents, TAT, orders; no phlebotomy round, no growth, no sign-off", () => {
    expect(keysOf(lab.TECHNOLOGIST!.licence)).toEqual(["lab.accession", "lab.critical", "lab.orders", "lab.qc", "lab.reagents", "lab.tat", "lab.validation", "lab.worklist"]);
    expect(lab.TECHNOLOGIST!.licence["lab.validation"]).not.toContain("sign-off");
    expect(lab.TECHNOLOGIST!.permissions).toEqual(expect.arrayContaining(["results.enter", "results.second_entry", "results.read"]));
  });
  it("receptionist: accession, phlebotomy, orders, TAT, growth (read); no results, validation or QC; cannot enter results", () => {
    expect(keysOf(lab.RECEPTION!.licence)).toEqual(["lab.accession", "lab.growth", "lab.orders", "lab.phlebotomy", "lab.tat"]);
    expect(lab.RECEPTION!.permissions).not.toContain("results.enter");
    expect(lab.RECEPTION!.licence["lab.growth"]).not.toContain("create");
  });
  it("results reviewer (authorised signatory): validation with sign-off only with a recorded licence; cannot enter results", () => {
    expect(lab.AUTHORIZED_SIGNATORY!.licence["lab.validation"]).toContain("sign-off");
    expect(lab.AUTHORIZED_SIGNATORY!.noLicence["lab.validation"]).not.toContain("sign-off");
    expect(lab.AUTHORIZED_SIGNATORY!.permissions).not.toContain("results.enter");
  });
  it("owner: all tiles but the owner is never offered the sign-off screen the server refuses", () => {
    expect(keysOf(lab.OWNER!.licence)).toEqual(["lab.accession", "lab.critical", "lab.growth", "lab.orders", "lab.phlebotomy", "lab.qc", "lab.reagents", "lab.tat", "lab.validation", "lab.worklist"]);
    expect(lab.OWNER!.licence["lab.validation"]).not.toContain("sign-off");
  });
  it("phlebotomist: collection tiles only", () => { expect(keysOf(lab.PHLEBOTOMIST!.licence)).toEqual(["lab.accession", "lab.orders", "lab.phlebotomy"]); });
  it("tilesFor mirrors the enabled modules for every role", () => {
    for (const [role, v] of Object.entries(lab)) expect([role, tilesFor("lab", asList(v.licence)).map((t) => t.key).sort()]).toEqual([role, keysOf(v.licence)]);
  });
});
