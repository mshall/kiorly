import { defineConfig } from '@playwright/test';

/**
 * Lab staff-app specs (lab-*.spec.ts) against the Expo web server (default :8082: `npx expo start --web --port 8082` from kiorly-team, or a static
 * export served via WEB_URL). Run: cd kiorly-team/e2e-web && npx playwright test -c lab.config.ts
 * Needs the Lab API (:3200, AUTH_MODE=dev) with the demo seeds (demo-lab, basic-lab). Browser: cached Chromium in ~/Library/Caches/ms-playwright (CHROMIUM_PATH overrides).
 */
const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
export default defineConfig({
  testDir: '.', testMatch: /lab-.*\.spec\.ts/, timeout: 120_000, expect: { timeout: 20_000 }, workers: 1, fullyParallel: false, retries: 0,
  reporter: [['list']], outputDir: './test-results/lab',
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:8082', viewport: { width: 430, height: 900 }, locale: 'en-US', launchOptions: { executablePath } },
});
