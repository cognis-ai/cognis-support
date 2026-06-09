import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import { ADMIN_EMAIL, ADMIN_PASS } from '../env';

// Produces a logged-in storageState reused by the authenticated flows.
// Login itself is asserted here AND independently in auth.spec.ts (positive +
// negative), so this isn't the only coverage of the login path.
//
// NOTE on rate limits: the fork enforces Rack::Attack `login/ip`
// (5 POST /auth/sign_in per 5 min). The whole suite budgets 3 sign-ins per
// run: this setup, the bad-credentials probe, and the login+logout cycle.
const AUTH_FILE = '.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  expect(
    ADMIN_PASS,
    'Set CW_ADMIN_PASS (or CHATWOOT_ADMIN_PASSWORD in the platform .env.local) before running e2e.'
  ).toBeTruthy();

  await page.goto('/app/login');
  await page.locator('[data-testid="email_input"] input, input[name="email_address"]').first().fill(ADMIN_EMAIL);
  await page.locator('[data-testid="password_input"] input, input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('[data-testid="submit_button"]').click();

  // A successful login leaves /app/login and lands inside the account.
  await expect(page).toHaveURL(/\/app\/accounts\/\d+/, { timeout: 20_000 });

  // First login of a freshly provisioned account lands on the onboarding
  // wizard (all fields optional). Complete it once so the dashboard is usable.
  if (/\/onboarding/.test(page.url())) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/app\/accounts\/\d+\/dashboard/, { timeout: 20_000 });
  }

  fs.mkdirSync('.auth', { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
