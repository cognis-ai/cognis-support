import { loadConfig } from './config.js';
import { loadJsonTenants } from './store/tenant-store.js';
import { ChatwootConversationClient } from './chatwoot/conversation-client.js';
import { BrainClient } from './brain/brain-client.js';
import { AgentBotService } from './agent-bot.service.js';
import { fileAuditSink } from './audit/file-audit.js';
import { EmbeddingsClient } from './rag/embeddings-client.js';
import { jsonKbStore } from './rag/kb-store.js';
import { KbService } from './rag/kb-service.js';
import { RateLimiter } from './security/rate-limit.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const tenants = loadJsonTenants(config.tenantsFile);
  const conversation = new ChatwootConversationClient(config.chatwootBaseUrl);
  const brain = new BrainClient(config.brainBaseUrl, config.brainModel);

  // Chat's own audit store — append-only JSONL, org-stamped + prompt-versioned (+ stdout mirror).
  const audit = fileAuditSink(config.auditFile);

  // RAG (V2): KB grounding via the Brain's shared embeddings + a per-tenant vector store.
  const embeddings = new EmbeddingsClient(config.brainBaseUrl, config.brainEmbedModel);
  const kb = new KbService(embeddings, jsonKbStore(config.kbFile), {
    topK: config.ragTopK,
    minScore: config.ragMinScore,
  });

  const service = new AgentBotService(config, tenants, conversation, brain, audit, console.log, kb);
  const app = buildServer(service, {
    resolveWebhookSecret: (accountId) => tenants.resolveByAccountId(accountId)?.webhookSecret,
    enforceSignature: config.enforceSignature,
    rateLimiter: new RateLimiter(config.webhookRpm),
  });

  await app.listen({ host: '0.0.0.0', port: config.port });
  app.log.info(
    `cognis-chat-ai-agent up :${config.port} — Brain=${config.brainBaseUrl} model=${config.brainModel}, ` +
      `${tenants.all().length} tenant(s), Chatwoot=${config.chatwootBaseUrl}, ` +
      `webhook-auth=${config.enforceSignature ? 'enforced' : 'off'}, rpm=${config.webhookRpm}`,
  );
}

main().catch((err) => {
  console.error(`fatal: ${(err as Error).message}`);
  process.exit(1);
});
