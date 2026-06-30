import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../src/server.js';
import { RateLimiter } from '../src/security/rate-limit.js';
import { signBody } from '../src/security/webhook-auth.js';
import type { AgentBotService } from '../src/agent-bot.service.js';

const SECRET = 'bot-secret-xyz';
const TS = '1782668935';
const bodyStr = JSON.stringify({ event: 'message_created', message_type: 0, account: { id: 3 }, conversation: { id: 9 } });

function make(enforce: boolean, rpm = 120) {
  const handleWebhook = vi.fn().mockResolvedValue(undefined);
  const service = { handleWebhook } as unknown as AgentBotService;
  const app = buildServer(service, {
    resolveWebhookSecret: (id) => (id === 3 ? SECRET : undefined),
    enforceSignature: enforce,
    rateLimiter: new RateLimiter(rpm),
  });
  return { app, handleWebhook };
}

const post = (app: ReturnType<typeof make>['app'], headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url: '/agent-bot/webhook', payload: bodyStr, headers: { 'content-type': 'application/json', ...headers } });

describe('server /agent-bot/webhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('healthz is ok', async () => {
    const { app } = make(false);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('enforced: rejects missing/invalid signature with 401, no handling', async () => {
    const { app, handleWebhook } = make(true);
    const res = await post(app); // no signature headers
    expect(res.statusCode).toBe(401);
    expect(handleWebhook).not.toHaveBeenCalled();
  });

  it('enforced: accepts a correctly signed webhook (200, handled)', async () => {
    const { app, handleWebhook } = make(true);
    const sig = signBody(SECRET, TS, bodyStr);
    const res = await post(app, { 'x-chatwoot-timestamp': TS, 'x-chatwoot-signature': sig });
    expect(res.statusCode).toBe(200);
    expect(handleWebhook).toHaveBeenCalledOnce();
  });

  it('not enforced: processes without a signature', async () => {
    const { app, handleWebhook } = make(false);
    const res = await post(app);
    expect(res.statusCode).toBe(200);
    expect(handleWebhook).toHaveBeenCalledOnce();
  });

  it('rate limits per IP with 429 over the cap', async () => {
    const { app } = make(false, 2);
    expect((await post(app)).statusCode).toBe(200);
    expect((await post(app)).statusCode).toBe(200);
    expect((await post(app)).statusCode).toBe(429);
  });
});
