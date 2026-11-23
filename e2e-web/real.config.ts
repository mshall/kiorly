import { defineConfig } from '@playwright/test';

/**
 * REAL-stack Kiorex Passport specs (real-*.spec.ts): the Expo WEB build on :8082 against the REAL dev IdP (:4400) and the real Clinic /
 * Pharmacy / Lab APIs (:3010 / :3100 / :3200), seeded demo staff linked to Passport (OTP 000000). Nothing is mocked.
 * Run: (stack up, scripts/seed-all.sh done) cd kiorly && npm run web   (port 8082 is the registered Passport redirect)
 *      cd kiorly/e2e-web && WEB_URL=http://localhost:8082 npx playwright test -c real.config.ts
 */
const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
export default defineConfig({
  testDir: '.', testMatch: /real-.*\.spec\.ts/, timeout: 120_000, expect: { timeout: 20_000 }, workers: 1, fullyParallel: false, retries: 0,
  reporter: [['list']], outputDir: './test-results/real',
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:8082', viewport: { width: 420, height: 900 }, locale: 'en-US', launchOptions: { executablePath }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
