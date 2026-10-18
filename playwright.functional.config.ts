import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// Functional (in-app) e2e suite. Separate port and database from playwright.config.ts so both can run at once.
const PORT = 4174;
// A throwaway database per run, so tests never touch real data.
const dbPath = path.join(os.tmpdir(), `nutrifacts-e2e-functional-${Date.now()}.db`);

export default defineConfig({
  testDir: './e2e',
  testMatch: 'functional.spec.ts',
  // Several tests share the seeded sample accounts (Priya, the dietitian), so run them one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  outputDir: 'test-results/functional',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  // Exercises the real production setup: built site + API served by one Node process.
  webServer: {
    command: 'npm run build && npm start',
    url: `http://localhost:${PORT}/api/auth/me`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DATABASE_PATH: dbPath,
      SEED_DEMO_USERS: 'true',
      COOKIE_SECURE: 'false',
      SIGNUPS_PER_HOUR_PER_IP: '1000',
      // Keep the sample dietitian login; never pick up the real admin from .env.production.
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
    },
  },
});
