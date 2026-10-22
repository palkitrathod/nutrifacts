import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const PORT = 4173;
// A throwaway database per run, so tests never touch real data.
const dbPath = path.join(os.tmpdir(), `nutrifacts-e2e-${Date.now()}.db`);
// Emails (verification codes) are saved here instead of sent; e2e/mail.ts reads them. Set on
// process.env so test workers, which load this file too, see the same folder.
process.env.MAIL_OUTBOX_DIR ??= path.join(os.tmpdir(), `nutrifacts-e2e-outbox-${PORT}`);

// Set E2E_BASE_URL to test an already-running server (e.g. `npm run dev`) instead of building one.
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  // Run separately (shared accounts, one worker): npm run test:functional
  testIgnore: ['functional.spec.ts'],
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Safari (desktop + iPhone) and Firefox: `npx playwright test --project=webkit --project=iphone --project=firefox`
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
  ],
  // Exercises the real production setup: built site + API served by one Node process.
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run build && npm start',
    url: `http://localhost:${PORT}/api/auth/me`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DATABASE_PATH: dbPath,
      MAIL_OUTBOX_DIR: process.env.MAIL_OUTBOX_DIR,
      MAIL_TRANSPORT: 'outbox', // never email real addresses, even if .env has SMTP settings
      SEED_DEMO_USERS: 'true',
      COOKIE_SECURE: 'false',
      SIGNUPS_PER_HOUR_PER_IP: '1000',
      // Keep the sample dietitian login; never pick up the real admin from .env.production.
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
    },
  },
});
