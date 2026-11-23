import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { CLIENT_HEADER } from "@/api/products";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const app = JSON.parse(read("app.json")).expo;

/** ADR-037 (23 Nov 2026): the staff app is plain "Kiorly". */
describe("app identity", () => {
  it("uses the final display name, scheme and bundle ids", () => {
    expect(app.name).toBe("Kiorly");
    expect(app.slug).toBe("kiorly");
    expect(app.scheme).toBe("kiorly");
    expect(app.ios.bundleIdentifier).toBe("com.kiorly.app");
    expect(app.android.package).toBe("com.kiorly.app");
  });
  it("never puts 'by Kiorex' or a product word in the icon label / store-facing app name", () => {
    expect(app.name).not.toMatch(/kiorex|team|clinic|pharmacy|lab/i);
    expect(JSON.parse(read("src/i18n/infoplist/en.json")).CFBundleDisplayName).toBe("Kiorly");
    expect(JSON.parse(read("src/i18n/infoplist/ar.json")).CFBundleDisplayName).toBe("كيورلي");
  });
  it("identifies itself to the backends as kiorly/<version>", () => {
    expect(CLIENT_HEADER).toMatch(/^kiorly\/\d+\.\d+\.\d+/);
  });
  it("ships the icon, adaptive icon, favicon and splash assets", () => {
    for (const f of [app.icon, app.android.adaptiveIcon.foregroundImage, app.web.favicon, "./assets/splash-icon.png", "./assets/splash-icon-dark.png"]) expect(statSync(join(root, f)).size).toBeGreaterThan(500);
    expect(app.android.adaptiveIcon.backgroundColor).toBe("#3730A3");
  });
  it("keeps every old identifier out of the shipped config and source (legacy names live only in docs and the backends' accept-lists)", () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const n of readdirSync(join(root, d))) { const p = `${d}/${n}`; if (statSync(join(root, p)).isDirectory()) walk(p); else if (/\.(tsx?|json)$/.test(n) && !p.includes("__tests__")) files.push(p); } };
    for (const d of ["src", "app"]) walk(d);
    files.push("app.json", "eas.json", "package.json");
    const bad = files.filter((f) => /Kiorly Team|كيورلي تيم|com\.kiorly\.team|kiorlyteam|kiorly-work/.test(read(f)));
    expect(bad).toEqual([]);
  });
  it("is packaged as @kiorly/app", () => { expect(JSON.parse(read("package.json")).name).toBe("@kiorly/app"); });
});
