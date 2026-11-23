import { defineConfig } from '@playwright/test';

/**
 * Kiorex Passport sign-in / sign-out specs (passport-*.spec.ts): the Expo WEB build against a MOCK Passport (OIDC provider) and a mocked clinic API,
 * both served by Playwright routes, so no stack, no ports and no OTP are needed. The real dev IdP (kiorex-account, :4400) is never contacted.
 * Build + serve:
 *   cd kiorly-team && npx expo export -p web --output-dir /tmp/kiorly-web && node e2e-web/serve.mjs /tmp/kiorly-web 8097
 * Run: cd kiorly-team/e2e-web && WEB_URL=http://localhost:8097 npx playwright test -c passport.config.ts
 */
const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
export default defineConfig({
  testDir: '.', testMatch: /passport-.*\.spec\.ts/, timeout: 60_000, expect: { timeout: 10_000 }, workers: 1, fullyParallel: false, retries: 0,
  reporter: [['list']], outputDir: './test-results/passport',
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:8097', viewport: { width: 420, height: 900 }, locale: 'en-US', launchOptions: { executablePath }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
