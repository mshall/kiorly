import fs from "fs";
import path from "path";
import { resources } from "@/i18n";
import { TILES } from "@/modules/registry";

const flat = (o: unknown, p = ""): string[] => (o && typeof o === "object" ? Object.entries(o as object).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : [p]);
const get = (o: unknown, key: string) => key.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);
const en = resources.en.translation, ar = resources.ar.translation;

describe("Lite strings", () => {
  it("has identical keys in Arabic and English, none empty", () => {
    expect(flat(get(ar, "lite")).sort()).toEqual(flat(get(en, "lite")).sort());
    for (const root of [get(en, "lite"), get(ar, "lite")]) for (const k of flat(root)) expect(String(get(root, k)).trim().length).toBeGreaterThan(0);
  });
  it("every registry tile has a default benefit line in both languages, and every role override has a default", () => {
    for (const t of TILES) {
      expect(typeof get(en, `lite.benefit.${t.key}.default`)).toBe("string");
      expect(typeof get(ar, `lite.benefit.${t.key}.default`)).toBe("string");
      expect(Object.keys(get(en, `lite.benefit.${t.key}`) as object).sort()).toEqual(Object.keys(get(ar, `lite.benefit.${t.key}`) as object).sort());
    }
  });
  it("benefit role overrides only use known role groups", () => {
    const groups = Object.keys(get(en, "lite.roles") as object);
    for (const t of TILES) for (const g of Object.keys(get(en, `lite.benefit.${t.key}`) as object)) expect(["default", ...groups]).toContain(g);
  });
  it("defines every static lite.* key the Lite screens use", () => {
    const root = path.resolve(__dirname, "../..");
    const files = ["src/components/lite.tsx", "app/upgrade.tsx", "app/(tabs)/work.tsx", "app/(tabs)/index.tsx", "app/(tabs)/me.tsx", "app/(tabs)/inbox.tsx"].map((f) => path.join(root, f));
    const used = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\(\s*["'`](lite\.[A-Za-z0-9_.]+)["'`]/g)) used.add(m[1]);
    expect(used.size).toBeGreaterThan(15);
    expect([...used].filter((k) => get(en, k) === undefined || get(ar, k) === undefined)).toEqual([]);
  });
  it("requester role labels exist for every role group in both languages", () => {
    for (const g of Object.keys(get(en, "lite.roles") as object)) {
      expect(typeof get(en, `lite.req.role.${g}`)).toBe("string");
      expect(typeof get(ar, `lite.req.role.${g}`)).toBe("string");
    }
  });
});
