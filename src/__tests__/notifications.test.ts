import { makeTapDeduper, routeForNotification, TEST_NOTIFICATIONS } from "@/lib/notifications";

describe("notification routing (remote and local share it)", () => {
  it("critical lab alert -> critical values screen", () => { expect(routeForNotification(TEST_NOTIFICATIONS[0].data)).toBe("/lab/critical"); });
  it("SOS with a home visit -> the round; SOS without ids -> inbox", () => {
    expect(routeForNotification(TEST_NOTIFICATIONS[1].data)).toBe("/clinic/round/demo_hv_cp1_7");
    expect(routeForNotification({ template: "sos", kind: "SAFETY" })).toBe("/(tabs)/inbox");
  });
  it("pharmacy order.received -> orders", () => { expect(routeForNotification(TEST_NOTIFICATIONS[2].data)).toBe("/pharmacy/orders"); });
  it("upgrade request -> upgrade screen for that product", () => {
    expect(routeForNotification(TEST_NOTIFICATIONS[3].data)).toBe("/upgrade?product=clinic");
    expect(routeForNotification({ template: "upgrade.request", requestId: "r", featureKey: "f" }, "pharmacy")).toBe("/upgrade?product=pharmacy");
  });
  it("uses the fallback product when the payload has none, and ignores unknown/empty data", () => {
    expect(routeForNotification({ rxId: "r1" }, "pharmacy")).toBe("/pharmacy/rx/r1");
    expect(routeForNotification({ foo: 1 }, "clinic")).toBeNull(); expect(routeForNotification(undefined)).toBeNull(); expect(routeForNotification({ product: "evil" })).toBeNull();
  });
  it("dedupes the same tap reported by the cold-start check and the listener", () => {
    const fresh = makeTapDeduper();
    expect(fresh("a")).toBe(true); expect(fresh("a")).toBe(false); expect(fresh("b")).toBe(true); expect(fresh(null)).toBe(false);
  });
});
