// GRW-P1-H: deep link resolution for the Kiorly staff app (com.kiorly.app). Pure and dependency free (unit tested with malicious inputs).
// The staff app has one association (kiorex-account config/domains.json `appLinks`: host www.kiorly.com, paths /signin/* and /open/*). A link is matched against a
// CLOSED route table: `/open/<route-key>:<id>` (a key and an id, never a URL), `/signin/*` (opens the sign-in screen; nothing in the URL is read, so
// a Passport redirect that lands here can never sign anyone in), and the existing `kiorly://auth/*` Passport redirect. Everything else opens Home.
// No URL-valued parameter is honoured, no token is read from a link, and a link never links, merges or signs in an account: staff screens need
// the existing session, so a link that needs one is held and replayed after sign-in (lib/pendingRoute.ts).

export interface StaffLinkTarget { kind: "home" | "open" | "signin" | "auth"; route: string; requiresSignIn: boolean }
export const HOME: StaffLinkTarget = { kind: "home", route: "/", requiresSignIn: false };
const SCHEMES = ["kiorly"];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** GRW-P2-C: `kiorly://open/growth:share|slots|statements|verification` open the matching Growth screen; any other id opens the hub (a closed table, never a path from the link). */
const GROWTH_SCREENS: Readonly<Record<string, string>> = Object.freeze({ share: "/clinic/growth-share", slots: "/clinic/growth-slots", statements: "/clinic/growth-statements", verification: "/clinic/growth-verification" });

/** route key -> in-app path template. Add a key here only together with a screen that checks the session and the caller's role. */
export const OPEN_ROUTE_KEYS: Readonly<Record<string, (id: string) => string>> = {
  visit: (id) => `/clinic/visit/${id}`,
  patient: (id) => `/clinic/patient/${id}`,
  round: (id) => `/clinic/round/${id}`,
  rx: (id) => `/pharmacy/rx/${id}`,
  /** GRW-P1-L: `kiorly://open/growth:me` (the hub shows the signed-in user's own links; the module key and role are checked by the API). */
  growth: (id) => (Object.prototype.hasOwnProperty.call(GROWTH_SCREENS, id) ? GROWTH_SCREENS[id]! : "/clinic/growth"),
};
export const configuredHosts = (env: string | undefined = process.env.EXPO_PUBLIC_LINK_HOSTS): string[] =>
  (env ?? "www.kiorly.com").split(",").map((h) => h.trim().toLowerCase()).filter((h) => /^[a-z0-9.-]+(:\d{1,5})?$/.test(h));

const decodeOnce = (s: string): string | null => { try { return decodeURIComponent(s); } catch { return null; } };
const clean = (raw: string): string | null => { const d = decodeOnce(raw); return d === null || d.includes("%") || /[\\/\u0000-\u001f\u007f\s]/.test(d) ? null : d; };
const AUTH_PARAMS = ["code", "state", "error", "error_description", "session_state", "iss"];

function authTarget(which: string, query: string): StaffLinkTarget {
  const kept: string[] = [];
  for (const pair of query.split("&")) {
    const i = pair.indexOf("=");
    const k = i < 0 ? pair : pair.slice(0, i);
    if (!AUTH_PARAMS.includes(k)) continue;
    const v = decodeOnce(i < 0 ? "" : pair.slice(i + 1));
    if (v !== null && v.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(v)) kept.push(`${k}=${encodeURIComponent(v)}`);
  }
  return { kind: "auth", route: `/auth/${which}${kept.length ? `?${kept.join("&")}` : ""}`, requiresSignIn: false };
}

function match(pathRaw: string, query: string, fromScheme: boolean): StaffLinkTarget {
  const segs = pathRaw.split("/").filter((s) => s !== "");
  if (!segs.length || segs.length > 4) return HOME;
  const c: string[] = [];
  for (const s of segs) { const d = clean(s); if (d === null) return HOME; c.push(d); }
  const [head, a, ...rest] = c;
  if (fromScheme && head === "auth" && (a === "callback" || a === "logout") && !rest.length) return authTarget(a, query);
  if (head === "signin") return { kind: "signin", route: "/sign-in", requiresSignIn: false }; // nothing after /signin is read: a Passport callback landing here never signs in
  if (head === "open" && a && !rest.length) {
    const m = /^([a-z]{2,12}):(.+)$/.exec(a);
    const tpl = m && Object.prototype.hasOwnProperty.call(OPEN_ROUTE_KEYS, m[1]!) ? OPEN_ROUTE_KEYS[m[1]!] : undefined; // own keys only: `constructor:x` must not resolve
    return tpl && ID_RE.test(m![2]!) ? { kind: "open", route: tpl(m![2]!), requiresSignIn: true } : HOME;
  }
  return HOME;
}

export function resolveStaffLink(raw: unknown, o: { hosts?: readonly string[]; allowInsecureLocal?: boolean } = {}): StaffLinkTarget {
  if (typeof raw !== "string" || !raw) return HOME;
  try {
    const t = raw.trim();
    if (t.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(t) || t.startsWith("//")) return HOME;
    if (t.startsWith("/")) { const q = t.indexOf("?"); const h = t.indexOf("#"); const end = Math.min(...[q, h, t.length].filter((n) => n >= 0)); return match(t.slice(0, end), q >= 0 ? t.slice(q + 1, h > q ? h : undefined) : "", false); }
    const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/.exec(t);
    if (!m) return HOME;
    const scheme = m[1]!.toLowerCase(), host = m[2]!, path = m[3] ?? "", query = m[4] ?? "";
    if (SCHEMES.includes(scheme)) return /[@:%]/.test(host) ? HOME : match(`/${host}${path}`, query, true);
    if (scheme !== "https" && !(scheme === "http" && o.allowInsecureLocal && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host))) return HOME;
    if (host.includes("@") || host.includes("%")) return HOME;
    return (o.hosts ?? configuredHosts()).map((x) => x.toLowerCase()).includes(host.toLowerCase()) ? match(path, query, false) : HOME;
  } catch { return HOME; }
}
