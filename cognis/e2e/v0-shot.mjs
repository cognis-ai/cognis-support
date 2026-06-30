// Headed screenshot of the V0 proof: the AI reply (from the standalone sidecar via the
// Brain gateway) visible in the live Chatwoot dashboard. Targets the already-proven conv.
import { chromium } from 'playwright';

const BASE = process.env.CW_BASE_URL ?? 'http://localhost:3100';
const EMAIL = process.env.CW_ADMIN_EMAIL ?? 'admin@cognis.io';
const PASS = process.env.CW_ADMIN_PASS ?? 'Password1!';
const ACCOUNT = process.env.CW_ACCOUNT_ID ?? '3';
const CONV = process.env.CW_CONV_ID ?? '3';
const WAIT_TEXT = process.env.CW_WAIT_TEXT ?? 'tracking number';
const SHOT = process.env.CW_SHOT_PATH ?? 'v0-standalone-proof.png';

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
ctx.setDefaultTimeout(90_000);
ctx.setDefaultNavigationTimeout(90_000);
const page = await ctx.newPage();

console.log('[shot] login…');
await page.goto(`${BASE}/app/login`, { waitUntil: 'domcontentloaded' });
await page.locator('[data-testid="email_input"] input, input[name="email_address"]').first().fill(EMAIL);
await page.locator('[data-testid="password_input"] input, input[name="password"]').first().fill(PASS);
await page.locator('[data-testid="submit_button"]').click();
await page.waitForURL(/\/app\/accounts\/\d+/, { timeout: 90_000 });
console.log('[shot] logged in:', page.url());

if (/\/onboarding/.test(page.url())) {
  await page.getByRole('button', { name: /continue/i }).click().catch(() => {});
}

console.log('[shot] open conversation…');
await page.goto(`${BASE}/app/accounts/${ACCOUNT}/conversations/${CONV}`, { waitUntil: 'domcontentloaded' });
// the AI reply text — a distinctive fragment of the contextual answer
await page.waitForSelector(`text=${WAIT_TEXT}`, { timeout: 90_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOT, fullPage: true });
console.log(`[shot] saved ${SHOT}`);

await browser.close();
