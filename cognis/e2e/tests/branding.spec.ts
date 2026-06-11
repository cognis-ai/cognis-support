import { test, expect } from '@playwright/test';

// Brand-integrity checks: the product must present as "Cognis Support", not the
// upstream name. The ONLY permitted upstream mention is a license-required
// attribution (Chatwoot is MIT-licensed); nothing in the visible chrome may
// read "Chatwoot".
const BRAND = 'Cognis Support';

// Brand primary — design-tokens `color.brand.primary` (canonical value from
// cognis-platform/packages/design-tokens/tokens.json). Q1 (brand primary vs
// per-product accent) defaulted to the canonical primary per the theming spec.
const BRAND_PRIMARY = '#0099ff';

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

  // ── Brand asset integrity (theming spec §6.1–§6.4) ─────────────────────────
  // The parity ledger noted the suite "tests visible text, not the logo image";
  // these close that gap and kill the silent-404 class of W5.1 regressions.

  test('cognis brand SVGs are served with an SVG content type', async ({ page }) => {
    for (const asset of ['cognis-logo.svg', 'cognis-logo-dark.svg', 'cognis-thumbnail.svg']) {
      const res = await page.request.get(`/brand-assets/${asset}`);
      expect(res.status(), `${asset} responds 200`).toBe(200);
      expect(
        res.headers()['content-type'] ?? '',
        `${asset} served as SVG`
      ).toContain('image/svg');
    }
  });

  test('login page logo image actually resolves (not a broken img)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/app/login');

    const logo = page.locator('img[src*="cognis-logo"]').first();
    await expect(logo).toBeVisible();
    const naturalWidth = await logo.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(naturalWidth, 'logo <img> decoded to a real image').toBeGreaterThan(0);
    await ctx.close();
  });

  test('PWA + browser chrome use the brand primary, not upstream blue', async ({ page }) => {
    const res = await page.request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.theme_color).toBe(BRAND_PRIMARY);
    expect(manifest.background_color).toBe(BRAND_PRIMARY);

    await page.goto('/app/login');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe(BRAND_PRIMARY);
  });

  test('favicon swap pair is intact (unread-badge feature contract)', async ({ page }) => {
    // faviconHelper.js swaps /favicon-{size}.png <-> /favicon-badge-{size}.png
    // on unread — both halves of the pair must exist under the exact names.
    for (const icon of ['/favicon-32x32.png', '/favicon-badge-32x32.png']) {
      const res = await page.request.get(icon);
      expect(res.status(), `${icon} responds 200`).toBe(200);
      expect(res.headers()['content-type'] ?? '', `${icon} is a PNG`).toContain('image/png');
    }
  });
});
