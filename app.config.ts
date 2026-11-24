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
 *   APP_NAME_SUFFIX               optional " (Dev)"
 *   EAS_BUILD_PROFILE             set by EAS: development | preview | production
 *
 * A production build without the Firebase files fails HERE with a clear message instead of shipping an app that can never register for push.
 * Placeholders are documented in config/firebase/README.md; the real files are git-ignored.
 */
// ---- GRW-P1-H: Universal Links / App Links for www.kiorly.com (kept in this file: Expo's config loader cannot resolve sibling TS modules) ----
// NATIVE REBUILD REQUIRED to take effect (associated domains entitlement + verified intent filter). Verification needs the Apple Team ID and the Play signing
// SHA-256 published at https://www.kiorly.com/.well-known/ (kiorex-account config/app-links, NEEDS_HUMAN D9). Only `/open/*` is claimed: `/signin/*` stays in the
// association template but the app does not claim it, so a Passport redirect to the web sign-in callback is never captured by the app.
export const STAFF_LINK_HOST_DEFAULT = "www.kiorly.com";
export const STAFF_ANDROID_PATH_PREFIXES = ["/open/"] as const;
export const staffLinkHost = (env: NodeJS.ProcessEnv = process.env): string => { const h = (env.STAFF_LINK_HOST ?? STAFF_LINK_HOST_DEFAULT).trim().toLowerCase(); return /^[a-z0-9.-]+$/.test(h) ? h : STAFF_LINK_HOST_DEFAULT; };
export const staffAssociatedDomains = (host = staffLinkHost()) => [`applinks:${host}`];
export const staffIntentFilters = (host = staffLinkHost()) => [{ action: "VIEW", autoVerify: true, data: STAFF_ANDROID_PATH_PREFIXES.map((pathPrefix) => ({ scheme: "https", host, pathPrefix })), category: ["BROWSABLE", "DEFAULT"] }];

const exists = (p: string) => { try { return fs.existsSync(p); } catch { return false; } };
const pick = (envName: string, local: string): string | undefined => process.env[envName] || (exists(local) ? local : undefined);

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE ?? process.env.APP_ENV ?? "development";
  const idSuffix = process.env.APP_ID_SUFFIX ?? "";
  const androidFile = pick("GOOGLE_SERVICES_JSON", "./config/firebase/google-services.json");
  const iosFile = pick("GOOGLE_SERVICE_INFO_PLIST", "./config/firebase/GoogleService-Info.plist");
  if (profile === "production" && !process.env.SKIP_FIREBASE_CHECK) {
    const missing = [!androidFile && "GOOGLE_SERVICES_JSON", !iosFile && "GOOGLE_SERVICE_INFO_PLIST"].filter(Boolean);
    if (missing.length) throw new Error(`Production build needs Firebase config files: set ${missing.join(" and ")} (EAS file env vars). See config/firebase/README.md.`);
  }
  const projectId = process.env.EAS_PROJECT_ID ?? (config.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const plugins = (config.plugins ?? []).map((p) => (Array.isArray(p) ? p : [p, undefined]) as [string, Record<string, unknown> | undefined]).map(([name, opts]) =>
    name === "expo-notifications" ? ([name, { ...(opts ?? {}), defaultChannel: "default", enableBackgroundRemoteNotifications: true }] as [string, Record<string, unknown>]) : opts ? ([name, opts] as [string, Record<string, unknown>]) : name,
  );
  return {
    ...config,
    name: `${config.name}${process.env.APP_NAME_SUFFIX ?? ""}`,
    slug: config.slug ?? "kiorly",
    ios: { ...config.ios, associatedDomains: staffAssociatedDomains(), bundleIdentifier: `${config.ios?.bundleIdentifier}${idSuffix}`, ...(iosFile ? { googleServicesFile: iosFile } : {}), infoPlist: { ...config.ios?.infoPlist, UIBackgroundModes: ["remote-notification"] } },
    android: { ...config.android, intentFilters: staffIntentFilters(), package: `${config.android?.package}${idSuffix}`, ...(androidFile ? { googleServicesFile: androidFile } : {}), permissions: Array.from(new Set(["POST_NOTIFICATIONS", ...(config.android?.permissions ?? [])])) },
    plugins: plugins as ExpoConfig["plugins"],
    ...(process.env.EAS_UPDATES_URL ? { updates: { url: process.env.EAS_UPDATES_URL } , runtimeVersion: { policy: "fingerprint" as const } } : {}),
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}), appProfile: profile },
  };
};
