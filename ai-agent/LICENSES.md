# Cognis Chat AI sidecar — license manifest

This service is **MIT** (see the repo root). It is intentionally thin and depends only on
permissive (MIT / Apache-2.0 / BSD) packages — no SSPL/BSL/AGPL/open-core, no Chatwoot
enterprise code, no `@cognis/*` platform packages.

## Runtime dependencies

| Package | License | Use |
|---|---|---|
| `fastify` | MIT | HTTP server (webhook + healthz) |
| `openai` | Apache-2.0 | OpenAI-compatible client for the **Cognis Brain gateway** (chat + embeddings). Not used against api.openai.com. |
| `zod` | MIT | webhook payload validation |

## Dev dependencies

| Package | License | Use |
|---|---|---|
| `typescript` | Apache-2.0 | compiler |
| `tsx` | MIT | TS runner (scripts, dev) |
| `vitest` | MIT | unit tests |

## External services (not bundled)

- **Cognis Brain gateway** — the LLM + embeddings + (intended) Trust layer. Self-hosted Cognis product; reached over its OpenAI-compatible API with a per-org `cbk_live_` key. No DeepSeek/OpenAI key lives in this service.
- **Chatwoot** (`cognis-support` fork) — MIT core only (`enterprise/` stripped). This sidecar talks to its account API.

## Notes

- The AI brain (DeepSeek-V3.2 frontier / Qwen3 default) and any PII/injection guards run **behind the Brain gateway**, not here — so their licenses are governed by the Brain product, and this service stays guard-free by design.
- No model weights are bundled or downloaded by this service.
