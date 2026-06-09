import { test, expect, request, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import { BASE_URL } from '../env';

// Core conversation flow. The provisioned account starts empty (no inboxes /
// conversations), so we seed minimal data through the public REST API and then
// verify the agent UI renders and drives it.
//
// API credentials are recovered from the storageState written by auth.setup —
// the cw_d_session_info cookie holds the devise-token-auth headers — so this
// file performs ZERO extra /auth/sign_in calls (Rack::Attack budget).
const AUTH_FILE = '.auth/admin.json';
const INBOX_NAME = 'Cognis E2E';
const STAMP = Date.now();
const CONTACT_NAME = `Playwright Probe ${STAMP}`;
const FIRST_MESSAGE = `Hello from the Cognis e2e probe (${STAMP})`;

let api: APIRequestContext;
let authHeaders: Record<string, string>;
let accountId: number;
let conversationId: number;

function tokenFromStorageState(): { headers: Record<string, string>; uid: string } {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const cookie = state.cookies.find((c: { name: string }) => c.name === 'cw_d_session_info');
  if (!cookie) throw new Error('cw_d_session_info missing from storage state — run auth.setup');
  const info = JSON.parse(decodeURIComponent(cookie.value));
  return {
    headers: {
      'access-token': info['access-token'],
      client: info.client,
      uid: info.uid,
    },
    uid: info.uid,
  };
}

test.beforeAll(async () => {
  const token = tokenFromStorageState();
  authHeaders = token.headers;
  api = await request.newContext({ baseURL: BASE_URL });

  // Resolve the account + agent id from the token's own profile.
  const profile = await api.get('/api/v1/profile', { headers: authHeaders });
  expect(profile.ok(), `profile fetch failed: ${profile.status()}`).toBeTruthy();
  const me = await profile.json();
  accountId = me.account_id ?? me.accounts?.[0]?.id;
  const agentId = me.id;
  expect(accountId, 'admin must belong to an account').toBeTruthy();

  // Ensure an API-channel inbox exists (idempotent across runs).
  const inboxesRes = await api.get(`/api/v1/accounts/${accountId}/inboxes`, {
    headers: authHeaders,
  });
  expect(inboxesRes.ok()).toBeTruthy();
  const inboxes = (await inboxesRes.json()).payload ?? [];
  let inbox = inboxes.find((i: { name: string }) => i.name === INBOX_NAME);
  if (!inbox) {
    const createInbox = await api.post(`/api/v1/accounts/${accountId}/inboxes`, {
      headers: authHeaders,
      data: { name: INBOX_NAME, channel: { type: 'api', webhook_url: '' } },
    });
    expect(createInbox.ok(), `inbox create failed: ${createInbox.status()}`).toBeTruthy();
    inbox = await createInbox.json();
  }

  // Fresh contact per run (unique email avoids 422 duplicates).
  const createContact = await api.post(`/api/v1/accounts/${accountId}/contacts`, {
    headers: authHeaders,
    data: { name: CONTACT_NAME, email: `e2e-probe-${STAMP}@cognis.io` },
  });
  expect(createContact.ok(), `contact create failed: ${createContact.status()}`).toBeTruthy();
  const contactJson = await createContact.json();
  const contactId = contactJson.payload?.contact?.id ?? contactJson.payload?.id;
  expect(contactId).toBeTruthy();

  // Conversation with an inbound message, assigned to the admin agent so it
  // surfaces in the default "Mine" tab of the conversation list.
  const createConv = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
    headers: authHeaders,
    data: {
      inbox_id: inbox.id,
      contact_id: contactId,
      status: 'open',
      assignee_id: agentId,
      message: { content: FIRST_MESSAGE },
    },
  });
  expect(createConv.ok(), `conversation create failed: ${createConv.status()}`).toBeTruthy();
  conversationId = (await createConv.json()).id;
  expect(conversationId).toBeTruthy();
});

test.afterAll(async () => {
  await api?.dispose();
});

test.describe('Cognis Support — core conversation flow', () => {
  test('conversation list shows the seeded conversation', async ({ page }) => {
    await page.goto(`/app/accounts/${accountId}/dashboard`);
    // The chat list renders the seeded contact's conversation card.
    await expect(page.getByText(CONTACT_NAME).first()).toBeVisible({ timeout: 20_000 });
  });

  test('opening the conversation shows the inbound message and accepts a reply', async ({
    page,
  }) => {
    const reply = `Cognis agent reply (${STAMP})`;
    await page.goto(`/app/accounts/${accountId}/conversations/${conversationId}`);

    // Inbound message is rendered in the thread.
    await expect(page.getByText(FIRST_MESSAGE).first()).toBeVisible({ timeout: 20_000 });

    // Compose and send a reply through the rich-text editor.
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.pressSequentially(reply, { delay: 10 });
    await page.keyboard.press('Control+Enter');

    // The outgoing message appears in the thread (API-backed, so it persisted).
    await expect(page.getByText(reply).first()).toBeVisible({ timeout: 20_000 });
  });
});
