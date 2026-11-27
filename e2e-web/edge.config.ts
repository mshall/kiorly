import { defineConfig } from '@playwright/test';

/**
 * Cross-module edge-state specs (edge-*.spec.ts): the Expo web build against the private stack, with the API answers forced through Playwright routes
 * (401, 403, MFA_REQUIRED, 409, 5xx, slow, offline, huge lists, long names). Needs the Lab (LAB_API), Clinic (API_URL) and Pharmacy (PHARMACY_API) APIs of the
 * private stack (e2e/scripts/stf-stack.sh) and WEB_URL pointing at an Expo web server built against it. Browser: cached Chromium (CHROMIUM_PATH overrides).
 */
const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
export default defineConfig({
  testDir: '.', testMatch: /edge-.*\.spec\.ts/, timeout: 90_000, expect: { timeout: 15_000 }, workers: 1, fullyParallel: false, retries: 0,
  reporter: [['list']], outputDir: './test-results/edge',
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:8082', viewport: { width: 430, height: 900 }, locale: 'en-US', launchOptions: { executablePath } },
});
