import { describe, it, expect } from 'vitest';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { fileAuditSink } from '../src/audit/file-audit.js';

describe('fileAuditSink', () => {
  it('appends an org-stamped, timestamped JSONL line', () => {
    const path = './audit/.test-audit.jsonl';
    if (existsSync(path)) rmSync(path);
    const sink = fileAuditSink(path);
    sink.record({ cognisOrgId: 'org_x', action: 'agent_bot_replied', target: 'conversation:7', metadata: { escalated: true } });
    sink.record({ cognisOrgId: 'org_y', action: 'agent_bot_replied', target: 'conversation:8', metadata: { escalated: false } });
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first.cognisOrgId).toBe('org_x');
    expect(first.metadata.escalated).toBe(true);
    expect(typeof first.ts).toBe('string');
    rmSync(path);
  });
});
