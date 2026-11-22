import { defineConfig } from '@playwright/test';

/**
 * Clinic staff-app specs (clinic-*.spec.ts): Kiorly Team Expo WEB build against the real clinic API and the seeded demo data.
 * Build + serve (env per kiorly-team/.env.example):
 *   cd kiorly-team && EXPO_PUBLIC_CLINIC_API=http://localhost:3010/api/v1 npx expo export -p web --output-dir /tmp/kw-web && node e2e-web/serve.mjs /tmp/kw-web 8093
 *   (or `npx expo start --web --port 8082` and WEB_URL=http://localhost:8082)
 * Run: cd kiorly-team/e2e-web && WEB_URL=http://localhost:8093 API_URL=http://localhost:3010/api/v1 npx playwright test -c clinic.config.ts
 * Browser: the cached Chromium in ~/Library/Caches/ms-playwright (override CHROMIUM_PATH). Geolocation is granted (Heliopolis, Cairo) for the arrival step.
 */
const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
export default defineConfig({
  testDir: '.', testMatch: /clinic-.*\.spec\.ts/, timeout: 60_000, expect: { timeout: 10_000 }, workers: 1, fullyParallel: false, retries: 0,
  reporter: [['list']], outputDir: './test-results/clinic',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:8093', viewport: { width: 420, height: 900 }, locale: 'en-US', launchOptions: { executablePath },
    permissions: ['geolocation'], geolocation: { latitude: 30.09, longitude: 31.32 }, trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
