import { MAX_SLOTS, needsEvidence, parseEvidence, recentMonths, slotLabel, statementSummary, toggleSlot, verificationReady, codeOf, isNetwork, type StatementDto } from "@/modules/clinic/growth-marketing";
import { ApiError } from "@/api/errors";

describe("GRW-P2-C staff app helpers", () => {
  it("toggleSlot adds, removes, caps at 5 and keeps order", () => {
    let c: string[] = [];
    for (const i of ["a", "b", "c", "d", "e", "f"]) c = toggleSlot(c, i);
    expect(c).toEqual(["a", "b", "c", "d", "e"]);
    expect(MAX_SLOTS).toBe(5);
    expect(toggleSlot(c, "c")).toEqual(["a", "b", "d", "e"]);
  });
  it("labels follow the language", () => {
    const s = { startsAt: "x", endsAt: "y", labelEn: "Tue 24 Nov, 10:00", labelAr: "الثلاثاء ٢٤ نوفمبر" };
    expect(slotLabel(s, "ar")).toBe(s.labelAr);
    expect(slotLabel(s, "en")).toBe(s.labelEn);
  });
  it("evidence references: trimmed, de-duplicated, odd values rejected, capped at 10", () => {
    expect(parseEvidence(" a/b.pdf \n\nx_1\na/b.pdf")).toEqual({ refs: ["a/b.pdf", "x_1"], invalid: [] });
    expect(parseEvidence("../x").invalid).toEqual(["../x"]);
    expect(parseEvidence("javascript:alert(1)").invalid).toHaveLength(1);
    expect(parseEvidence(Array.from({ length: 12 }, (_, i) => `f${i}`).join("\n")).refs).toHaveLength(10);
  });
  it("a photo or document request needs evidence; a value is always required", () => {
    expect(needsEvidence("PHOTO") && needsEvidence("DOCUMENT") && !needsEvidence("ADDRESS")).toBe(true);
    expect(verificationReady("ADDRESS", "5 Nile St", "")).toBe(true);
    expect(verificationReady("ADDRESS", "  ", "")).toBe(false);
    expect(verificationReady("PHOTO", "new", "")).toBe(false);
    expect(verificationReady("PHOTO", "new", "uploads/p.png")).toBe(true);
    expect(verificationReady("ADDRESS", "x", "../bad")).toBe(false);
  });
  it("months are newest first and cross the year", () => {
    expect(recentMonths(3, new Date("2027-01-15T00:00:00Z"))).toEqual(["2027-01", "2026-12", "2026-11"]);
  });
  it("the statement summary has totals only", () => {
    const s: StatementDto = { webUrl: "u", month: "2026-11", zone: "Africa/Cairo", currency: "EGP", lines: [], totals: { active: "120.00", activeCount: 3, reversed: "0.00", waived: "0.00", providerLed: 7 } };
    expect(statementSummary(s, "M {{month}} {{active}} {{currency}} {{providerLed}}")).toBe("M 2026-11 120.00 EGP 7");
  });
  it("error helpers read ApiError safely", () => {
    expect(codeOf(new ApiError(409, "SLOT_NO_LONGER_AVAILABLE", "x"))).toBe("SLOT_NO_LONGER_AVAILABLE");
    expect(isNetwork(new ApiError(0, "NETWORK", "x"))).toBe(true);
    expect(codeOf(null)).toBeNull();
  });
});
