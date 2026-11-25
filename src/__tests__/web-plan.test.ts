import { webPlanUrl } from "@/lite/webPlan";

describe("manage the plan on the web (no in-app purchase)", () => {
  it("builds the web plan link from the configured origin only", () => {
    expect(webPlanUrl("clinic", { EXPO_PUBLIC_WEB_URL_CLINIC: "https://app.example.test/" })).toBe("https://app.example.test/plan");
    expect(webPlanUrl("lab", { EXPO_PUBLIC_WEB_URL_LAB: "https://lab.example.test" })).toBe("https://lab.example.test/plan");
  });
  it("no origin, or a non-https origin: no link (the note still says manage on the web)", () => {
    expect(webPlanUrl("pharmacy", {})).toBeNull();
    expect(webPlanUrl("pharmacy", { EXPO_PUBLIC_WEB_URL_PHARMACY: "http://insecure.test" })).toBeNull();
  });
});
