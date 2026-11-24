import { resolveStaffLink } from "@/lib/deepLink";
import { setPendingRoute } from "@/lib/pendingRoute";

/**
 * Every incoming URL (Universal Link, App Link, kiorly:// scheme) passes through here before expo-router matches a route (GRW-P1-H).
 * Closed route table (lib/deepLink.ts): `/open/<key>:<id>`, `/signin/*`, the Passport redirect; anything else opens Home. Links that show staff data are held
 * until a session exists, so a link can never sign in, link or merge an account.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const t = resolveStaffLink(path, { allowInsecureLocal: __DEV__ });
  if (t.requiresSignIn) { setPendingRoute(t.route); return "/"; }
  return t.route;
}
