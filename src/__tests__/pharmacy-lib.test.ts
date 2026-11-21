import { bucketExpiry, bucketOf, canOverride, countStats, fefo, hasScreen, lineRemaining, matchPoLine, parseGs1, poProgress, setCounted, slaLabel, slaMinutes, slaTone, summarizeChecks, validReason, variance, type SafetyCheck } from "@/modules/pharmacy/lib";
import { pharmacyStrings } from "@/i18n/modules/pharmacy";
import fs from "node:fs";
import path from "node:path";

describe("GS1 parse", () => {
  it("reads human readable AIs", () => {
    expect(parseGs1("(01)62200000010077(17)271231(10)LOTX1")).toEqual({ plain: "(01)62200000010077(17)271231(10)LOTX1", gtin: "62200000010077", expiry: "2027-12-31", lot: "LOTX1" });
  });
  it("reads raw element strings and plain GTINs", () => {
    expect(parseGs1("016220000001007717271231" + "10AB12")).toMatchObject({ gtin: "62200000010077", expiry: "2027-12-31", lot: "AB12" });
    expect(parseGs1("6221000000012")).toEqual({ plain: "6221000000012" });
  });
  it("treats day 00 as end of month approximation", () => { expect(parseGs1("(01)62200000010077(17)270200").expiry).toBe("2027-02-28"); });
});

describe("expiry + FEFO", () => {
  it("buckets by days", () => {
    expect(["-1", "0", "30", "31", "60", "61", "90", "91"].map((d) => bucketOf(Number(d)))).toEqual(["expired", "d30", "d30", "d60", "d60", "d90", "d90", "later"]);
    const b = bucketExpiry([{ lotId: "a", daysToExpiry: -3, qtyOnHand: 5 }, { lotId: "b", daysToExpiry: 10, qtyOnHand: 7 }, { lotId: "c", daysToExpiry: 12, qtyOnHand: 1 }]);
    expect(b.expired).toEqual({ lots: 1, units: 5 }); expect(b.d30).toEqual({ lots: 2, units: 8 });
  });
  it("sorts first-expiring-first", () => { expect(fefo([{ expiryDate: "2028-01-01" }, { expiryDate: "2026-05-01" }]).map((l) => l.expiryDate)).toEqual(["2026-05-01", "2028-01-01"]); });
});

describe("PO receiving", () => {
  const po = { lines: [{ id: "l1", drugId: "d1", qtyOrdered: 10, qtyReceived: 4 }, { id: "l2", drugId: "d2", qtyOrdered: 5, qtyReceived: 0 }] };
  it("matches by drug", () => { expect(matchPoLine(po, "d2")?.id).toBe("l2"); expect(matchPoLine(po, "zz")).toBeNull(); expect(matchPoLine(po, undefined)).toBeNull(); });
  it("computes progress incl. scanned and clamps to ordered", () => {
    expect(poProgress(po)).toEqual({ ordered: 15, done: 4, pct: 27 });
    expect(poProgress(po, { l1: 99 }).done).toBe(10);
    expect(lineRemaining(po.lines[0], 3)).toBe(3);
  });
});

describe("safety checks", () => {
  const c = (outcome: SafetyCheck["outcome"], overridable = true): SafetyCheck => ({ id: outcome + overridable, kind: "ALLERGY", outcome, overridable });
  it("summarises and gates sign-off", () => {
    const s = summarizeChecks([c("PASS"), c("WARN"), c("BLOCK", false), c("OVERRIDDEN_BY_PHARMACIST")]);
    expect(s).toMatchObject({ pass: 1, warn: 1, block: 1, overridden: 1, canSignOff: false });
    expect(s.locked).toHaveLength(1);
    expect(summarizeChecks([c("PASS"), c("OVERRIDDEN_BY_PHARMACIST")]).canSignOff).toBe(true);
  });
  it("a non-overridable WARN (unverified prescriber) does not block sign-off, an overridable WARN still does", () => {
    expect(summarizeChecks([c("PASS"), c("WARN", false)]).canSignOff).toBe(true);
    expect(summarizeChecks([c("PASS"), c("WARN", true)]).canSignOff).toBe(false);
    expect(summarizeChecks([c("WARN", false), c("BLOCK", true)]).canSignOff).toBe(false);
  });
  it("override rules", () => {
    expect(canOverride(c("WARN"), true)).toBe(true);
    expect(canOverride(c("WARN"), false)).toBe(false);
    expect(canOverride(c("BLOCK", false), true)).toBe(false);
    expect(canOverride(c("PASS"), true)).toBe(false);
    expect(validReason("abcd")).toBe(false); expect(validReason("  clinic ok ")).toBe(true);
  });
  it("reads override screen from bootstrap", () => {
    const b = { modules: [{ key: "pharmacy.rx", enabled: true, screens: ["rx.queue", "rx.override"] }] } as never;
    expect(hasScreen(b, "pharmacy.rx", "rx.override")).toBe(true); expect(hasScreen(b, "pharmacy.rx", "x")).toBe(false);
  });
});

describe("stock count math", () => {
  const lines = [{ lotId: "a", qtyExpected: 12, qtyCounted: null }, { lotId: "b", qtyExpected: 2, qtyCounted: 2 }];
  it("increments, clamps at zero, computes variance", () => {
    let l = setCounted(lines, "a", 1); expect(l[0].qtyCounted).toBe(1);
    l = setCounted(l, "a", -5); expect(l[0].qtyCounted).toBe(0);
    l = setCounted(l, "a", 11, true); expect(variance(l[0])).toBe(-1);
    expect(countStats(l)).toEqual({ total: 2, counted: 2, variances: 1, netUnits: -1, pct: 100 });
    expect(countStats(lines)).toMatchObject({ counted: 1, variances: 0, pct: 50 });
  });
});

describe("Kiorex order SLA", () => {
  it("labels and tones", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    expect(slaMinutes("2026-11-20T10:30:00Z", now)).toBe(30);
    expect(slaLabel(-5)).toBe("-5m"); expect(slaLabel(150)).toBe("2h"); expect(slaTone(-1)).toBe("danger"); expect(slaTone(10)).toBe("warning"); expect(slaTone(40)).toBe("success"); expect(slaTone(null)).toBe("muted");
  });
});

describe("strings", () => {
  const flat = (o: unknown, p = ""): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : [p]);
  it("AR and EN have the same keys", () => { expect(flat(pharmacyStrings.ar).sort()).toEqual(flat(pharmacyStrings.en).sort()); });
  it("every static t('pharmacy.…') key used by the module exists", () => {
    const keys = new Set(flat(pharmacyStrings.en));
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && files.push(path.join(d, e.name))));
    walk(path.join(root, "app/pharmacy")); walk(path.join(root, "src/modules/pharmacy"));
    const missing: string[] = [];
    for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\("pharmacy\.([A-Za-z0-9.]+)"/g)) if (!keys.has(`pharmacy.${m[1]}`)) missing.push(m[1]);
    expect(missing).toEqual([]);
  });
});
