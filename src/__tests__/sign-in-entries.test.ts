import { DEMO_ACCOUNTS, SIGN_IN_ENTRIES, productOf } from "@/api/products";

describe("sign-in entries", () => {
  it("offers a Nurse front door next to the three products", () => {
    expect(SIGN_IN_ENTRIES).toEqual(["clinic", "nurse", "pharmacy", "lab"]);
  });
  it("signs nurses in through the clinic product", () => {
    expect(productOf("nurse")).toBe("clinic");
    expect(productOf("lab")).toBe("lab");
  });
  it("has nurse demo accounts (solo, agency nurse, aide, dispatcher, owner) on the clinic backend", () => {
    const nurses = DEMO_ACCOUNTS.clinic.filter((d) => d.nurse).map((d) => d.email);
    expect(nurses).toEqual(expect.arrayContaining([
      "mona@nurse-demo.kiorly.test", "nurse1@nurse-demo.kiorly.test", "aide@nurse-demo.kiorly.test",
      "dispatch@nurse-demo.kiorly.test", "owner@nurse-demo.kiorly.test", "nurse.na@demo.kiorex.test",
    ]));
  });
});
