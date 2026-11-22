import i18n from "@/i18n";
import { formatDuration, localizeDigits, MAX_DURATION_DAYS } from "@/lib/format";
import { humanizeEnum, statusLabel } from "@/lib/status";
import { countdownLabel } from "@/modules/lab/helpers";
import { slaLabel } from "@/modules/pharmacy/lib";

describe("digits and durations", () => {
  it("localizeDigits maps to Arabic-Indic only for Arabic", () => {
    expect(localizeDigits(2026, "ar")).toBe("٢٠٢٦"); expect(localizeDigits("3/5", "ar")).toBe("٣/٥"); expect(localizeDigits(2026, "en")).toBe("2026");
  });
  it("formats minutes, hours and days compactly", () => {
    expect(formatDuration(45, "en")).toBe("45m"); expect(formatDuration(125, "en")).toBe("2h 5m"); expect(formatDuration(120, "en")).toBe("2h");
    expect(formatDuration(1440 + 240, "en")).toBe("1d 4h"); expect(formatDuration(null, "en")).toBe("");
    expect(formatDuration(-15, "en")).toBe("-15m");
  });
  it("Arabic uses Arabic-Indic digits and Arabic unit letters", () => {
    expect(formatDuration(125, "ar")).toBe("٢س ٥د"); expect(formatDuration(45, "ar-EG")).toBe("٤٥د");
  });
  it("the 8738h 22m critical-alert countdown becomes days and is capped", () => {
    const m = 8738 * 60 + 22;
    expect(formatDuration(m, "en")).toBe("364d"); expect(formatDuration(m, "ar")).toBe("٣٦٤ي");
    expect(formatDuration((MAX_DURATION_DAYS + 5) * 1440, "en")).toBe("999d+");
    expect(countdownLabel(m, "ar")).toBe("٣٦٤ي"); expect(countdownLabel(90)).toBe("1h 30m"); expect(countdownLabel(-15)).toBe("-15m");
  });
  it("pharmacy SLA keeps its short form and localizes", () => {
    expect(slaLabel(150)).toBe("2h"); expect(slaLabel(150, "ar")).toBe("٢س"); expect(slaLabel(-5, "ar")).toBe("-٥د"); expect(slaLabel(null)).toBe("");
  });
  it("numbers interpolated into Arabic strings use Arabic-Indic digits, string params do not", async () => {
    await i18n.changeLanguage("ar");
    expect(i18n.t("pharmacy.rx.lines", { count: 3 })).toContain("٣");
    expect(i18n.t("inbox.ackedBy", { name: "Dr 12" })).toContain("Dr 12");
    await i18n.changeLanguage("en");
    expect(i18n.t("pharmacy.rx.lines", { count: 3 })).toContain("3");
  });
});

describe("statusLabel", () => {
  const t = i18n.t.bind(i18n) as never;
  it("translates raw enums in Arabic and English, never returns the shouty enum", async () => {
    await i18n.changeLanguage("ar"); expect(statusLabel(t, "RECEIVED", { scope: "pharmacy.rx" })).toBe("تم الاستلام");
    expect(statusLabel(t, "STAT", { kind: "priority" })).toBe("فوري");
    await i18n.changeLanguage("en"); expect(statusLabel(t, "RECEIVED", { scope: "pharmacy.rx" })).toBe("Received");
    expect(statusLabel(t, "PARTIALLY_DISPENSED")).toBe("Partly dispensed");
  });
  it("module-specific wording wins over the generic one", async () => {
    await i18n.changeLanguage("en"); expect(statusLabel(t, "COLLECTED", { scope: "lab" })).toBe("Collected");
    expect(statusLabel(t, "AWAITING_COLLECTION", { scope: "lab" })).toBe("To collect");
  });
  it("falls back to a humanised label for unknown values and tolerates empty input", () => {
    expect(statusLabel(t, "SOME_NEW_STATE")).toBe("Some new state"); expect(humanizeEnum("on-hold")).toBe("On hold");
    expect(statusLabel(t, undefined)).toBe(""); expect(statusLabel(t, null)).toBe("");
  });
});
