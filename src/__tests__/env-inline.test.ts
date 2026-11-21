import { readFileSync } from "fs";
import { join } from "path";

/** Metro only inlines literal `process.env.EXPO_PUBLIC_X` reads; an alias (`const env = process.env`) made every web/production build ignore the API URLs. */
describe("EXPO_PUBLIC_* API urls are inlinable", () => {
  const src = readFileSync(join(__dirname, "..", "api", "products.ts"), "utf8");
  it.each(["EXPO_PUBLIC_CLINIC_API", "EXPO_PUBLIC_PHARMACY_API", "EXPO_PUBLIC_LAB_API"])("%s is read as a literal process.env member", (k) => {
    expect(src).toContain(`process.env.${k}`);
  });
  it("does not alias process.env", () => { const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(code).not.toMatch(/=\s*\(?process\.env\b(?!\.)/); });
});
