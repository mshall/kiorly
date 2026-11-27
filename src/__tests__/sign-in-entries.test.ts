import { SIGN_IN_ENTRIES, productOf } from "@/api/products";

describe("sign-in entries", () => {
  it("offers a Nurse front door next to the three products", () => {
    expect(SIGN_IN_ENTRIES).toEqual(["clinic", "nurse", "pharmacy", "lab"]);
  });
  it("signs nurses in through the clinic product", () => {
    expect(productOf("nurse")).toBe("clinic");
    expect(productOf("lab")).toBe("lab");
  });
});
