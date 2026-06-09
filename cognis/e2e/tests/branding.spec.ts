import { test, expect } from '@playwright/test';

// Brand-integrity checks: the product must present as "Cognis Support", not the
// upstream name. The ONLY permitted upstream mention is a license-required
// attribution (Chatwoot is MIT-licensed); nothing in the visible chrome may
// read "Chatwoot".
const BRAND = 'Cognis Support';

test.describe('Cognis Support — brand integrity', () => {
  test('login page is branded Cognis Support with no upstream product name', async ({
    browser,
  }) => {
    // Clean, unauthenticated context — the login screen must be 100% clean.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/app/login');

    await expect(page).toHaveTitle(new RegExp(BRAND));
    await expect(
      page.locator('[data-testid="email_input"] input, input[name="email_address"]').first()
    ).toBeVisible();

    const body = await page.locator('body').innerText();
    expect(body, 'no "Chatwoot" in visible login page text').not.toMatch(/chatwoot/i);
    await ctx.close();
  });

  test('manifest and meta present the Cognis Support identity', async ({ page }) => {
    const res = await page.request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.name).toBe(BRAND);
    expect(manifest.short_name).toBe(BRAND);

    await page.goto('/app/login');
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description ?? '').toContain('Cognis');
    expect(description ?? '').not.toMatch(/chatwoot/i);
  });

  test('authenticated app shell (sidebar + title) shows no upstream name', async ({ page }) => {
    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/accounts\/\d+/, { timeout: 20_000 });

    // Wait for the sidebar chrome to render, then sweep all visible text.
    await expect(page.getByText('Conversations').first()).toBeVisible({ timeout: 20_000 });
    const body = await page.locator('body').innerText();
    expect(body, 'no "Chatwoot" in the visible app shell').not.toMatch(/chatwoot/i);

    const title = await page.title();
    expect(title, 'document title carries no upstream name').not.toMatch(/chatwoot/i);
  });

  test('profile menu chrome is clean of upstream name', async ({ page }) => {
    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/accounts\/\d+/, { timeout: 20_000 });
    await expect(page.getByText('Conversations').first()).toBeVisible({ timeout: 20_000 });

    // Open the profile dropdown (Docs/Changelog/etc. live here upstream).
    await page.locator('button', { hasText: '@' }).first().click();
    await expect(page.getByRole('button', { name: /log ?out/i })).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body, 'no "Chatwoot" in the profile menu').not.toMatch(/chatwoot/i);
  });
});
