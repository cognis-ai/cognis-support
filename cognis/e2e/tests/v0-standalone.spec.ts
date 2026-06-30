import { test, expect, request, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import { BASE_URL } from '../env';

// V0 STANDALONE PROOF (repeatable): a customer message in a live Chatwoot inbox is answered
// by the standalone AI sidecar (ai-agent :4100) via the Cognis Brain gateway — NO Bridge.
//
// Delivery note: the fork's ssrf_filter blocks Chatwoot's NATIVE outbound webhook to a
// private-IP sidecar (host.docker.internal/LAN) — correct prod security. So this test
// delivers the EXACT payload Chatwoot generates to the sidecar itself. The sidecar's
// history-read, Brain call, and reply-post are all real against live services. In prod
// (public sidecar URL) Chatwoot delivers natively.
//
// Prereqs: ai-agent/scripts/provision-demo.ts has run (inbox "Cognis Chat V0" + agent bot
// + tenants.json), and the sidecar is up on :4100.
const AUTH_FILE = '.auth/admin.json';
const INBOX_NAME = process.env.CW_INBOX_NAME ?? 'Cognis Chat V0';
const SIDECAR = process.env.SIDECAR_URL ?? 'http://localhost:4100';
const STAMP = Date.now();
const QUESTION = `My order #${STAMP % 10000} has not arrived, what should I do?`;

let api: APIRequestContext;
let authHeaders: Record<string, string>;
let accountId: number;
let inboxId: number;
let conversationId: number;
let aiReply = '';

function tokenFromStorageState(): Record<string, string> {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const cookie = state.cookies.find((c: { name: string }) => c.name === 'cw_d_session_info');
  if (!cookie) throw new Error('cw_d_session_info missing — run auth.setup');
  const info = JSON.parse(decodeURIComponent(cookie.value));
  return { 'access-token': info['access-token'], client: info.client, uid: info.uid };
}

test.beforeAll(async () => {
  authHeaders = tokenFromStorageState();
  api = await request.newContext({ baseURL: BASE_URL });
  const profile = await (await api.get('/api/v1/profile', { headers: authHeaders })).json();
  accountId = profile.account_id ?? profile.accounts?.[0]?.id;
  expect(accountId, 'admin must belong to an account').toBeTruthy();
  const inboxes = (await (await api.get(`/api/v1/accounts/${accountId}/inboxes`, { headers: authHeaders })).json()).payload ?? [];
  const inbox = inboxes.find((i: { name: string }) => i.name === INBOX_NAME);
  expect(inbox, `inbox "${INBOX_NAME}" must exist — run provision-demo.ts first`).toBeTruthy();
  inboxId = inbox.id;
});

test('AI sidecar answers a customer message via the Brain gateway (no Bridge)', async () => {
  const contact = await (
    await api.post(`/api/v1/accounts/${accountId}/contacts`, {
      headers: authHeaders,
      data: { name: `Probe ${STAMP}`, email: `v0-${STAMP}@cognis.io` },
    })
  ).json();
  const contactId = contact.payload?.contact?.id ?? contact.payload?.id;
  expect(contactId).toBeTruthy();

  const conv = await (
    await api.post(`/api/v1/accounts/${accountId}/conversations`, {
      headers: authHeaders,
      data: { inbox_id: inboxId, contact_id: contactId, status: 'open' },
    })
  ).json();
  conversationId = conv.id;
  expect(conversationId).toBeTruthy();

  // real INCOMING customer message
  const im = await (
    await api.post(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
      headers: authHeaders,
      data: { content: QUESTION, message_type: 'incoming' },
    })
  ).json();
  expect(im.message_type, 'message must be incoming (0)').toBe(0);

  // deliver the exact Chatwoot agent-bot webhook payload to the sidecar
  const wh = await api.post(`${SIDECAR}/agent-bot/webhook`, {
    data: { event: 'message_created', message_type: 0, private: false, content: QUESTION, account: { id: accountId }, conversation: { id: conversationId } },
  });
  expect(wh.status(), 'sidecar must accept the webhook').toBe(200);

  // poll for the AI reply (outgoing, distinct from the question)
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const msgs = (await (await api.get(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, { headers: authHeaders })).json()).payload ?? [];
    const reply = msgs.find((m: { message_type: number; private: boolean; content?: string }) =>
      m.message_type === 1 && !m.private && typeof m.content === 'string' && m.content.trim().length > 0 && m.content.trim() !== QUESTION);
    if (reply) { aiReply = reply.content.trim(); break; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`[v0] AI reply: ${JSON.stringify(aiReply)}`);
  expect(aiReply, 'sidecar must post an AI reply within 90s').toBeTruthy();
});

test('AI reply is visible in the agent dashboard (headed + screenshot)', async ({ page }) => {
  test.skip(!conversationId || !aiReply, 'no reply from the previous test');
  await page.goto(`/app/accounts/${accountId}/conversations/${conversationId}`);
  await expect(page.getByText(aiReply.slice(0, 30), { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'v0-standalone-proof.png', fullPage: true });
  console.log('[v0] screenshot saved: v0-standalone-proof.png');
});
