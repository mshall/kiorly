import fs from "node:fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic layer over app.json (which stays the single source for name, ids, icons and plugins). Everything that differs per environment or
 * carries credentials comes from ENV / EAS file secrets, never from the repo:
 *
 *   GOOGLE_SERVICES_JSON          path to the Firebase Android config (EAS "file" env var; locally ./config/firebase/google-services.json)
 *   GOOGLE_SERVICE_INFO_PLIST     path to the Firebase iOS config    (EAS "file" env var; locally ./config/firebase/GoogleService-Info.plist)
 *   EAS_PROJECT_ID                EAS project id (push tokens + OTA updates)
 *   EAS_UPDATES_URL               optional, https://u.expo.dev/<project id>
 *   APP_ID_SUFFIX                 optional ".dev" / ".preview" so builds install side by side (add the id to the Firebase project too)
 *   (EXPO_PUBLIC_CLINIC_API / _PHARMACY_API / _LAB_API and the Passport settings are EAS environment variables, read at bundle time by src/api/products.ts)
 *   STAFF_LINK_HOST               universal/app link host (Kiorly Home of the environment, app.<env>.<domain>), compile time; set per EAS profile in eas.json
 *   APP_NAME_SUFFIX               optional " (Dev)"
 *   EAS_BUILD_PROFILE             set by EAS: development | preview | production
 *
 * A production build without the Firebase files fails HERE with a clear message instead of shipping an app that can never register for push.
 * Placeholders are documented in config/firebase/README.md; the real files are git-ignored.
 */
// ---- Universal Links / App Links (GRW-P1-H, ADR-059): the host is BUILD CONFIGURATION, never a literal ----
// The staff app claims `https://<STAFF_LINK_HOST>/open/*`, where STAFF_LINK_HOST is the Kiorly Home host of the environment this binary is built for
// (registry service kiorly.app: app.<env>.kiorly.com, production app.kiorly.com). Associated domains and the Android intent filter are COMPILE TIME
// (native rebuild per environment; an OTA update cannot change them), so each EAS profile sets it in eas.json `env` (kept equal to the registry by
// src/__tests__/link-host-config.test.ts). Unset = the build claims NO host (local development: deep links work through the kiorly:// scheme only);
// a production-class profile (production, pilot) refuses to build without it. Verification needs the Apple Team ID and the Play signing SHA-256
// published by Kiorly Home at https://<STAFF_LINK_HOST>/.well-known/ (kiorex-account apps/kiorly-home/app-links.ts, NEEDS_HUMAN D9). Only `/open/*`
// is claimed: `/signin/*` is never claimed, so a Passport redirect to the web sign-in callback is never captured by the app.
// (Kept in this file: Expo's config loader cannot resolve sibling TS modules.)
export const STAFF_ANDROID_PATH_PREFIXES = ["/open/"] as const;
const LINK_HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
/** The configured link host (lower-case), null when the build claims none. A malformed value throws: a typo must not silently claim the wrong host. */
export const staffLinkHost = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const h = (env.STAFF_LINK_HOST ?? "").trim().toLowerCase();
  if (h === "") return null;
  if (!LINK_HOST_RE.test(h)) throw new Error(`STAFF_LINK_HOST must be a bare host name such as app.test.<domain> (no scheme, path or port); got "${env.STAFF_LINK_HOST}"`);
  return h;
};
export const staffAssociatedDomains = (host: string | null = staffLinkHost()): string[] => (host ? [`applinks:${host}`] : []);
export const staffIntentFilters = (host: string | null = staffLinkHost()) =>
  host ? [{ action: "VIEW", autoVerify: true, data: STAFF_ANDROID_PATH_PREFIXES.map((pathPrefix) => ({ scheme: "https", host, pathPrefix })), category: ["BROWSABLE", "DEFAULT"] }] : [];
const PRODUCTION_CLASS_PROFILES = ["production", "pilot"];
// expo-dev-client (launcher, dev menu, and our floating-button override) belongs in development builds only. Every store or release-class profile
// (preview, kx-test, kx-test-simulator, pilot, production) is built WITHOUT these config plugins: no dev launcher wiring in MainActivity / AppDelegate,
// no dev-menu manifest entries. A development build is a profile named `development` or `development-*` (EAS) or a local run with APP_ENV unset / `development`.
export const isDevClientProfile = (profile: string): boolean => profile === "development" || profile.startsWith("development-");
export const DEV_CLIENT_PLUGINS = ["expo-dev-client", "./plugins/withDevMenuNoFab.js"] as const;

const exists = (p: string) => { try { return fs.existsSync(p); } catch { return false; } };
const pick = (envName: string, local: string): string | undefined => process.env[envName] || (exists(local) ? local : undefined);

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE ?? process.env.APP_ENV ?? "development";
  const idSuffix = process.env.APP_ID_SUFFIX ?? "";
  const androidFile = pick("GOOGLE_SERVICES_JSON", "./config/firebase/google-services.json");
  const iosFile = pick("GOOGLE_SERVICE_INFO_PLIST", "./config/firebase/GoogleService-Info.plist");
  if (PRODUCTION_CLASS_PROFILES.includes(profile) && !process.env.SKIP_FIREBASE_CHECK) {
    const missing = [!androidFile && "GOOGLE_SERVICES_JSON", !iosFile && "GOOGLE_SERVICE_INFO_PLIST"].filter(Boolean);
    if (missing.length) throw new Error(`Production build needs Firebase config files: set ${missing.join(" and ")} (EAS file env vars). See config/firebase/README.md.`);
  }
  const linkHost = staffLinkHost();
  if (!linkHost && PRODUCTION_CLASS_PROFILES.includes(profile) && !process.env.SKIP_LINK_HOST_CHECK) throw new Error(`A ${profile} build needs STAFF_LINK_HOST (the Kiorly Home host of the environment, set per profile in eas.json). Associated domains are compile time.`);
  if (linkHost) process.env.EXPO_PUBLIC_LINK_HOSTS ??= linkHost; // the in-app link resolver (src/lib/deepLink.ts) accepts https links for the same host
  const projectId = process.env.EAS_PROJECT_ID ?? (config.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const devClient = isDevClientProfile(profile);
  const plugins = (config.plugins ?? []).filter((p) => devClient || !DEV_CLIENT_PLUGINS.includes((Array.isArray(p) ? p[0] : p) as (typeof DEV_CLIENT_PLUGINS)[number])).map((p) => (Array.isArray(p) ? p : [p, undefined]) as [string, Record<string, unknown> | undefined]).map(([name, opts]) =>
    name === "expo-notifications" ? ([name, { ...(opts ?? {}), defaultChannel: "default", enableBackgroundRemoteNotifications: true }] as [string, Record<string, unknown>]) : opts ? ([name, opts] as [string, Record<string, unknown>]) : name,
  );
  return {
    ...config,
    name: `${config.name}${process.env.APP_NAME_SUFFIX ?? ""}`,
    slug: config.slug ?? "kiorly",
    ios: { ...config.ios, ...(linkHost ? { associatedDomains: staffAssociatedDomains(linkHost) } : {}), bundleIdentifier: `${config.ios?.bundleIdentifier}${idSuffix}`, ...(iosFile ? { googleServicesFile: iosFile } : {}), infoPlist: { ...config.ios?.infoPlist, UIBackgroundModes: ["remote-notification"] } },
    android: { ...config.android, ...(linkHost ? { intentFilters: staffIntentFilters(linkHost) } : {}), package: `${config.android?.package}${idSuffix}`, ...(androidFile ? { googleServicesFile: androidFile } : {}), permissions: Array.from(new Set(["POST_NOTIFICATIONS", ...(config.android?.permissions ?? [])])) },
    plugins: plugins as ExpoConfig["plugins"],
    ...(process.env.EAS_UPDATES_URL ? { updates: { url: process.env.EAS_UPDATES_URL } , runtimeVersion: { policy: "fingerprint" as const } } : {}),
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}), appProfile: profile },
  };
};
