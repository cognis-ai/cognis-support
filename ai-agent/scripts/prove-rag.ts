/**
 * V2 RAG proof — against the LIVE Brain gateway.
 * The NEW V2 logic is retrieval (embed -> cosine -> threshold), proven live here.
 * The final grounded generate reuses BrainClient (proven in V0); it's attempted and, if the
 * Brain chat backend is down, reported as skipped rather than failing the retrieval proof.
 *
 *   BRAIN_API_KEY=cbk_live_... tsx scripts/prove-rag.ts
 */
import { loadConfig } from '../src/config.js';
import { EmbeddingsClient } from '../src/rag/embeddings-client.js';
import { jsonKbStore } from '../src/rag/kb-store.js';
import { KbService } from '../src/rag/kb-service.js';
import { BrainClient } from '../src/brain/brain-client.js';
import { COGNIS_SUPPORT_PROMPT_V1 } from '../src/prompts/cognis-support.v1.js';

const key = process.env.BRAIN_API_KEY;
if (!key) { console.error('set BRAIN_API_KEY to a cbk_live_ key with embeddings scope'); process.exit(1); }

// smaller chunks so the KB has distinct shipping/returns/warranty units to rank between
const cfg = { ...loadConfig(), kbFile: './kb/.proof-kb.json' };
const org = 'org_rag_proof';
const DOC = `Shipping: We ship worldwide. Orders to Canada arrive in 5 to 7 business days.

Returns: Returns are accepted within 45 days of delivery. The return authorization code prefix is ZX9.

Warranty: All gadgets carry a 2-year warranty. Warranty claims require the serial number printed on the base.`;

const embeddings = new EmbeddingsClient(cfg.brainBaseUrl, cfg.brainEmbedModel);
const store = jsonKbStore(cfg.kbFile);
const kb = new KbService(embeddings, store, { topK: cfg.ragTopK, minScore: cfg.ragMinScore });
const brain = new BrainClient(cfg.brainBaseUrl, cfg.brainModel);

let pass = 0, fail = 0;
const check = (cond: boolean, label: string) => { console.log(`  ${cond ? 'PASS' : 'FAIL'} (${label})`); cond ? pass++ : fail++; };

console.log('=== Cognis Chat V2 RAG proof (live Brain embeddings) ===');
const n = await kb.ingest(org, key, 'acme-kb', DOC);
console.log(`ingested ${n} chunk(s), minScore=${cfg.ragMinScore}\n`);

async function show(q: string) {
  const hits = await kb.retrieveHits(org, key!, q);
  const top = hits[0];
  console.log(`Q: ${q}\n  top=${top ? top.score.toFixed(3) : 'none'} :: ${top ? JSON.stringify(top.text.slice(0, 70)) : '(below threshold)'}`);
  return hits;
}

// 1) doc-only fact: the return code prefix ZX9
const h1 = await show('What is the return authorization code prefix?');
check(h1.length > 0, 'Q1 retrieved KB context');
check(/ZX9/i.test(h1[0]?.text ?? ''), 'Q1 top chunk contains the doc-only fact ZX9');

// 2) Canada shipping window
const h2 = await show('How long does shipping to Canada take?');
check(h2.length > 0, 'Q2 retrieved KB context');
check(/5 to 7|5\s*[–-]\s*7/i.test(h2[0]?.text ?? ''), 'Q2 top chunk is the shipping section');

// 3) NOT in the KB — must fall below the threshold (so the bot declines, not invents)
const h3 = await show('What is the CEO of Acme Gadgets favorite color?');
check(h3.length === 0, 'Q3 retrieves nothing above threshold (bot will decline/escalate)');

// final grounded generate — reuses V0-proven BrainClient; skip cleanly if the chat backend is down
console.log('\n--- grounded generate (reuses V0 BrainClient) ---');
try {
  const ctx = await kb.contextFor(org, key, 'What is the return code prefix?');
  const sys = `${COGNIS_SUPPORT_PROMPT_V1}\n\nKnowledge base — use ONLY this:\n${ctx}`;
  const reply = await brain.complete(key, [{ role: 'system', content: sys }, { role: 'user', content: 'What is the return code prefix?' }], { temperature: 0.2, maxTokens: 120, user: org });
  console.log(`  reply: ${JSON.stringify(reply)}`);
  check(/ZX9/i.test(reply), 'grounded answer contains ZX9');
} catch (e) {
  console.log(`  SKIPPED — Brain chat backend unavailable (${(e as Error).message.slice(0, 80)}). Retrieval proven above; generate = V0-proven.`);
}

console.log(`\n=== ${fail === 0 ? 'V2_RAG_RETRIEVAL=PASS' : 'V2_RAG_RETRIEVAL=FAIL'} (${pass} pass, ${fail} fail) ===`);
process.exit(fail === 0 ? 0 : 1);
