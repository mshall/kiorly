import { SNOOZE_MS, shouldShowPrimer } from "@/lib/pushPermission";

const now = Date.UTC(2026, 10, 21);
describe("notification primer rule", () => {
  it("asks once when the OS has never been asked", () => {
    expect(shouldShowPrimer("undetermined", {}, now)).toBe(true);
  });
  it("never asks when already granted, denied, unsupported, or decided", () => {
    for (const s of ["granted", "denied", "unsupported"] as const) expect(shouldShowPrimer(s, {}, now)).toBe(false);
    expect(shouldShowPrimer("undetermined", { decided: "denied" }, now)).toBe(false);
    expect(shouldShowPrimer("undetermined", { decided: "granted" }, now)).toBe(false);
  });
  it("'Not now' is remembered for 14 days", () => {
    expect(SNOOZE_MS).toBe(14 * 24 * 3_600_000);
    expect(shouldShowPrimer("undetermined", { snoozedAt: now - 3_600_000 }, now)).toBe(false);
    expect(shouldShowPrimer("undetermined", { snoozedAt: now - SNOOZE_MS + 1000 }, now)).toBe(false);
    expect(shouldShowPrimer("undetermined", { snoozedAt: now - SNOOZE_MS }, now)).toBe(true);
  });
});
