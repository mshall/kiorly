import fs from "node:fs";
import path from "node:path";
import makeConfig, { DEV_CLIENT_PLUGINS, isDevClientProfile } from "../../app.config";

/**
 * expo-dev-client (and the floating-button override) is a development-build tool: it must not be in the native config of any release-class EAS profile.
 * The same check by hand: `EAS_BUILD_PROFILE=<profile> npx expo config --json` and look at `plugins`.
 */
const root = path.resolve(__dirname, "../..");
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")) as { expo: Record<string, unknown> };
const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8")) as { build: Record<string, { developmentClient?: boolean; extends?: string }> };
const names = (profile: string) => {
  const saved = { ...process.env };
  Object.assign(process.env, { EAS_BUILD_PROFILE: profile, SKIP_FIREBASE_CHECK: "1", STAFF_LINK_HOST: "app.test.kiorly.com" });
  try { return (makeConfig({ config: app.expo as never, projectRoot: root } as never).plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p)); }
  finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
};
const isDevClientBuild = (n: string): boolean => { const b = eas.build[n]; return b?.developmentClient ?? (b?.extends ? isDevClientBuild(b.extends) : false); };

describe("expo-dev-client only in development profiles", () => {
  it("app.json still lists the plugins (development builds read them from there)", () => {
    for (const p of DEV_CLIENT_PLUGINS) expect((app.expo.plugins as unknown[]).includes(p)).toBe(true);
  });
  it.each(Object.keys(eas.build).filter((n) => n !== "base"))("EAS profile %s: dev-client plugins present exactly when the profile is a dev-client build", (profile) => {
    const n = names(profile);
    for (const p of DEV_CLIENT_PLUGINS) expect(n.includes(p)).toBe(isDevClientBuild(profile));
    expect(isDevClientProfile(profile)).toBe(isDevClientBuild(profile));
  });
  it.each(["preview", "kx-test", "kx-test-simulator", "pilot", "production"])("%s (store or release class) has no dev-client plugin", (profile) => {
    expect(names(profile)).not.toContain("expo-dev-client");
    expect(names(profile)).not.toContain("./plugins/withDevMenuNoFab.js");
  });
  it("local runs without a profile (development) keep it", () => { expect(names("development")).toContain("expo-dev-client"); });
});
