import { money } from "@/modules/pharmacy/lib";
import { formatMoney } from "@/lib/format";

describe("pharmacy money keeps piasters", () => {
  it("unit prices and cash variances are not rounded to whole pounds", () => {
    expect(money("42.50", "en")).toContain("42.50");
    expect(money("-15.00", "en")).toContain("15.00");
    expect(money("0.50", "en")).toContain("0.50");
    expect(money(null, "en")).toBe("-");
  });
  it("other modules still use whole-pound dashboards by default", () => { expect(formatMoney(1234.56, "en")).toContain("1,235"); expect(formatMoney(1234.56, "en")).not.toContain("."); });
});
