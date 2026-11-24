import { redirectSystemPath } from "../../app/+native-intent";
import { HOME, OPEN_ROUTE_KEYS, configuredHosts, resolveStaffLink } from "@/lib/deepLink";
import { peekPendingRoute, setPendingRoute, takePendingRoute } from "@/lib/pendingRoute";
import { STAFF_ANDROID_PATH_PREFIXES, staffAssociatedDomains, staffIntentFilters, staffLinkHost } from "../../app.config";

const r = (u: unknown) => resolveStaffLink(u, { hosts: ["www.kiorly.com"] });
beforeEach(() => setPendingRoute(null));

describe("staff app deep links (GRW-P1-H)", () => {
  it("the existing /signin/* and /open/* association paths still resolve", () => {
    expect(r("https://www.kiorly.com/signin")).toMatchObject({ kind: "signin", route: "/sign-in" });
    expect(r("https://www.kiorly.com/signin/callback?code=abc&state=xyz")).toMatchObject({ kind: "signin", route: "/sign-in" }); // the code is never read
    expect(r("https://www.kiorly.com/open/visit:apt_123")).toEqual({ kind: "open", route: "/clinic/visit/apt_123", requiresSignIn: true });
    expect(r("https://www.kiorly.com/open/patient:P-42").route).toBe("/clinic/patient/P-42");
    expect(r("https://www.kiorly.com/open/rx:rx_9").route).toBe("/pharmacy/rx/rx_9");
    expect(r("https://www.kiorly.com/open/growth:me")).toMatchObject({ kind: "open", route: "/clinic/growth", requiresSignIn: true }); // GRW-P1-L
    expect(r("https://www.kiorly.com/open/round:r1").route).toBe("/clinic/round/r1");
    expect(r("kiorly://open/visit:apt_123").route).toBe("/clinic/visit/apt_123");
  });
  it("the Passport redirect keeps working (scheme only, OIDC parameters only)", () => {
    expect(r("kiorly://auth/callback?code=a1&state=s1&to=https%3A%2F%2Fevil.example&token=zzz")).toMatchObject({ kind: "auth", route: "/auth/callback?code=a1&state=s1" });
    expect(r("kiorly://auth/logout").route).toBe("/auth/logout");
    expect(r("https://www.kiorly.com/auth/callback?code=a&state=b").kind).toBe("home");
  });
  it("route keys are a closed list of key:id pairs, never URLs", () => {
    expect(Object.keys(OPEN_ROUTE_KEYS).sort()).toEqual(["growth", "patient", "round", "rx", "visit"]);
    for (const u of [
      "https://www.kiorly.com/open/https:evil.example", "https://www.kiorly.com/open/visit:https%3A%2F%2Fevil.example", "https://www.kiorly.com/open/visit:..%2F..%2Fx", "https://www.kiorly.com/open/visit:a/b",
      "https://www.kiorly.com/open/unknown:abc", "https://www.kiorly.com/open/visit", "https://www.kiorly.com/open/visit:", "https://www.kiorly.com/open/visit:%252e%252e", "https://www.kiorly.com/open/visit:" + "a".repeat(70),
      "https://www.kiorly.com/open/visit:a%00b", "https://www.kiorly.com/open/visit:<script>", "https://www.kiorly.com/open/__proto__:x", "https://www.kiorly.com/open/constructor:x",
    ]) expect({ u, k: r(u).kind }).toEqual({ u, k: "home" });
  });
  it("hosts: exact allow-list, https only, no userinfo tricks", () => {
    for (const u of ["https://evil.example/open/visit:a", "https://www.kiorly.com.evil.example/open/visit:a", "https://www.kiorly.com@evil.example/open/visit:a", "https://evil@www.kiorly.com/open/visit:a", "http://www.kiorly.com/open/visit:a", "javascript:alert(1)", "//evil.example/open/visit:a", "https://kiorly.com/open/visit:a", "file:///etc/passwd"]) expect(r(u).kind).toBe("home");
    expect(configuredHosts("www.kiorly.com, http://bad ,www.staging.kiorly.com")).toEqual(["www.kiorly.com", "www.staging.kiorly.com"]);
  });
  it("URL-valued parameters are never followed", () => {
    for (const n of ["to", "url", "redirect", "next", "returnTo", "continue"]) {
      const t = r(`https://www.kiorly.com/open/visit:apt_1?${n}=https%3A%2F%2Fevil.example`);
      expect(JSON.stringify(t)).not.toMatch(/evil|https?:/i);
    }
    expect(r(undefined)).toEqual(HOME); expect(r(5)).toEqual(HOME); expect(r("")).toEqual(HOME);
  });
});

describe("native intent handler", () => {
  it("a staff link opens Home and is held for after sign-in", () => {
    expect(redirectSystemPath({ path: "https://www.kiorly.com/open/visit:apt_1", initial: true })).toBe("/");
    expect(peekPendingRoute()).toBe("/clinic/visit/apt_1");
    expect(takePendingRoute()).toBe("/clinic/visit/apt_1");
  });
  it("sign-in and unknown links resolve without holding anything; malicious links open Home", () => {
    expect(redirectSystemPath({ path: "kiorly://auth/callback?code=a&state=b", initial: false })).toBe("/auth/callback?code=a&state=b");
    expect(redirectSystemPath({ path: "https://www.kiorly.com/signin", initial: false })).toBe("/sign-in");
    expect(redirectSystemPath({ path: "https://evil.example/open/visit:a", initial: false })).toBe("/");
    expect(redirectSystemPath({ path: "/open/visit:..%2fx", initial: false })).toBe("/");
    expect(peekPendingRoute()).toBeNull();
  });
});

describe("native config", () => {
  it("claims only the staff host and only /open/", () => {
    expect(staffAssociatedDomains()).toEqual(["applinks:www.kiorly.com"]);
    const f = staffIntentFilters()[0]!;
    expect(f.autoVerify).toBe(true);
    expect(f.data).toEqual([{ scheme: "https", host: "www.kiorly.com", pathPrefix: "/open/" }]);
    expect([...STAFF_ANDROID_PATH_PREFIXES]).not.toContain("/signin/");
    expect(staffLinkHost({ STAFF_LINK_HOST: "https://evil.example" } as never)).toBe("www.kiorly.com");
  });
});
