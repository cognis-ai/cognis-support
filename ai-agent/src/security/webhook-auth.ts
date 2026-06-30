import { createHmac, timingSafeEqual } from 'node:crypto';

// Verify Chatwoot's agent-bot webhook HMAC (V3). Chatwoot signs with the agent bot's
// `secret` (app/listeners/agent_bot_listener.rb -> lib/webhooks/trigger.rb):
//   X-Chatwoot-Timestamp: <ts>
//   X-Chatwoot-Signature:  sha256=HMAC_SHA256(secret, "<ts>.<rawBody>")

export function signBody(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export function verifyChatwootSignature(
  secret: string,
  timestamp: string | undefined,
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  if (!secret || !timestamp || !signatureHeader) return false;
  const expected = signBody(secret, timestamp, rawBody);
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  // length check first so timingSafeEqual doesn't throw on mismatched sizes
  return a.length === b.length && timingSafeEqual(a, b);
}
