import { describe, it, expect } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { jsonKbStore, cosine } from '../src/rag/kb-store.js';
import { chunkText } from '../src/rag/chunk.js';

describe('cosine', () => {
  it('is 1 for identical, ~0 for orthogonal', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe('chunkText', () => {
  it('packs paragraphs into bounded chunks', () => {
    const text = 'Para one.\n\nPara two is here.\n\n' + 'x'.repeat(700);
    const chunks = chunkText(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 700)).toBe(true);
  });
});

describe('jsonKbStore', () => {
  const file = './kb/.test-kb.json';
  it('retrieves by cosine, respects topK + minScore, and org isolation', () => {
    if (existsSync(file)) rmSync(file);
    const store = jsonKbStore(file);
    store.upsertDoc('orgA', 'd1', [
      { text: 'apple', embedding: [1, 0, 0] },
      { text: 'banana', embedding: [0, 1, 0] },
    ]);
    store.upsertDoc('orgB', 'd1', [{ text: 'other-tenant', embedding: [1, 0, 0] }]);

    const hits = store.retrieve('orgA', [1, 0, 0], 4, 0.5);
    expect(hits[0].text).toBe('apple');
    expect(hits.every((h) => h.score >= 0.5)).toBe(true);
    expect(hits.find((h) => h.text === 'other-tenant')).toBeUndefined(); // org isolation

    // upsert replaces the doc, not appends
    store.upsertDoc('orgA', 'd1', [{ text: 'cherry', embedding: [1, 0, 0] }]);
    expect(store.count('orgA')).toBe(1);
    rmSync(file);
  });
});
