// Live smoke: prove src/brain/brain-client.ts works against the real Brain gateway.
// Usage: BRAIN_API_KEY=cbk_live_... tsx scripts/smoke-brain.ts
import { BrainClient } from '../src/brain/brain-client.js';

const baseUrl = (process.env.BRAIN_BASE_URL ?? 'http://localhost:8100/v1').replace(/\/$/, '');
const model = process.env.BRAIN_MODEL ?? 'cognis-brain-default';
const key = process.env.BRAIN_API_KEY;
if (!key) {
  console.error('set BRAIN_API_KEY to a cbk_live_ key');
  process.exit(1);
}

const brain = new BrainClient(baseUrl, model);
const reply = await brain.complete(
  key,
  [
    { role: 'system', content: 'You are Cognis Support. Plain words, short.' },
    { role: 'user', content: 'Where is my order?' },
  ],
  { temperature: 0.3, maxTokens: 80, user: 'org_demo' },
);
console.log(`[smoke-brain] base=${baseUrl} model=${model}`);
console.log(`[smoke-brain] reply: ${JSON.stringify(reply)}`);
if (!reply) {
  console.error('[smoke-brain] FAIL: empty reply');
  process.exit(1);
}
console.log('[smoke-brain] PASS — sidecar BrainClient -> live gateway -> qwen3-0.6b');
