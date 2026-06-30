import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

// Per-tenant knowledge-base vector store. Cosine retrieval in-process (matching the Brain's
// own B3 proof). V2 storage = JSON file; the interface is pgvector-ready — a pgvector-backed
// KbStore can drop in without touching callers (same swap path as the tenant store).

export interface KbChunk {
  orgId: string;
  docId: string;
  text: string;
  embedding: number[];
}

export interface Retrieved {
  text: string;
  docId: string;
  score: number;
}

export interface KbStore {
  /** Replace all chunks for (orgId, docId) with the given ones. */
  upsertDoc(orgId: string, docId: string, items: Array<{ text: string; embedding: number[] }>): void;
  /** Cosine top-k for an org, filtered to scores >= minScore. */
  retrieve(orgId: string, queryEmbedding: number[], topK: number, minScore: number): Retrieved[];
  count(orgId: string): number;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export function jsonKbStore(file: string): KbStore {
  let chunks: KbChunk[] = [];
  if (existsSync(file)) {
    try {
      chunks = JSON.parse(readFileSync(file, 'utf8')) as KbChunk[];
    } catch {
      chunks = [];
    }
  }
  const persist = () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(chunks));
  };
  return {
    upsertDoc(orgId, docId, items) {
      chunks = chunks.filter((c) => !(c.orgId === orgId && c.docId === docId));
      for (const it of items) chunks.push({ orgId, docId, text: it.text, embedding: it.embedding });
      persist();
    },
    retrieve(orgId, queryEmbedding, topK, minScore) {
      return chunks
        .filter((c) => c.orgId === orgId)
        .map((c) => ({ text: c.text, docId: c.docId, score: cosine(queryEmbedding, c.embedding) }))
        .filter((r) => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    },
    count: (orgId) => chunks.filter((c) => c.orgId === orgId).length,
  };
}
