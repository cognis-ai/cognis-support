// Minimal, dependency-free chunker. One chunk per paragraph (a natural semantic unit for
// help-center content); paragraphs longer than maxChars are split on sentence boundaries,
// with a hard char-split as a final safety. Keeping chunks small sharpens retrieval precision.
export function chunkText(text: string, maxChars = 600): string[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const p of paras) {
    if (p.length <= maxChars) {
      out.push(p);
      continue;
    }
    // oversized paragraph -> pack sentences up to maxChars
    const sentences = p.match(/[^.!?]+[.!?]*\s*/g) ?? [p];
    let cur = '';
    for (const s of sentences) {
      if (cur && cur.length + s.length > maxChars) {
        out.push(cur.trim());
        cur = s;
      } else {
        cur += s;
      }
    }
    if (cur.trim()) out.push(cur.trim());
  }

  // hard-split anything still over maxChars (e.g. a single huge sentence)
  const final: string[] = [];
  for (const c of out) {
    if (c.length <= maxChars) final.push(c);
    else for (let i = 0; i < c.length; i += maxChars) final.push(c.slice(i, i + maxChars));
  }
  return final;
}
