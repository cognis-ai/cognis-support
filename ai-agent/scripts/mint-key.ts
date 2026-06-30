// Mint a per-org Brain key (the per-org cbk_live_ decision, 2026-06-28).
// Usage: tsx scripts/mint-key.ts <org_id> [rpm]
// Reads BRAIN_BASE_URL + BRAIN_ADMIN_TOKEN from env. Prints the key to paste into tenants.json.
//
// Mirrors cognis-brain gateway POST /admin/keys (gateway/app.py:241-267):
//   header x-admin-token; body {organization_id, app_label, scopes, rpm_limit}

const orgId = process.argv[2];
const rpm = Number(process.argv[3] ?? '600');
if (!orgId) {
  console.error('usage: tsx scripts/mint-key.ts <org_id> [rpm]');
  process.exit(1);
}

const base = (process.env.BRAIN_BASE_URL ?? 'http://localhost:8100/v1').replace(/\/v1$/, '');
const adminToken = process.env.BRAIN_ADMIN_TOKEN ?? 'dev-admin-token';

const res = await fetch(`${base}/admin/keys`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
  body: JSON.stringify({
    organization_id: orgId,
    app_label: 'cognis-chat',
    scopes: { endpoints: ['chat', 'completions', 'embeddings'], model_tiers: ['default'] },
    rpm_limit: rpm,
  }),
});

if (!res.ok) {
  console.error(`mint failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const data = (await res.json()) as { api_key: string; key_prefix: string; id: number };
console.log(`minted Brain key for org=${orgId}:`);
console.log(`  id:         ${data.id}`);
console.log(`  brainApiKey: ${data.api_key}`);
console.log(`  prefix:     ${data.key_prefix}`);
