// Ingest a doc into an org's knowledge base.
//   tsx scripts/ingest-kb.ts <org_id> <brain_key> <doc_id> <file>
// Reuses the Brain's shared embeddings (cognis-embed). Writes to KB_FILE.
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { EmbeddingsClient } from '../src/rag/embeddings-client.js';
import { jsonKbStore } from '../src/rag/kb-store.js';
import { KbService } from '../src/rag/kb-service.js';

const [orgId, brainKey, docId, file] = process.argv.slice(2);
if (!orgId || !brainKey || !docId || !file) {
  console.error('usage: tsx scripts/ingest-kb.ts <org_id> <brain_key> <doc_id> <file>');
  process.exit(1);
}

const cfg = loadConfig();
const kb = new KbService(new EmbeddingsClient(cfg.brainBaseUrl, cfg.brainEmbedModel), jsonKbStore(cfg.kbFile), {
  topK: cfg.ragTopK,
  minScore: cfg.ragMinScore,
});

const text = readFileSync(file, 'utf8');
const n = await kb.ingest(orgId, brainKey, docId, text);
console.log(`ingested ${n} chunk(s) from ${file} into org=${orgId} doc=${docId} (KB_FILE=${cfg.kbFile})`);
