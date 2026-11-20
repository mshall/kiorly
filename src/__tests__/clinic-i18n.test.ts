import fs from "fs";
import path from "path";
import { clinicStrings } from "@/i18n/modules/clinic";
import { resources } from "@/i18n";

const flat = (o: unknown, p = ""): string[] => (o && typeof o === "object" ? Object.entries(o as object).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : [p]);
const get = (o: unknown, key: string) => key.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

describe("clinic strings", () => {
  it("has the same keys in Arabic and English and no empty values", () => {
    expect(flat(clinicStrings.ar).sort()).toEqual(flat(clinicStrings.en).sort());
    for (const k of flat(clinicStrings.ar)) expect(String(get(clinicStrings.ar, k)).length).toBeGreaterThan(0);
  });
  it("defines every static key the screens use", () => {
    const root = path.resolve(__dirname, "../..");
    const files = [...walk(path.join(root, "app/clinic")), ...walk(path.join(root, "src/modules/clinic"))].filter((f) => /\.tsx?$/.test(f));
    const used = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\(\s*["'`](clinic\.[A-Za-z0-9_.]+)["'`]/g)) used.add(m[1]);
    expect(used.size).toBeGreaterThan(80);
    const missing = [...used].filter((k) => get(resources.en.translation, k) === undefined || get(resources.ar.translation, k) === undefined);
    expect(missing).toEqual([]);
  });
});
