import { ApiError } from "@/api/errors";
import { countdownLabel, flagTone, isCriticalKind, isQueueable, labErrorKey, minutesLeft, needsDeltaAck, rangeText, resultValue, sectionPercent, sectionTone, tatTone, usableActions } from "@/modules/lab/helpers";

describe("lab helpers", () => {
  it("offers only allowed, known next actions", () => {
    const a = usableActions([{ action: "collect", to: "COLLECTED", requiresScan: true, allowed: true }, { action: "reject", to: "REJECTED", requiresScan: false, allowed: false }, { action: "weird", to: "X", requiresScan: false, allowed: true }]);
    expect(a.map((x) => x.action)).toEqual(["collect"]);
  });
  it("only collect is queueable offline", () => {
    expect(isQueueable("collect")).toBe(true);
    for (const a of ["receive", "process", "reject", "transport"]) expect(isQueueable(a)).toBe(false);
  });
  it("maps TAT status to tone", () => {
    expect(tatTone("BREACHED")).toBe("danger"); expect(tatTone("AT_RISK")).toBe("warning"); expect(tatTone("OK")).toBe("success"); expect(tatTone("NO_TARGET")).toBe("muted");
  });
  it("computes critical countdown", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    expect(minutesLeft("2026-11-20T11:30:00Z", now)).toBe(90);
    expect(countdownLabel(90)).toBe("1h 30m");
    expect(minutesLeft("2026-11-20T09:45:00Z", now)).toBe(-15);
    expect(countdownLabel(-15)).toBe("-15m");
    expect(minutesLeft(null)).toBeNull();
  });
  it("section progress counts released + validated", () => {
    expect(sectionPercent({ total: 10, released: 3, validated: 2 })).toBe(50);
    expect(sectionPercent({ total: 0, released: 0, validated: 0 })).toBe(0);
    expect(sectionTone(80)).toBe("success"); expect(sectionTone(40)).toBe("ocean"); expect(sectionTone(5)).toBe("warning");
  });
  it("delta check needs acknowledgement", () => {
    expect(needsDeltaAck({ deltaCheckFailed: true })).toBe(true); expect(needsDeltaAck({ deltaCheckFailed: false })).toBe(false);
  });
  it("formats results and ranges", () => {
    expect(rangeText({ refLow: 12, refHigh: 15.5 })).toBe("12 - 15.5"); expect(rangeText({ refLow: null, refHigh: 5 })).toBe("<= 5");
    expect(resultValue({ valueNumeric: 13.4, valueText: null, unit: "g/dL" })).toBe("13.4 g/dL");
    expect(flagTone("CRITICAL_HIGH")).toBe("danger"); expect(flagTone("HIGH")).toBe("warning"); expect(flagTone("NORMAL")).toBe("success");
  });
  it("classifies critical alert kinds", () => { expect(isCriticalKind("CRITICAL_VALUE")).toBe(true); expect(isCriticalKind("QC_FAILURE")).toBe(false); });
  it("maps errors to friendly keys", () => {
    expect(labErrorKey(new ApiError(0, "NETWORK", "x"))).toBe("lab.err.network");
    expect(labErrorKey(new ApiError(403, "FORBIDDEN", "x"))).toBe("common.notAllowed");
    expect(labErrorKey(new ApiError(409, "DELTA_CHECK_ACK_REQUIRED", "x"))).toBe("lab.err.delta");
    expect(labErrorKey(new ApiError(409, "DUAL_CONTROL_REQUIRED", "x"))).toBe("lab.err.dual");
    expect(labErrorKey(new ApiError(400, "LABEL_MISMATCH", "barcode does not match"))).toBe("lab.err.labelMismatch");
    expect(labErrorKey(new Error("x"))).toBe("lab.err.generic");
  });
});
