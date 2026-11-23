import { defineConfig } from '@playwright/test';

/**
 * Pharmacy staff-app specs (pharmacy-*.spec.ts) against an Expo web server (default :8082, `npx expo start --web --port 8082` from kiorly,
 * or the static export served on another port via WEB_URL). Run: cd kiorly/e2e-web && npx playwright test -c pharmacy.config.ts
 * Needs the pharmacy API (:3100) with the demo seeds. Browser: the cached Chromium in ~/Library/Caches/ms-playwright (override CHROMIUM_PATH).
 */
const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
export default defineConfig({
  testDir: '.', testMatch: /pharmacy-.*\.spec\.ts/, timeout: 120_000, expect: { timeout: 20_000 }, workers: 1, fullyParallel: false, retries: 0,
  reporter: [['list']], outputDir: './pw-out-pharmacy',
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:8082', viewport: { width: 430, height: 900 }, locale: 'en-US', launchOptions: { executablePath }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
