import { execFileSync } from "node:child_process";
import path from "node:path";
import { DEMO_ACCOUNTS } from "@/dev/demoAccounts";

describe("DEV ONLY test users (staff sign-in)", () => {
  it("covers every product with only synthetic demo logins", () => {
    for (const p of ["clinic", "pharmacy", "lab"] as const) expect(DEMO_ACCOUNTS[p].length).toBeGreaterThanOrEqual(4);
    for (const d of DEMO_ACCOUNTS.clinic.concat(DEMO_ACCOUNTS.pharmacy)) { expect(d.email).toMatch(/@(demo\.kiorex\.test|nurse-demo\.kiorly\.test|demo\.kiorly\.local)$/); expect(d.password).toBe("Demo@12345"); }
    for (const d of DEMO_ACCOUNTS.lab) expect(d.email).toMatch(/@(demo|chain|basic)-lab\.test$/);
  });
  it("are absent from a production bundle (and present in a dev export)", () => {
    expect(() => execFileSync("node", [path.join(__dirname, "../../scripts/check-no-dev-test-users.mjs")], { stdio: "pipe" })).not.toThrow();
  }, 240_000);
});
