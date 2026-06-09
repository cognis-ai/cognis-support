import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './env';

// Cognis Support e2e — drives the LIVE Chatwoot fork (cognis-chatwoot-1).
// Target is configurable so the same suite runs against dev (:3000) or a
// staging/prod URL in CI. Credentials come from env so no secrets are committed.
export default defineConfig({
  testDir: './tests',
  // Auth state is shared via storageState produced by the auth setup project,
  // so flows don't re-login on every test. Login itself is tested explicitly.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
});
