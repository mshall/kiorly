/** ADR-037: "by Kiorex" appears ONLY on the splash screen and in About (me tab), never in the icon label, store name, notifications or anywhere else in the app code. */
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === "__tests__" || e.name === "node_modules" || p.endsWith(path.join("src", "brand")) ? [] : walk(p);
  return /\.(tsx?|json)$/.test(e.name) ? [p] : [];
});
const rel = (p: string) => path.relative(root, p).split(path.sep).join("/");

describe("'by Kiorex' placement", () => {
  const files = [...walk(path.join(root, "src")), ...walk(path.join(root, "app"))];
  it("the i18n key app.by is read only by the splash and the About card", () => {
    const users = files.filter((f) => /\bt\(\s*["']app\.by["']/.test(fs.readFileSync(f, "utf8"))).map(rel).sort();
    expect(users).toEqual(["app/(tabs)/me.tsx", "src/components/AnimatedSplash.tsx"]);
  });
  it("no other source file or string embeds the phrase (notifications, titles, labels)", () => {
    const hits = files.filter((f) => /by kiorex|من كيوريكس/i.test(fs.readFileSync(f, "utf8"))).map(rel).filter((f) => !/^src\/i18n\/locales\/(en|ar)\.json$/.test(f) && f !== "src/components/AnimatedSplash.tsx" && f !== "src/components/Logo.tsx");
    expect(hits).toEqual([]);
    for (const l of ["en", "ar"]) {
      const lines = fs.readFileSync(path.join(root, `src/i18n/locales/${l}.json`), "utf8").split("\n").filter((x) => /by kiorex|من كيوريكس/i.test(x));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('"by"');
    }
  });
  it("the home-screen label and store name never carry it", () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
    expect(cfg.name).toBe("Kiorly");
    expect(JSON.stringify(cfg)).not.toMatch(/by kiorex/i);
    for (const l of ["ar", "en"]) expect(fs.readFileSync(path.join(root, `src/i18n/infoplist/${l}.json`), "utf8")).not.toMatch(/by kiorex|من كيوريكس/i);
  });
});
