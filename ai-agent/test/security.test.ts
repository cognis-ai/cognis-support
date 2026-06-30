import { describe, it, expect } from 'vitest';
import { signBody, verifyChatwootSignature } from '../src/security/webhook-auth.js';
import { RateLimiter } from '../src/security/rate-limit.js';

describe('verifyChatwootSignature', () => {
  const secret = 'bot-secret-xyz';
  const ts = '1782668935';
  const body = '{"event":"message_created","account":{"id":3}}';

  it('accepts a correctly signed payload', () => {
    const sig = signBody(secret, ts, body);
    expect(verifyChatwootSignature(secret, ts, body, sig)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = signBody(secret, ts, body);
    expect(verifyChatwootSignature(secret, ts, body + ' ', sig)).toBe(false);
  });

  it('rejects a wrong secret, wrong timestamp, and missing header', () => {
    const sig = signBody(secret, ts, body);
    expect(verifyChatwootSignature('other', ts, body, sig)).toBe(false);
    expect(verifyChatwootSignature(secret, '0', body, sig)).toBe(false);
    expect(verifyChatwootSignature(secret, ts, body, undefined)).toBe(false);
    expect(verifyChatwootSignature(secret, undefined, body, sig)).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('allows up to the limit in a window, then blocks, then resets next window', () => {
    const rl = new RateLimiter(3, 60_000);
    const t = 1_000_000;
    expect(rl.allow('ip', t)).toBe(true);
    expect(rl.allow('ip', t)).toBe(true);
    expect(rl.allow('ip', t)).toBe(true);
    expect(rl.allow('ip', t)).toBe(false); // 4th in window
    expect(rl.allow('ip', t + 60_000)).toBe(true); // next window
  });

  it('isolates keys and treats limit<=0 as disabled', () => {
    const rl = new RateLimiter(1);
    const t = 2_000_000;
    expect(rl.allow('a', t)).toBe(true);
    expect(rl.allow('a', t)).toBe(false);
    expect(rl.allow('b', t)).toBe(true); // different key
    expect(new RateLimiter(0).allow('x', t)).toBe(true); // disabled
  });
});
