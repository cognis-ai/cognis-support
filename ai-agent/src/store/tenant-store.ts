import { readFileSync } from 'node:fs';

// Multi-tenant resolution: Chatwoot account_id -> org + tokens + per-org Brain key.
// Replaces Bridge's Prisma ChatwootAccount/LitellmTeam/LlmRoutingConfig lookups.
// V0 storage = JSON file. The interface is Postgres-ready (swap loadJsonTenants for a
// DB-backed impl without touching callers).

export interface Tenant {
  /** Chatwoot account id — the tenancy root carried on every webhook. */
  chatwootAccountId: number;
  /** Cognis org id — stamped on every persisted row / audit / RAG query. */
  cognisOrgId: string;
  /** Chatwoot admin user token (reads conversation history). */
  adminUserToken: string;
  /** Chatwoot agent-bot token (posts replies, toggles status). */
  agentBotToken: string;
  /** This org's OWN Brain key (cbk_live_...). Per-org isolation + metering at the gateway. */
  brainApiKey: string;
  /** Chatwoot agent-bot `secret` — verifies the inbound webhook HMAC (V3). Optional pre-V3. */
  webhookSecret?: string;
}

export interface TenantStore {
  resolveByAccountId(accountId: number): Tenant | undefined;
  all(): Tenant[];
}

const TenantShape = (t: unknown): t is Tenant => {
  const o = t as Record<string, unknown>;
  return (
    typeof o?.chatwootAccountId === 'number' &&
    typeof o?.cognisOrgId === 'string' &&
    typeof o?.adminUserToken === 'string' &&
    typeof o?.agentBotToken === 'string' &&
    typeof o?.brainApiKey === 'string' &&
    (o?.webhookSecret === undefined || typeof o?.webhookSecret === 'string')
  );
};

export function loadJsonTenants(file: string): TenantStore {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`tenant store: cannot read ${file}: ${(err as Error).message}`);
  }
  const list = Array.isArray(raw) ? raw : (raw as { tenants?: unknown[] })?.tenants;
  if (!Array.isArray(list)) throw new Error(`tenant store: ${file} must be an array or {tenants:[]}`);
  const tenants: Tenant[] = [];
  for (const t of list) {
    if (!TenantShape(t)) throw new Error(`tenant store: invalid tenant entry: ${JSON.stringify(t)}`);
    tenants.push(t);
  }
  const byAccount = new Map<number, Tenant>(tenants.map((t) => [t.chatwootAccountId, t]));
  return {
    resolveByAccountId: (accountId) => byAccount.get(accountId),
    all: () => tenants,
  };
}
