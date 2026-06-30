import { EmbeddingsClient } from './embeddings-client.js';
import { chunkText } from './chunk.js';
import type { KbStore, Retrieved } from './kb-store.js';

// Ties embeddings + chunking + the vector store into the two operations the product needs:
// ingest a doc, and produce a grounding-context block for a customer question.
export class KbService {
  constructor(
    private readonly embeddings: EmbeddingsClient,
    private readonly store: KbStore,
    private readonly opts: { topK: number; minScore: number },
  ) {}

  /** Ingest a doc for an org: chunk -> embed (batch, via Brain) -> upsert. Returns #chunks. */
  async ingest(orgId: string, brainApiKey: string, docId: string, text: string): Promise<number> {
    const chunks = chunkText(text);
    if (chunks.length === 0) return 0;
    const vecs = await this.embeddings.embed(brainApiKey, chunks);
    this.store.upsertDoc(orgId, docId, chunks.map((t, i) => ({ text: t, embedding: vecs[i] })));
    return chunks.length;
  }

  /** Retrieve scored hits for a query (used by the agent loop and the proof). */
  async retrieveHits(orgId: string, brainApiKey: string, query: string): Promise<Retrieved[]> {
    const [qv] = await this.embeddings.embed(brainApiKey, [query]);
    if (!qv) return [];
    return this.store.retrieve(orgId, qv, this.opts.topK, this.opts.minScore);
  }

  /** Grounding context block for a question, or null if the KB has nothing relevant. */
  async contextFor(orgId: string, brainApiKey: string, query: string): Promise<string | null> {
    const hits = await this.retrieveHits(orgId, brainApiKey, query);
    if (hits.length === 0) return null;
    return hits.map((h, i) => `[${i + 1}] ${h.text}`).join('\n');
  }
}
