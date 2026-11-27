import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Build-time environment profiles (config/env/<profile>.env) are GENERATED from the URL registry (ADR-059, `_docs/registry/emit-mobile-env.mjs`) and are the only place
 * the app's hosts live. This test keeps them honest: public configuration only, https outside local, eas.json equal to the files, no drift from the registry.
 */
const root = path.resolve(__dirname, "../..");
const read = (p: string) => Object.fromEntries(fs.readFileSync(path.join(root, "config/env", `${p}.env`), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8")) as { build: Record<string, { env?: Record<string, string>; extends?: string }> };
const ALLOWED = /^(APP_ENV|EXPO_PUBLIC_[A-Z_]+|STAFF_LINK_HOST|APP_LINK_HOST)$/;
const PROFILES = ["local", "local-android", "test", "pilot", "prod"];
const emitter = path.resolve(root, "../_docs/registry/emit-mobile-env.mjs");

describe("config/env profiles", () => {
  it.each(PROFILES)("%s carries public configuration only", (p) => {
    const v = read(p);
    for (const [k, val] of Object.entries(v)) { expect(k).toMatch(ALLOWED); expect(val).not.toMatch(/secret|token|password|key=/i); }
    expect(v.EXPO_PUBLIC_PASSPORT_CLIENT_ID).toBe("kiorly");
  });
  it.each(["test", "pilot", "prod"])("%s resolves every host over https and never a local address", (p) => {
    const v = read(p);
    for (const k of ["EXPO_PUBLIC_CLINIC_API", "EXPO_PUBLIC_PHARMACY_API", "EXPO_PUBLIC_LAB_API", "EXPO_PUBLIC_PASSPORT_ISSUER"]) expect(v[k]).toMatch(/^https:\/\/[a-z0-9.-]+(\/api\/v1)?$/);
    expect(JSON.stringify(v)).not.toMatch(/localhost|127\.0\.0\.1|10\.0\.2\.2/);
  });
  it("test points at the kx-test hosts, pilot at the production issuer (ADR-059), and no two environments share a product host", () => {
    expect(read("test").EXPO_PUBLIC_PASSPORT_ISSUER).toMatch(/^https:\/\/passport\.test\./);
    expect(read("pilot").EXPO_PUBLIC_PASSPORT_ISSUER).toBe(read("prod").EXPO_PUBLIC_PASSPORT_ISSUER);
    const clinics = ["test", "pilot", "prod"].map((p) => read(p).EXPO_PUBLIC_CLINIC_API);
    expect(new Set(clinics).size).toBe(3);
  });
  it("eas.json profiles carry exactly the profile files", () => {
    expect(eas.build.preview!.env).toEqual(read("test"));
    expect(eas.build.pilot!.env).toEqual(read("pilot"));
    expect(eas.build.production!.env).toEqual(read("prod"));
    expect(eas.build["kx-test"]!.extends).toBe("preview");
  });
  (fs.existsSync(emitter) ? it : it.skip)("matches what the URL registry produces (no hand edits, no drift)", () => {
    execFileSync(process.execPath, [emitter, "--check"], { encoding: "utf8" });
  });
});
