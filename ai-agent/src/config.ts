// Cognis Chat AI sidecar — env config. No platform/Bridge imports.

export interface Config {
  brainBaseUrl: string;
  brainModel: string;
  brainAdminToken: string;
  chatwootBaseUrl: string;
  port: number;
  tenantsFile: string;
  auditFile: string;
  maxHistoryMessages: number;
  temperature: number;
  maxTokens: number;
  brainEmbedModel: string;
  kbFile: string;
  ragTopK: number;
  ragMinScore: number;
  enforceSignature: boolean;
  webhookRpm: number;
}

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing required env ${name}`);
  return v;
}

export function loadConfig(): Config {
  return {
    brainBaseUrl: req('BRAIN_BASE_URL', 'http://localhost:8100/v1').replace(/\/$/, ''),
    brainModel: req('BRAIN_MODEL', 'cognis-brain-default'),
    brainAdminToken: req('BRAIN_ADMIN_TOKEN', 'dev-admin-token'),
    chatwootBaseUrl: req('CHATWOOT_BASE_URL', 'http://localhost:3000').replace(/\/$/, ''),
    port: Number(req('PORT', '4100')),
    tenantsFile: req('TENANTS_FILE', './tenants.json'),
    auditFile: req('AUDIT_FILE', './audit/agent-bot.jsonl'),
    maxHistoryMessages: Number(req('MAX_HISTORY_MESSAGES', '12')),
    temperature: Number(req('LLM_TEMPERATURE', '0.3')),
    maxTokens: Number(req('LLM_MAX_TOKENS', '600')),
    brainEmbedModel: req('BRAIN_EMBED_MODEL', 'cognis-embed'),
    kbFile: req('KB_FILE', './kb/kb.json'),
    ragTopK: Number(req('RAG_TOP_K', '4')),
    ragMinScore: Number(req('RAG_MIN_SCORE', '0.5')),
    enforceSignature: req('WEBHOOK_AUTH_ENFORCE', 'false').toLowerCase() === 'true',
    webhookRpm: Number(req('WEBHOOK_RPM', '120')),
  };
}
