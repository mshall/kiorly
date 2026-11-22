import { canApproveLab, canSign, canStartVisit, diffForm, emptyVitals, identifiersOk, queueView, revenueSeries, revenueTrend, roundActions, roundCounts, roundStepIndex, safetyPrompt, tubeLabelOk, validateVitals, vitalsHints, waitMinutes } from "@/modules/clinic/helpers";
import type { Bootstrap } from "@/api/types";

const boot = (role: string, screens: Record<string, string[]>): Bootstrap => ({ apiVersion: 1, product: "clinic", serverTime: "", user: { id: "u", name: "n", email: "e", role, roles: [role] }, org: { id: "o", name: "o", plan: "PRO" }, entitlement: { key: "mobile_staff_app", enabled: true, requiredPlan: "PRO", reason: null }, safetyAlertsOnly: false, device: null, modules: Object.entries(screens).map(([key, s]) => ({ key, enabled: true, screens: s })) });

describe("queueView", () => {
  it("maps statuses and queue stages to display buckets", () => {
    expect(queueView("CONFIRMED").key).toBe("scheduled");
    expect(queueView("CHECKED_IN", "WAITING")).toEqual({ key: "waiting", tone: "warning" });
    expect(queueView("CHECKED_IN", "IN_EXAM").key).toBe("inExam");
    expect(queueView("COMPLETED").key).toBe("completed");
    expect(queueView("CANCELLED").key).toBe("cancelled");
    expect(queueView("NO_SHOW").tone).toBe("danger");
  });
  it("computes wait minutes", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    expect(waitMinutes("2026-11-20T09:35:00Z", now)).toBe(25);
    expect(waitMinutes(null, now)).toBeNull();
    expect(waitMinutes("2026-11-20T11:00:00Z", now)).toBe(0);
  });
});

describe("vitals validation", () => {
  it("accepts a normal set and builds the body", () => {
    const r = validateVitals({ ...emptyVitals(), systolic: "120", diastolic: "80", pulse: "72", temperatureC: "36,8", spo2: "98" });
    expect(r.ok).toBe(true);
    expect(r.body).toEqual({ systolic: 120, diastolic: 80, pulse: 72, temperatureC: 36.8, spo2: 98 });
  });
  it("rejects empty, out of range, non-numeric and unpaired BP", () => {
    expect(validateVitals(emptyVitals()).ok).toBe(false);
    expect(validateVitals({ ...emptyVitals(), spo2: "140" }).errors.spo2).toBe("range");
    expect(validateVitals({ ...emptyVitals(), pulse: "abc" }).errors.pulse).toBe("nan");
    expect(validateVitals({ ...emptyVitals(), systolic: "120" }).errors.diastolic).toBe("pair");
    expect(validateVitals({ ...emptyVitals(), systolic: "80", diastolic: "90" }).errors.diastolic).toBe("range");
  });
  it("gives advisory hints only", () => {
    expect(vitalsHints({ spo2: 88, systolic: 190, pulse: 70 })).toEqual(["spo2", "bp"]);
    expect(vitalsHints({ spo2: 98, systolic: 120 })).toEqual([]);
  });
});

describe("home-visit round state machine", () => {
  it("offers the right actions per state", () => {
    expect(roundActions("CONFIRMED")).toEqual(["depart"]);
    expect(roundActions("ON_MY_WAY")).toEqual(["arrive", "abort", "sos"]);
    expect(roundActions("ARRIVED")).toEqual(["finish", "abort", "sos"]);
    expect(roundActions("FINISHED")).toEqual([]);
    expect(roundActions("ABORTED_UNSAFE")).toEqual([]);
  });
  it("tracks steps and counts", () => {
    expect(roundStepIndex("ARRIVED")).toBe(2);
    expect(roundStepIndex("CANCELLED")).toBe(-1);
    expect(roundCounts([{ state: "FINISHED" }, { state: "ARRIVED" }, { state: "CONFIRMED" }])).toEqual({ total: 3, done: 1, active: 1 });
  });
  it("prompts for safety 30 minutes after the planned end (field-visit protocol)", () => {
    const end = Date.parse("2026-11-20T10:00:00Z");
    const v = { id: "v1", state: "ARRIVED", plannedEndsAt: new Date(end).toISOString() };
    expect(safetyPrompt(v, end + 10 * 60_000)).toBe("none");
    expect(safetyPrompt(v, end + 31 * 60_000)).toBe("prompt");
    expect(safetyPrompt({ ...v, state: "FINISHED" }, end + 60 * 60_000)).toBe("none");
  });
  it("needs two distinct identifiers and a valid tube label", () => {
    expect(identifiersOk([{ kind: "FULL_NAME", value: "A B" }])).toBe(false);
    expect(identifiersOk([{ kind: "FULL_NAME", value: "A B" }, { kind: "FULL_NAME", value: "A B" }])).toBe(false);
    expect(identifiersOk([{ kind: "FULL_NAME", value: "A B" }, { kind: "PHONE", value: "+2010" }])).toBe(true);
    expect(tubeLabelOk("TUBE-001")).toBe(true);
    expect(tubeLabelOk("a b")).toBe(false);
    expect(tubeLabelOk("ab")).toBe(false);
  });
});

describe("revenue mapping", () => {
  const snap = { currency: "EGP", today: { net: 0, gross: 0 }, last7: { net: 100, gross: 120 }, last30: { net: 500, gross: 600 }, completedVisitsToday: 0, daily: [{ date: "2026-11-18", net: 100, gross: 110 }, { date: "2026-11-19", net: 200, gross: 220 }, { date: "2026-11-20", net: 300, gross: 330 }] };
  it("builds chart series and a trend", () => {
    const s = revenueSeries(snap, "en");
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.value)).toEqual([100, 200, 300]);
    expect(revenueTrend(snap.daily)).toBe(100);
    expect(revenueTrend([{ net: 0 }, { net: 5 }])).toBeNull();
  });
});

describe("visit draft diff and role gates", () => {
  it("sends only changed fields, numbers as numbers", () => {
    const base = { chiefComplaint: "a", plan: "p", heartRate: "70" };
    expect(diffForm(base, { ...base, plan: "q", heartRate: "75" })).toEqual({ plan: "q", heartRate: 75 });
    expect(diffForm(base, { ...base, heartRate: "" })).toEqual({});
  });
  it("derives permissions from the bootstrap screens, not the role name", () => {
    const doctor = boot("PHYSICIAN", { "clinic.visits": ["start", "notes"], "clinic.prescriptions": ["review", "sign"], "clinic.labs": ["results", "approve"] });
    const nurse = boot("NURSE", { "clinic.visits": [], "clinic.prescriptions": ["review"] });
    expect([canStartVisit(doctor), canSign(doctor), canApproveLab(doctor)]).toEqual([true, true, true]);
    expect([canStartVisit(nurse), canSign(nurse), canApproveLab(nurse)]).toEqual([false, false, false]);
    expect(canSign(undefined)).toBe(false);
  });
});
