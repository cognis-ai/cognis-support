/**
 * V0 provisioning — wire a live Chatwoot to the standalone sidecar + Brain.
 * Idempotent. Run once Chatwoot (:3000) and the Brain gateway (:8100) are up.
 *
 *   tsx scripts/provision-demo.ts
 *
 * Steps: signup-or-login admin -> get persistent token + account -> create API inbox ->
 * create Agent Bot (outgoing_url -> sidecar) -> attach bot to inbox -> mint per-org Brain
 * key -> write tenants.json. Prints the inbox id for the e2e.
 */

const CW = (process.env.CHATWOOT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const BRAIN = (process.env.BRAIN_BASE_URL ?? 'http://localhost:8100/v1').replace(/\/v1$/, '');
const BRAIN_ADMIN = process.env.BRAIN_ADMIN_TOKEN ?? 'dev-admin-token';
const SIDECAR_WEBHOOK =
  process.env.SIDECAR_WEBHOOK ?? 'http://host.docker.internal:4100/agent-bot/webhook';
const EMAIL = process.env.CW_ADMIN_EMAIL ?? 'admin@cognis.io';
const PASS = process.env.CW_ADMIN_PASS ?? 'Password1!';
const ORG = process.env.COGNIS_ORG_ID ?? 'org_demo';
const ACCOUNT_NAME = 'Cognis Demo';
const INBOX_NAME = 'Cognis Chat V0';
const BOT_NAME = 'Cognis Chat AI';

interface DtaHeaders { 'access-token': string; client: string; uid: string }

async function jsonOrText(r: Response): Promise<unknown> {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
}

function dtaFrom(r: Response): DtaHeaders | null {
  const at = r.headers.get('access-token');
  const cl = r.headers.get('client');
  const uid = r.headers.get('uid');
  return at && cl && uid ? { 'access-token': at, client: cl, uid } : null;
}

async function signupOrLogin(): Promise<DtaHeaders> {
  // Try self-signup (ENABLE_ACCOUNT_SIGNUP=true). If the user already exists, log in.
  const su = await fetch(`${CW}/api/v1/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_name: ACCOUNT_NAME, user_full_name: 'Cognis Admin', email: EMAIL, password: PASS }),
  });
  const suHeaders = dtaFrom(su);
  if (su.ok && suHeaders) { console.log('[provision] signed up new admin'); return suHeaders; }
  console.log(`[provision] signup -> ${su.status} (${JSON.stringify(await jsonOrText(su)).slice(0, 120)}); trying login`);

  const li = await fetch(`${CW}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const liHeaders = dtaFrom(li);
  if (!li.ok || !liHeaders) throw new Error(`login failed: ${li.status} ${JSON.stringify(await jsonOrText(li))}`);
  console.log('[provision] logged in existing admin');
  return liHeaders;
}

async function api(path: string, h: DtaHeaders, init: RequestInit = {}): Promise<Response> {
  return fetch(`${CW}${path}`, {
    ...init,
    headers: { ...(h as unknown as Record<string, string>), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function main(): Promise<void> {
  const h = await signupOrLogin();

  const profileRes = await api('/api/v1/profile', h);
  const profile = (await profileRes.json()) as { id: number; account_id?: number; accounts?: { id: number }[]; access_token: string };
  const accountId = profile.account_id ?? profile.accounts?.[0]?.id;
  if (!accountId) throw new Error('no account on profile');
  const adminUserToken = profile.access_token; // persistent api_access_token
  console.log(`[provision] account=${accountId} agent=${profile.id} adminToken=${adminUserToken.slice(0, 6)}…`);

  // inbox (API channel — agent-bot webhooks fire on message_created regardless of channel)
  const inboxesRes = await api(`/api/v1/accounts/${accountId}/inboxes`, h);
  const inboxes = ((await inboxesRes.json()) as { payload?: { id: number; name: string }[] }).payload ?? [];
  let inbox = inboxes.find((i) => i.name === INBOX_NAME);
  if (!inbox) {
    const r = await api(`/api/v1/accounts/${accountId}/inboxes`, h, {
      method: 'POST',
      body: JSON.stringify({ name: INBOX_NAME, channel: { type: 'api', webhook_url: '' } }),
    });
    if (!r.ok) throw new Error(`inbox create failed: ${r.status} ${JSON.stringify(await jsonOrText(r))}`);
    inbox = (await r.json()) as { id: number; name: string };
    console.log(`[provision] created inbox ${inbox.id}`);
  } else console.log(`[provision] inbox ${inbox.id} exists`);

  // agent bot
  const botsRes = await api(`/api/v1/accounts/${accountId}/agent_bots`, h);
  const bots = ((await jsonOrText(botsRes)) as { id: number; name: string; access_token?: string }[]) || [];
  let bot = Array.isArray(bots) ? bots.find((b) => b.name === BOT_NAME) : undefined;
  if (!bot) {
    const r = await api(`/api/v1/accounts/${accountId}/agent_bots`, h, {
      method: 'POST',
      body: JSON.stringify({ name: BOT_NAME, description: 'Cognis Chat standalone AI', outgoing_url: SIDECAR_WEBHOOK }),
    });
    if (!r.ok) throw new Error(`agent_bot create failed: ${r.status} ${JSON.stringify(await jsonOrText(r))}`);
    bot = (await r.json()) as { id: number; name: string; access_token?: string };
    console.log(`[provision] created agent bot ${bot.id}`);
  } else console.log(`[provision] agent bot ${bot.id} exists`);

  // bot access token + webhook secret — fetch the single bot (list may omit them)
  const one = (await jsonOrText(await api(`/api/v1/accounts/${accountId}/agent_bots/${bot.id}`, h))) as {
    access_token?: string;
    secret?: string;
  };
  const agentBotToken = bot.access_token ?? one.access_token;
  const webhookSecret = one.secret;
  if (!agentBotToken) throw new Error('could not read agent bot access_token');
  if (!webhookSecret) console.warn('[provision] agent bot has no `secret` exposed — webhook HMAC will be unverifiable');

  // attach bot to inbox
  const setRes = await api(`/api/v1/accounts/${accountId}/inboxes/${inbox.id}/set_agent_bot`, h, {
    method: 'POST',
    body: JSON.stringify({ agent_bot: bot.id }),
  });
  if (!setRes.ok) throw new Error(`set_agent_bot failed: ${setRes.status} ${JSON.stringify(await jsonOrText(setRes))}`);
  console.log(`[provision] attached bot ${bot.id} -> inbox ${inbox.id}`);

  // mint per-org Brain key
  const mint = await fetch(`${BRAIN}/admin/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': BRAIN_ADMIN },
    body: JSON.stringify({ organization_id: ORG, app_label: 'cognis-chat', scopes: { endpoints: ['chat', 'completions', 'embeddings'], model_tiers: ['default'] }, rpm_limit: 600 }),
  });
  if (!mint.ok) throw new Error(`brain mint failed: ${mint.status} ${await mint.text()}`);
  const brainApiKey = ((await mint.json()) as { api_key: string }).api_key;
  console.log(`[provision] minted per-org Brain key ${brainApiKey.slice(0, 16)}…`);

  // write tenants.json
  const tenants = [{ chatwootAccountId: accountId, cognisOrgId: ORG, adminUserToken, agentBotToken, brainApiKey, webhookSecret }];
  const fs = await import('node:fs');
  fs.writeFileSync('tenants.json', JSON.stringify(tenants, null, 2));
  console.log(`[provision] wrote tenants.json (account ${accountId} -> ${ORG})`);
  console.log(`[provision] DONE. inbox_id=${inbox.id} account_id=${accountId} — set CW_INBOX_ID=${inbox.id} for the e2e.`);
}

main().catch((e) => { console.error(`[provision] FAILED: ${(e as Error).message}`); process.exit(1); });
