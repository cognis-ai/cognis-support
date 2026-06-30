# Cognis Chat — AI sidecar

The standalone AI brain for Cognis Chat. A Chatwoot **agent-bot webhook** lands here; the
sidecar reads the conversation, asks the **Cognis Brain gateway** for a reply, posts it back,
and escalates to a human on `[ESCALATE_TO_HUMAN]`. **No Bridge, no LiteLLM, no platform DB.**

```
Chatwoot (shell, :3000) --webhook--> ai-agent (:4100) --OpenAI API--> Cognis Brain gateway (:8100)
        ^---------------- reply / escalate (account API) ----------------|
```

Ported from `cognis-platform/apps/bridge/src/features/agent-bot/` — the one change is the LLM
call: Bridge's `@cognis/llm-client`→LiteLLM becomes an OpenAI-SDK call to the Brain gateway with
each tenant's **own per-org `cbk_live_` key**. DeepSeek/Qwen live behind the gateway; this service
holds no DeepSeek key.

## Layout

| File | Role |
|---|---|
| `src/agent-bot.service.ts` | the loop: webhook → history → **RAG retrieve** → Brain → reply / escalate → audit |
| `src/brain/brain-client.ts` | the LLM swap — OpenAI SDK pointed at the Brain gateway |
| `src/rag/*` | KB grounding (V2): embeddings via Brain `cognis-embed`, chunker, cosine vector store, ingest+retrieve |
| `src/audit/file-audit.ts` | own append-only JSONL audit store (V1) |
| `src/security/*` | webhook HMAC verify + per-IP rate limiter (V3) |
| `src/chatwoot/conversation-client.ts` | Chatwoot account API (read history, post reply, toggle status) |
| `src/chatwoot/dto.ts` | webhook schema + `isIncomingFromCustomer` |
| `src/store/tenant-store.ts` | `account_id` → org + tokens + per-org Brain key + webhook secret (JSON; Postgres-ready) |
| `src/prompts/cognis-support.v1.ts` | system prompt (verbatim from Bridge) |
| `src/server.ts` | Fastify: `POST /agent-bot/webhook` (HMAC + rate limit), `GET /healthz` |
| `scripts/mint-key.ts` | mint a per-org `cbk_live_` Brain key via the gateway admin API |
| `scripts/ingest-kb.ts` | ingest a doc into an org's knowledge base |
| `scripts/provision-demo.ts` | wire a live Chatwoot (inbox + agent bot + tenants.json) |

## Phases (see `../GOAL.md`)

- **V0** standalone loop, Brain-backed — proven live (screenshot)
- **V1** zero Bridge couplings + own audit store
- **V2** RAG grounding via the Brain's shared embeddings (answers from docs; declines when the KB lacks it)
- **V3** webhook HMAC auth (`WEBHOOK_AUTH_ENFORCE=true` in prod), per-IP rate limit (`WEBHOOK_RPM`), per-tenant `org_id` isolation. **No inline PII/injection guards** — those are the Brain gateway's Trust layer.

## Run (dev)

```bash
npm install
cp .env.example .env

# 1) mint a per-org Brain key (Brain gateway must be up on :8100)
npm run mint-key org_demo 600

# 2) seed tenants.json (account_id from Chatwoot, tokens from Chatwoot, key from step 1)
cp tenants.example.json tenants.json   # then edit

# 3) start
npm run dev            # tsx watch on :4100
```

Point the Chatwoot Agent Bot's `outgoing_url` at `http://<host>:4100/agent-bot/webhook`.

## Verify

```bash
npm run typecheck      # tsc, no emit
npm test               # vitest — the loop's contract tests (mocked Brain + Chatwoot)
```

## V0 gate (live, headed Playwright)

The standalone proof needs three things up: the Chatwoot shell (`../docker-compose.yaml`, :3000),
the Brain gateway (`../../cognis-brain/docker-compose.yml`, :8100 — **CPU vLLM, ~900s first boot**),
and this sidecar (`docker compose up`). Then a customer message in the live widget gets a
Brain-generated reply **with no Bridge running** — proven by `../cognis/e2e` + screenshot.

## License

MIT. All deps permissive (fastify MIT, openai Apache-2.0, zod MIT).
