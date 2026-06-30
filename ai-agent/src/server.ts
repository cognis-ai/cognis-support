import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { ChatwootWebhookSchema } from './chatwoot/dto.js';
import type { AgentBotService } from './agent-bot.service.js';
import { verifyChatwootSignature } from './security/webhook-auth.js';
import { RateLimiter } from './security/rate-limit.js';

export interface ServerOptions {
  /** Resolve a tenant's Chatwoot agent-bot webhook secret by account id (for HMAC verify). */
  resolveWebhookSecret: (accountId: number) => string | undefined;
  /** Enforce the X-Chatwoot-Signature HMAC (V3). Off in dev for back-compat. */
  enforceSignature: boolean;
  rateLimiter: RateLimiter;
}

// Capture the raw JSON string (needed for HMAC) while still parsing the body.
function withRawBody(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as FastifyRequest & { rawBody?: string }).rawBody = body as string;
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });
}

export function buildServer(service: AgentBotService, opts: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  withRawBody(app);

  app.get('/healthz', async () => ({ status: 'ok', service: 'cognis-chat-ai-agent' }));

  app.post('/agent-bot/webhook', async (request, reply) => {
    // 1) edge rate limit (per client IP)
    if (!opts.rateLimiter.allow(request.ip)) {
      return reply.code(429).send({ error: 'rate_limited' });
    }

    const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody ?? '';
    const parsed = ChatwootWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn(`webhook payload failed schema: ${parsed.error.message.slice(0, 200)}`);
      return reply.code(200).send({ received: true }); // 200 so Chatwoot doesn't retry junk
    }

    // 2) HMAC verification (V3). Secret is per-tenant (the agent bot's `secret`).
    if (opts.enforceSignature) {
      const accountId = parsed.data.account?.id;
      const secret = accountId !== undefined ? opts.resolveWebhookSecret(accountId) : undefined;
      const ts = request.headers['x-chatwoot-timestamp'] as string | undefined;
      const sig = request.headers['x-chatwoot-signature'] as string | undefined;
      if (!secret || !verifyChatwootSignature(secret, ts, rawBody, sig)) {
        request.log.warn(`webhook signature rejected (account=${accountId ?? '?'})`);
        return reply.code(401).send({ error: 'invalid_signature' });
      }
    }

    // 3) fire-and-forget so Chatwoot doesn't retry on slow LLM responses
    void service
      .handleWebhook(parsed.data)
      .catch((err) => request.log.error(`agent-bot handling failed: ${(err as Error).message}`));
    return reply.code(200).send({ received: true });
  });

  return app;
}
