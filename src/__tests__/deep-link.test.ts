import { redirectSystemPath } from "../../app/+native-intent";
import { HOME, OPEN_ROUTE_KEYS, configuredHosts, resolveStaffLink } from "@/lib/deepLink";
import { peekPendingRoute, setPendingRoute, takePendingRoute } from "@/lib/pendingRoute";
import { STAFF_ANDROID_PATH_PREFIXES, staffAssociatedDomains, staffIntentFilters, staffLinkHost } from "../../app.config";

process.env.EXPO_PUBLIC_LINK_HOSTS = "app.test.kiorly.com"; // the build configures the host (eas.json / STAFF_LINK_HOST); no host is built into the code
const r = (u: unknown) => resolveStaffLink(u, { hosts: ["app.test.kiorly.com"] });
beforeEach(() => setPendingRoute(null));

describe("staff app deep links (GRW-P1-H)", () => {
  it("the existing /signin/* and /open/* association paths still resolve", () => {
    expect(r("https://app.test.kiorly.com/signin")).toMatchObject({ kind: "signin", route: "/sign-in" });
    expect(r("https://app.test.kiorly.com/signin/callback?code=abc&state=xyz")).toMatchObject({ kind: "signin", route: "/sign-in" }); // the code is never read
    expect(r("https://app.test.kiorly.com/open/visit:apt_123")).toEqual({ kind: "open", route: "/clinic/visit/apt_123", requiresSignIn: true });
    expect(r("https://app.test.kiorly.com/open/patient:P-42").route).toBe("/clinic/patient/P-42");
    expect(r("https://app.test.kiorly.com/open/rx:rx_9").route).toBe("/pharmacy/rx/rx_9");
    expect(r("kiorly://open/specimen:cmwz4jnfl001l").route).toBe("/lab/results/cmwz4jnfl001l");
    expect(r("kiorly://open/specimen:..%2Fsecret").route).toBe("/");
    expect(r("https://app.test.kiorly.com/open/growth:me")).toMatchObject({ kind: "open", route: "/clinic/growth", requiresSignIn: true }); // GRW-P1-L
    // GRW-P2-C: the closed set of Growth screens; any other id (including prototype names) opens the hub, never a path taken from the link
    for (const [id, route] of [["share", "/clinic/growth-share"], ["slots", "/clinic/growth-slots"], ["statements", "/clinic/growth-statements"], ["verification", "/clinic/growth-verification"]]) {
      expect(r(`kiorly://open/growth:${id}`)).toMatchObject({ kind: "open", route, requiresSignIn: true });
      expect(r(`https://app.test.kiorly.com/open/growth:${id}`)).toMatchObject({ route });
    }
    for (const id of ["constructor", "__proto__", "toString", "x..y"]) expect(r(`kiorly://open/growth:${id}`).route === "/clinic/growth" || r(`kiorly://open/growth:${id}`).kind === "home").toBe(true);
    expect(r("https://app.test.kiorly.com/open/round:r1").route).toBe("/clinic/round/r1");
    expect(r("kiorly://open/visit:apt_123").route).toBe("/clinic/visit/apt_123");
  });
  it("the Passport redirect keeps working (scheme only, OIDC parameters only)", () => {
    expect(r("kiorly://auth/callback?code=a1&state=s1&to=https%3A%2F%2Fevil.example&token=zzz")).toMatchObject({ kind: "auth", route: "/auth/callback?code=a1&state=s1" });
    expect(r("kiorly://auth/logout").route).toBe("/auth/logout");
    expect(r("https://app.test.kiorly.com/auth/callback?code=a&state=b").kind).toBe("home");
  });
  it("route keys are a closed list of key:id pairs, never URLs", () => {
    expect(Object.keys(OPEN_ROUTE_KEYS).sort()).toEqual(["growth", "patient", "round", "rx", "specimen", "visit"]);
    for (const u of [
      "https://app.test.kiorly.com/open/https:evil.example", "https://app.test.kiorly.com/open/visit:https%3A%2F%2Fevil.example", "https://app.test.kiorly.com/open/visit:..%2F..%2Fx", "https://app.test.kiorly.com/open/visit:a/b",
      "https://app.test.kiorly.com/open/unknown:abc", "https://app.test.kiorly.com/open/visit", "https://app.test.kiorly.com/open/visit:", "https://app.test.kiorly.com/open/visit:%252e%252e", "https://app.test.kiorly.com/open/visit:" + "a".repeat(70),
      "https://app.test.kiorly.com/open/visit:a%00b", "https://app.test.kiorly.com/open/visit:<script>", "https://app.test.kiorly.com/open/__proto__:x", "https://app.test.kiorly.com/open/constructor:x",
    ]) expect({ u, k: r(u).kind }).toEqual({ u, k: "home" });
  });
  it("hosts: exact allow-list, https only, no userinfo tricks", () => {
    for (const u of ["https://evil.example/open/visit:a", "https://app.test.kiorly.com.evil.example/open/visit:a", "https://app.test.kiorly.com@evil.example/open/visit:a", "https://evil@app.test.kiorly.com/open/visit:a", "http://app.test.kiorly.com/open/visit:a", "javascript:alert(1)", "//evil.example/open/visit:a", "https://kiorly.com/open/visit:a", "file:///etc/passwd"]) expect(r(u).kind).toBe("home");
    expect(configuredHosts("app.test.kiorly.com, http://bad ,app.staging.kiorly.com")).toEqual(["app.test.kiorly.com", "app.staging.kiorly.com"]);
  });
  it("URL-valued parameters are never followed", () => {
    for (const n of ["to", "url", "redirect", "next", "returnTo", "continue"]) {
      const t = r(`https://app.test.kiorly.com/open/visit:apt_1?${n}=https%3A%2F%2Fevil.example`);
      expect(JSON.stringify(t)).not.toMatch(/evil|https?:/i);
    }
    expect(r(undefined)).toEqual(HOME); expect(r(5)).toEqual(HOME); expect(r("")).toEqual(HOME);
  });
});

describe("native intent handler", () => {
  it("a staff link opens Home and is held for after sign-in", () => {
    expect(redirectSystemPath({ path: "https://app.test.kiorly.com/open/visit:apt_1", initial: true })).toBe("/");
    expect(peekPendingRoute()).toBe("/clinic/visit/apt_1");
    expect(takePendingRoute()).toBe("/clinic/visit/apt_1");
  });
  it("sign-in and unknown links resolve without holding anything; malicious links open Home", () => {
    expect(redirectSystemPath({ path: "kiorly://auth/callback?code=a&state=b", initial: false })).toBe("/auth/callback?code=a&state=b");
    expect(redirectSystemPath({ path: "https://app.test.kiorly.com/signin", initial: false })).toBe("/sign-in");
    expect(redirectSystemPath({ path: "https://evil.example/open/visit:a", initial: false })).toBe("/");
    expect(redirectSystemPath({ path: "/open/visit:..%2fx", initial: false })).toBe("/");
    expect(peekPendingRoute()).toBeNull();
  });
});

describe("native config", () => {
  const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
  it("claims only the configured staff host and only /open/", () => {
    const host = staffLinkHost(env({ STAFF_LINK_HOST: " App.Test.Kiorly.com " }));
    expect(host).toBe("app.test.kiorly.com");
    expect(staffAssociatedDomains(host)).toEqual(["applinks:app.test.kiorly.com"]);
    const f = staffIntentFilters(host)[0]!;
    expect(f.autoVerify).toBe(true);
    expect(f.data).toEqual([{ scheme: "https", host: "app.test.kiorly.com", pathPrefix: "/open/" }]);
    expect([...STAFF_ANDROID_PATH_PREFIXES]).not.toContain("/signin/");
  });
  it("local development claims no host at all, and configuredHosts defaults to none", () => {
    expect(staffLinkHost(env({}))).toBeNull();
    expect(staffLinkHost(env({ STAFF_LINK_HOST: "" }))).toBeNull();
    expect(staffAssociatedDomains(null)).toEqual([]);
    expect(staffIntentFilters(null)).toEqual([]);
    expect(configuredHosts("")).toEqual([]);
    expect(resolveStaffLink("https://app.test.kiorly.com/open/visit:a1", { hosts: configuredHosts("") })).toBe(HOME);
  });
  it("a malformed STAFF_LINK_HOST fails the build instead of claiming something else", () => {
    for (const bad of ["https://evil.example", "app.test.kiorly.com/open", "app.test.kiorly.com:8443", "localhost", "-x.example.com", "a b.example.com"]) expect(() => staffLinkHost(env({ STAFF_LINK_HOST: bad }))).toThrow(/STAFF_LINK_HOST/);
  });
});
