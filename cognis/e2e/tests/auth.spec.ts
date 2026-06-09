import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS } from '../env';

// These tests exercise the raw login surface, so start each from a clean,
// unauthenticated context (ignore the shared admin storageState).
//
// Sign-in budget: Rack::Attack throttles POST /auth/sign_in to 5/5min per IP,
// so this file performs exactly two sign-in attempts (one bad, one good).
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL_INPUT = '[data-testid="email_input"] input, input[name="email_address"]';
const PASSWORD_INPUT = '[data-testid="password_input"] input, input[name="password"]';

test.describe('Cognis Support — authentication', () => {
  test('anonymous visit to a protected route redirects to login with CSRF token present', async ({
    page,
  }) => {
    await page.goto('/app/accounts/1/dashboard');
    // The SPA route guard bounces unauthenticated visitors to the login view.
    await expect(page).toHaveURL(/\/app\/login/);
    await expect(page.locator(EMAIL_INPUT).first()).toBeVisible();

    // Rails CSRF protection is on: the page embeds an authenticity token.
    const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
    expect(csrf, 'csrf-token meta must be present and non-empty').toBeTruthy();
    expect(csrf!.length).toBeGreaterThan(20);
  });

  test('rejects bad credentials and issues no session', async ({ page }) => {
    await page.goto('/app/login');
    await page.locator(EMAIL_INPUT).first().fill(ADMIN_EMAIL);
    await page.locator(PASSWORD_INPUT).first().fill('definitely-the-wrong-password');
    await page.locator('[data-testid="submit_button"]').click();

    // Stays on the login route — never reaches an account dashboard.
    await expect(page).toHaveURL(/\/app\/login/);
    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/\/app\/login/);

    // No devise-token-auth session cookie was issued.
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === 'cw_d_session_info');
    expect(session, 'no cw_d_session_info cookie on failed login').toBeFalsy();
  });

  test('happy-path login establishes a session and logout clears it', async ({ page }) => {
    test.skip(!ADMIN_PASS, 'admin password not available in env');
    await page.goto('/app/login');
    await page.locator(EMAIL_INPUT).first().fill(ADMIN_EMAIL);
    await page.locator(PASSWORD_INPUT).first().fill(ADMIN_PASS);
    await page.locator('[data-testid="submit_button"]').click();

    await expect(page).toHaveURL(/\/app\/accounts\/\d+/, { timeout: 20_000 });

    // Auth session cookie is set after login.
    let cookies = await page.context().cookies();
    expect(
      cookies.find((c) => c.name === 'cw_d_session_info'),
      'cw_d_session_info issued on success'
    ).toBeTruthy();

    // Open the profile menu (button showing the signed-in email) and log out.
    await page.locator('button', { hasText: ADMIN_EMAIL }).first().click();
    await page.getByRole('button', { name: /log ?out/i }).click();

    await expect(page).toHaveURL(/\/app\/login/, { timeout: 15_000 });
    cookies = await page.context().cookies();
    expect(
      cookies.find((c) => c.name === 'cw_d_session_info'),
      'session cookie cleared after logout'
    ).toBeFalsy();
  });
});
