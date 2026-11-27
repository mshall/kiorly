import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { staffLinkHost } from "../../app.config";

/**
 * The universal/app link host is build configuration (ADR-059). eas.json carries it per profile; this test keeps the file equal to the
 * service URL registry (workspace `_docs/registry`) when that checkout is present, and always checks the shape and the no-literal rule for code.
 */
const root = path.resolve(__dirname, "../..");
const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8")) as { build: Record<string, { env?: Record<string, string>; extends?: string }> };
const PROFILE_ENV: Record<string, string> = { preview: "test", pilot: "pilot", production: "prod" };
const registryDir = path.resolve(root, "../_docs/registry");
const hasRegistry = fs.existsSync(path.join(registryDir, "validate-registry.mjs")) && fs.existsSync(path.join(registryDir, "service-url-registry.yaml"));

describe("STAFF_LINK_HOST per EAS profile", () => {
  it("development profiles claim no host; preview, pilot and production each name theirs", () => {
    expect(eas.build.development!.env!.STAFF_LINK_HOST).toBeUndefined();
    for (const p of Object.keys(PROFILE_ENV)) {
      const host = eas.build[p]?.env?.STAFF_LINK_HOST;
      expect(host).toBeTruthy();
      expect(staffLinkHost({ STAFF_LINK_HOST: host! } as never)).toBe(host);
    }
  });
  it("no two environments share a link host (a test build must not claim production links)", () => {
    const hosts = Object.keys(PROFILE_ENV).map((p) => eas.build[p]!.env!.STAFF_LINK_HOST);
    expect(new Set(hosts).size).toBe(hosts.length);
  });
  (hasRegistry ? it : it.skip)("each profile host equals the registry host of kiorly.app for its environment", () => {
    // the validator is an ES module: run it in a child process (Jest here is CommonJS)
    const script = `import(${JSON.stringify(path.join(registryDir, "validate-registry.mjs"))}).then((m) => { const r = m.load(${JSON.stringify(path.join(registryDir, "service-url-registry.yaml"))}); console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(Object.values(PROFILE_ENV))}.map((e) => [e, m.hostOf(r, r.app_links.staff_app_host_service, e)])))); })`;
    const hosts = JSON.parse(execFileSync(process.execPath, ["-e", script], { encoding: "utf8" })) as Record<string, string>;
    for (const [profile, env] of Object.entries(PROFILE_ENV)) expect(eas.build[profile]!.env!.STAFF_LINK_HOST).toBe(hosts[env]);
  });
  it("runtime code contains no Kiorly host literal (app.config.ts, src/**, app/**)", () => {
    const re = /(?:https?:\/\/|["'`])((?:[a-z0-9-]+\.)*(?:kiorex\.com|kiorly\.com|kiorly\.link))\b/gi;
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (!["__tests__", "node_modules", "__mocks__"].includes(e.name)) walk(p); continue; }
        if (!/\.(ts|tsx|js)$/.test(e.name) || /\.test\./.test(e.name)) continue;
        fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
          for (const x of line.matchAll(re)) if (!x[1]!.toLowerCase().startsWith("schemas.")) bad.push(`${path.relative(root, p)}:${i + 1} ${x[1]}`);
        });
      }
    };
    for (const f of ["src", "app"]) if (fs.existsSync(path.join(root, f))) walk(path.join(root, f));
    expect(bad).toEqual([]);
    expect(fs.readFileSync(path.join(root, "app.config.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && l.match(re))).toEqual([]);
  });
});
