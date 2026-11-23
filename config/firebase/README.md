# Firebase client config (push notifications)

Both files are **git-ignored** and never committed. Nothing in the repo contains a real key.

| File | Where it comes from | Used for |
|---|---|---|
| `google-services.json` | Firebase console > Project settings > Your apps > Android (package `com.kiorly.app`, add `.dev` / `.preview` ids if you use `APP_ID_SUFFIX`) | Android FCM registration, Gradle `google-services` plugin |
| `GoogleService-Info.plist` | Firebase console > Project settings > Your apps > iOS (bundle `com.kiorly.app`) | iOS FCM / APNs registration |

## EAS builds (preferred)

```
eas env:create --environment production --name GOOGLE_SERVICES_JSON      --type file --visibility secret --value ./google-services.json
eas env:create --environment production --name GOOGLE_SERVICE_INFO_PLIST --type file --visibility secret --value ./GoogleService-Info.plist
```
Repeat for `preview` and `development`. `app.config.ts` reads the file paths from those variables. A `production` profile build **fails at config time** if either is missing.

## Local builds

Drop the two files in this folder (they are picked up automatically) and run `npx expo prebuild --clean`.

## Placeholders for a fresh checkout

Without the files the app still builds and runs (push registration falls back to the mock/dev path, `EXPO_PUBLIC_PUSH_TOKEN_KIND=expo` tokens need the EAS project id, see Docs/NEEDS_HUMAN.md "Provider go-live").
Minimal `google-services.json` shape (all values are placeholders, do not commit real ones):

```json
{ "project_info": { "project_number": "000000000000", "project_id": "kiorly-placeholder", "storage_bucket": "kiorly-placeholder.appspot.com" },
  "client": [{ "client_info": { "mobilesdk_app_id": "1:000000000000:android:0000000000000000", "android_client_info": { "package_name": "com.kiorly.app" } },
               "api_key": [{ "current_key": "PLACEHOLDER_NOT_A_REAL_KEY" }] }], "configuration_version": "1" }
```
