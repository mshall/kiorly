import { ApiError } from "@/api/errors";
import { currentResult, defaultInstrument, entryBody, entryErrorKey, isCritical, mayConfirm, mayEnter, mayOpenEntry, needsSecondEntry, normalizeNumber, parseNumber, secondBody, specimenProgress, type EntryAnalyte, type EntryItem } from "@/modules/lab/entry";

const num: EntryAnalyte = { id: "a1", code: "K", nameEn: "Potassium", unit: "mmol/L", valueType: "NUMERIC" };
const choice: EntryAnalyte = { id: "a2", code: "HCV", nameEn: "HCV", valueType: "CHOICE", allowedValues: ["Reactive", "Non-reactive"] };
const ctx = { orderItemId: "i1", instrumentId: "ins1" };

describe("lab result entry: pure rules", () => {
  it("normalises Arabic-Indic and Persian digits and decimal separators, refuses everything else", () => {
    expect(normalizeNumber("٣٫٥")).toBe("3.5");
    expect(normalizeNumber("۱۲,۵")).toBe("12.5");
    expect(parseNumber("4.2")).toBe(4.2);
    expect(parseNumber(" -0.5 ")).toBe(-0.5);
    expect(parseNumber(".5")).toBe(0.5);
    for (const bad of ["", "abc", "1.2.3", "1e5", "NaN", "Infinity", "--1", "1 2"]) expect(parseNumber(bad)).toBeNull();
  });
  it("numeric body carries a number, no text; blank or invalid input is not enterable; no instrument means no body", () => {
    expect(entryBody(num, "4.2", ctx)).toEqual({ orderItemId: "i1", analyteId: "a1", instrumentId: "ins1", value: 4.2 });
    expect(entryBody(num, "", ctx)).toBeNull();
    expect(entryBody(num, "x", ctx)).toBeNull();
    expect(entryBody(num, "4.2", { ...ctx, instrumentId: "" })).toBeNull();
  });
  it("choice analytes accept only the allowed answers, sent as text", () => {
    expect(entryBody(choice, "Reactive", ctx)).toEqual({ orderItemId: "i1", analyteId: "a2", instrumentId: "ins1", valueText: "Reactive" });
    expect(entryBody(choice, "Maybe", ctx)).toBeNull();
    expect(entryBody({ ...num, valueType: "TEXT" }, "  pale yellow ", ctx)?.valueText).toBe("pale yellow");
  });
  it("second entry body mirrors the value type", () => {
    expect(secondBody(num, "4.2")).toEqual({ value: 4.2 });
    expect(secondBody(num, "")).toBeNull();
    expect(secondBody(choice, "Reactive")).toEqual({ valueText: "Reactive" });
  });
  it("permissions: entry and confirmation are separate; either opens the screen", () => {
    const has = (...p: string[]) => (x: string) => p.includes(x);
    expect(mayEnter(has("results.enter"))).toBe(true); expect(mayConfirm(has("results.enter"))).toBe(false);
    expect(mayOpenEntry(has("results.second_entry"))).toBe(true); expect(mayOpenEntry(has("results.read"))).toBe(false);
  });
  it("a manual first entry waits for a second person; analyzer and confirmed results do not", () => {
    const base = { id: "r", analyteId: "a1", status: "ENTERED", flag: "NORMAL", valueNumeric: 1, valueText: null, secondEntryBy: null, source: "MANUAL" };
    expect(needsSecondEntry(base)).toBe(true);
    expect(needsSecondEntry({ ...base, secondEntryBy: "u2" })).toBe(false);
    expect(needsSecondEntry({ ...base, source: "ANALYZER_HL7" })).toBe(false);
    expect(needsSecondEntry({ ...base, status: "TECH_VALIDATED" })).toBe(false);
    expect(needsSecondEntry(undefined)).toBe(false);
  });
  it("critical flags are recognised in both directions", () => { expect(isCritical("CRITICAL_HIGH")).toBe(true); expect(isCritical("CRITICAL_LOW")).toBe(true); expect(isCritical("HIGH")).toBe(false); expect(isCritical(undefined)).toBe(false); });
  it("preselects an instrument only when the choice is unambiguous", () => {
    expect(defaultInstrument(undefined)).toBeNull();
    expect(defaultInstrument([{ id: "a", name: "A", kind: "ANALYZER", active: true }])).toBe("a");
    expect(defaultInstrument([{ id: "a", name: "A", kind: "ANALYZER", active: true }, { id: "b", name: "B", kind: "MANUAL_BENCH", active: true }])).toBe("b");
    expect(defaultInstrument([{ id: "a", name: "A", kind: "MANUAL_BENCH", active: true }, { id: "b", name: "B", kind: "MANUAL_BENCH", active: true }])).toBeNull();
    expect(defaultInstrument([{ id: "a", name: "A", kind: "MANUAL_BENCH", active: false }])).toBeNull();
  });
  it("progress counts only enterable (not calculated) analytes", () => {
    const item: EntryItem = { id: "i1", status: "X", test: { code: "T", nameEn: "T", section: "CHEMISTRY" }, analytes: [num, choice, { ...num, id: "a3", calculated: true }], results: [{ id: "r", analyteId: "a1", status: "ENTERED", flag: "NORMAL", valueNumeric: 4, valueText: null, secondEntryBy: null, source: "MANUAL" }] };
    expect(specimenProgress({ id: "s", accessionNumber: "A", specimenType: "Serum", status: "PROCESSING", items: [item] })).toEqual({ total: 2, done: 1 });
    expect(currentResult(item, "a1")?.id).toBe("r"); expect(currentResult(item, "a2")).toBeUndefined();
  });
  it("maps server codes to friendly keys, with network, session, role, MFA and 5xx handled", () => {
    expect(entryErrorKey(new ApiError(409, "RESULT_EXISTS", "x"))).toBe("lab.entry.err.exists");
    expect(entryErrorKey(new ApiError(422, "DUAL_ENTRY_MISMATCH", "x"))).toBe("lab.entry.err.mismatch");
    expect(entryErrorKey(new ApiError(403, "DUAL_CONTROL_SAME_USER", "x"))).toBe("lab.entry.err.sameUser");
    expect(entryErrorKey(new ApiError(409, "SPECIMEN_NOT_PROCESSABLE", "x"))).toBe("lab.entry.err.processFirst");
    expect(entryErrorKey(new ApiError(0, "NETWORK", "x"))).toBe("lab.err.network");
    expect(entryErrorKey(new ApiError(403, "FORBIDDEN", "x"))).toBe("common.notAllowed");
    expect(entryErrorKey(new ApiError(403, "MFA_REQUIRED", "x"))).toBe("states.mfaBody");
    expect(entryErrorKey(new ApiError(401, "UNAUTHORIZED", "x"))).toBe("lab.entry.err.session");
    expect(entryErrorKey(new ApiError(503, "UNAVAILABLE", "x"))).toBe("lab.entry.err.server");
    expect(entryErrorKey(new Error("boom"))).toBe("lab.err.generic");
  });
});
