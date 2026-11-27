# Universal Links and App Links (staff app)

The host the app claims is **build configuration**, never a literal in code (ADR-059, `_docs/environments/ENVIRONMENT_CONFIGURATION_STANDARD.md` rule 1). It is the Kiorly Home host of the environment: registry service `kiorly.app` (`_docs/registry/service-url-registry.yaml`, `app_links.staff_app_host_service`).

## Build variable

| Variable | Where | Meaning |
|---|---|---|
| `STAFF_LINK_HOST` | EAS profile `env` in `eas.json` (or the shell for a local build) | bare host name, lower case, no scheme, path or port. **Compile time**: it becomes the iOS associated domain (`applinks:<host>`) and the Android verified intent filter (`https://<host>/open/*`). An OTA update cannot change it; a native rebuild per environment does. |
| `EXPO_PUBLIC_LINK_HOSTS` | derived | `app.config.ts` copies `STAFF_LINK_HOST` into it when unset, so the in-app resolver (`src/lib/deepLink.ts`) accepts https links for the same host. Comma list; default is empty. |

Per environment (values equal the registry, asserted by `src/__tests__/link-host-config.test.ts` whenever the workspace `_docs/registry` is next to this repository):

| Environment | EAS profile | `STAFF_LINK_HOST` |
|---|---|---|
| local development | `development`, `development-simulator` | unset: the build claims **no** host; deep links work through `kiorly://` only |
| kx-test | `preview` | `app.test.kiorly.com` |
| kx-pilot | `pilot` (extends `production`) | `app.pilot.kiorly.com` |
| kx-pro | `production` | `app.kiorly.com` |
| dev, staging (reserved names) | none yet | `app.dev.kiorly.com`, `app.staging.kiorly.com` when a profile exists |

A malformed value fails the build (a typo never claims a different host). A `production` or `pilot` profile without it fails with a clear message (`SKIP_LINK_HOST_CHECK=1` bypasses, for CI type checks only).

## Association files (served by Kiorly Home)

Kiorly Home (`kiorex-account/apps/kiorly-home`) serves, on the same host, `/.well-known/apple-app-site-association` (no extension) and `/.well-known/assetlinks.json`. They are rendered at Home build time from `kiorex-account/config/app-links/*` by `apps/kiorly-home/app-links.ts` with these build variables:

* `APPLE_TEAM_ID` (founder item D9; unset keeps a `TODO_NEEDS_HUMAN` placeholder: valid JSON, iOS just does not verify),
* `ANDROID_SHA256_CERT_FINGERPRINTS` (comma list; Play app-signing key, plus the upload key for internal builds),
* `KX_STAFF_APP_ID_SUFFIX` (the `APP_ID_SUFFIX` of the build that runs against that environment; empty today, so the app id stays `com.kiorly.app`).

The static host must answer both paths with `Content-Type: application/json` and **no redirect** (CloudFront response headers policy or S3 object metadata). Only `/open/*` is claimed. Nothing here touches DNS or AWS: the host appears when the founder creates the `app.<env>` record and certificate.

## Native rebuild checklist when the host changes

1. Set or change `STAFF_LINK_HOST` in the profile. 2. Build natively (`eas build -p ios|android --profile <profile>`). 3. Publish the association files on the new host. 4. Verify on a device (iOS: Settings, Developer, Universal Links diagnostics; Android: `adb shell pm get-app-links com.kiorly.app`).

The previous literal `www.kiorly.com` is superseded by `app.kiorly.com` (registry `superseded_hosts`).
