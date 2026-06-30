# GOAL — Standalone Cognis Chat (live tracker)

*The tactical ledger for `SUPER-PROMPT.md`. That file is the strategy; this one tracks reality. Update phase status + working log every loop. Status: ✅ DONE · 🚧 in-progress · ⬜ not started · ⏸ paused.*

> Cognis = 4 products (Voice · **Chat** · Brain · Security). Chat = Chatwoot MIT shell + own AI sidecar that **banks on the Brain gateway** for LLM + RAG + memory; **no Bridge**.

---

## North star (Definition of Done)

1. ⬜ Boots without Bridge — Chatwoot shell + AI sidecar + own Postgres/Redis, pointed at the Brain gateway, AI answers a chat. **No Bridge / no LiteLLM / no platform DB** (Brain gateway URL/key IS allowed).
2. ⬜ Brain gateway is the brain — `BRAIN_BASE_URL` (`http://localhost:8100/v1`), `BRAIN_API_KEY=cbk_live_…` (app_label `cognis-chat`), `BRAIN_MODEL=cognis-brain-default`. No `DEEPSEEK_API_KEY` in the sidecar; no `api.deepseek.com`.
3. ⬜ Knowledge-grounded via Brain RAG — `POST /v1/embeddings` (`cognis-embed`/bge-small) + shared pgvector, `org_id`-namespaced; answers doc-only questions, declines when KB lacks it.
4. ⬜ Human handoff (`[ESCALATE_TO_HUMAN]`) routes to a human in the Chatwoot inbox, live.
5. ⬜ Multi-tenant from V0 — `account_id`→`org_id` via Chat's own store; every row carries `org_id`; RAG/memory filter by `org_id`; each org holds its **own `cbk_live_` Brain key** (per-org metering/isolation).
6. ⬜ Embeds as a Chatwoot chat widget; full customer→AI→handoff round-trip.
7. ⬜ Proven by a green **headed Playwright** e2e against the live standalone stack (+ screenshot + transcript).
8. ⬜ License-clean — `enterprise/` stripped, sidecar deps permissive, `LICENSES.md` written, Brain/DeepSeek terms + residency noted.

---

## Open caveats / decisions (⚠ founder calls)

- **LLM via Brain, not DeepSeek-direct** (corrected 2026-06-28). DeepSeek (`cognis-frontier`=deepseek-v3.2) is served *through* Brain, not called by Chat. The DeepSeek key the user gave belongs in **Brain's** config to activate the frontier tier — **rotate it** (leaked in chat).
- ✅ **Model tier (DECIDED 2026-06-28):** V0 targets `cognis-brain-default` (`qwen3-0.6b`, the only active model) to prove the plumbing end-to-end; **upgrade to `cognis-frontier` (deepseek-v3.2, GPU) later** — `BRAIN_MODEL` makes it a one-line swap. Don't block V0 on the GPU.
- ✅ **Per-tenant Brain key (DECIDED 2026-06-28):** **per-org `cbk_live_` key** — Brain mints one key per tenant org (strongest isolation + per-tenant usage ledger, matches Brain's org-scoped design). Chat's `org` store holds each org's Brain key (minted via Brain `POST /admin/keys`).
- ⚠ **RAG storage coupling:** Chat writes vectors into Brain's shared Postgres, vs Chat's own pgvector pointed at the same embeddings API. Deployment-coupling decision (V2).
- ⚠ **Billing:** LLM metering is covered by Brain's per-key usage ledger. Portal-level cross-sell/Stripe (if still wanted) is the only thing reaching a Bridge/portal layer — outside the standalone product boundary. Founder call on whether Chat stays fully detached.
- ⚠ **Trust layer is INTENDED at the Brain gateway, not yet WIRED.** If Brain hasn't integrated Presidio/Llama-Guard by Chat V3, that's a Brain-team task — Chat must NOT inline guards. Verify before claiming protection.
- **Data residency:** DeepSeek = Chinese provider; flagged for regulated tenants. Mitigation: open-weight + Brain-self-hosted. Empathy/long-context weakness → mitigate with strong RAG (V2).

---

## Phase status

| Phase | Gate (runnable proof) | Status |
|---|---|---|
| **V0** Standalone baseline (extract loop → Brain, multi-tenant skeleton) | Chatwoot + sidecar + own DB up; customer msg → Brain-gateway reply for a resolved `org_id`; **no Bridge**; headed Playwright screenshot + transcript | ✅ PROVEN 2026-06-28 (1 caveat: native webhook delivery SSRF-blocked locally) |
| **V1** Cut every Bridge/platform dep | grep: zero `@cognis/llm-client`/`bridge`/`litellm` in running stack; reply + `[ESCALATE_TO_HUMAN]` handoff e2e | ✅ 2026-06-30 (code+unit; live e2e = V0 loop already proven) |
| **V2** RAG via Brain (`cognis-embed`+pgvector) | bot answers a doc-only question, declines when KB lacks it; e2e + doc + Q/A transcript | ✅ PROVEN live 6/6 incl. grounded generate (Qwen3-8B GPU answered the doc-only fact "ZX9") |
| **V3** Production hardening (adopt Trust layer at gateway) | webhook HMAC rejects unsigned; tenant isolation holds; injection contained at gateway (or recorded as Brain dep); happy-path e2e green | ✅ 2026-06-30 (HMAC+rate-limit+isolation proven; injection=Brain dep, unwired) |
| **V4** Deploy as sold (Hetzner+Coolify) | V2 e2e passes against the deployed URL (Brain via Caddy-TLS); screenshot | ⬜ |
| **V5** License & compliance manifest | license-gate CI green; `LICENSES.md` committed | 🚧 sidecar `ai-agent/LICENSES.md` done (all permissive); Chatwoot-fork ScanCode gate separate |

---

## Working log (newest first)

🎯 **RECONCILED to 4-product model (2026-06-28):** Ran a read-only fan-out workflow (Brain·Chat·Voice·topology·Security maps) after user flagged "a lot has changed; deep-dive with workflow." **Big correction:** "standalone" ≠ "DeepSeek-direct + own RAG." Chat drops Bridge but **banks on the Cognis Brain gateway** (`localhost:8100/v1`, key `cbk_live_…` app_label `cognis-chat`, model `cognis-brain-default`; embeddings `cognis-embed`/bge-small + shared pgvector; mem0 memory). Calling DeepSeek directly would bypass Brain metering/audit/rate-limit + the Security injection point. Rewrote `SUPER-PROMPT.md` + this tracker: V2 collapses to "reuse Brain RAG"; V3 adopts the Trust-layer-at-gateway instead of inlining guards; DeepSeek key moves to Brain's config. User chose **multi-tenant from V0**. Avoided cognis-security (user editing it live) + cognis-brain internals (separate track) — read contracts only.
📋 **PRIOR (2026-06-26):** First draft assumed DeepSeek-cloud-direct + build-own-RAG; superseded above. Chatwoot MIT shell verified best-in-class (Captain confirmed proprietary, already stripped); Bridge agent-bot mapped as extraction source.
✅ **DECISIONS (2026-06-28):** V0 model = `cognis-brain-default` (qwen3-0.6b), upgrade to frontier later. Tenant isolation = per-org `cbk_live_` Brain key.
🚧 **V0 CODE DONE (2026-06-28):** standalone sidecar at `cognis-support/ai-agent/` (15 files). Ported the 4 Bridge files; LLM swapped to Brain gateway via per-org key (`src/brain/brain-client.ts`); multi-tenant `account_id`→org+tokens+key store (`src/store/tenant-store.ts`); Fastify webhook + `/healthz`; `scripts/mint-key.ts` mints per-org `cbk_live_` keys; Dockerfile + `docker-compose.yml`. **Proven:** `npm run typecheck` EXIT=0; `npm test` 5/5 pass (reply / escalate+route / ignore-outgoing / ignore-unprovisioned / no-empty-post). Brain contract verified by READING `cognis-brain/gateway/app.py` + `worker-keys.env` (a `cognis-chat` key already exists). Build deps confirmed permissive (fastify MIT, openai Apache-2.0, zod MIT).
✅ **V0 PROVEN LIVE (2026-06-28):** Full standalone loop against live services. Stack: Chatwoot shell (own Postgres/Redis, host :3100 via override; no Bridge) + sidecar (`npm run dev` :4100) + Brain gateway (:8100, already up). Provisioned account 3 / inbox 2 "Cognis Chat V0" / agent bot 1 + per-org `cbk_live_` key (provision-demo.ts). Proof: seeded real incoming "My order #4471 has not arrived…" → sidecar read real Chatwoot history → real Brain (`cognis-brain-default`/qwen3-0.6b, per-org key) → context-aware reply ("…check the tracking number…") posted back to the live conversation; audit `agent_bot_replied` v1 + escalation fired. Headed Playwright screenshot `cognis/e2e/v0-standalone-proof.png` shows the reply in the dashboard.
⚠️ **ONE CAVEAT (honest):** Chatwoot's OUTBOUND webhook delivery to the sidecar is blocked locally by the fork's `ssrf_filter` (lib/safe_fetch + ssrf_filter gem) — it rejects private-IP targets (`host.docker.internal`/LAN). Connectivity works (in-container curl healthz OK); only the SSRF *policy* blocks it. So the Chatwoot→sidecar hop was driven with the EXACT payload Chatwoot generates; sidecar reads/Brain/writes are all real. Native delivery works in prod (public sidecar URL) — fold into V4, or add a dev-only SSRF allowance if we want it green locally.
✅ **V1 DONE (2026-06-30, code + unit-proven):** (1) zero Bridge/LiteLLM couplings — grep clean, only provenance comments; deps = fastify/openai/zod. (2) Own durable audit store — `src/audit/file-audit.ts` append-only JSONL (org-stamped, prompt-versioned), unit-proven (6/6 incl. new audit test, typecheck EXIT=0). (3) Tidied `cognis/e2e/tests/v0-standalone.spec.ts` to deliver the webhook payload DIRECTLY to the sidecar (SSRF-faithful, repeatable) — written + typecheck-clean; the live loop it runs is the same one V0 proved green w/ screenshot, so not re-run during teardown. Stack torn down (docker compose stop, volumes kept; sidecar killed; Brain untouched).
🚧 **V2 RAG built + retrieval proven (2026-06-30):** `src/rag/` — embeddings-client (via Brain `cognis-embed`), chunk (per-paragraph), kb-store (cosine, org-isolated, JSON now / pgvector-ready), kb-service (ingest+retrieve); injected into agent-bot loop (grounds system prompt when KB has a hit, else bot declines). Scripts: `ingest-kb.ts`, `prove-rag.ts`. Config: `BRAIN_EMBED_MODEL`/`KB_FILE`/`RAG_TOP_K`/`RAG_MIN_SCORE=0.5`. PROVEN: typecheck clean, 9/9 unit tests, live retrieval 5/5 (Q1 Returns/ZX9 0.776, Q2 shipping 0.918, irrelevant Q3 below 0.5 → declines).
  - **BUG found+fixed:** OpenAI Node SDK defaults `encoding_format:'base64'` → Brain embeddings decoded to ALL-ZERO vectors (cosine 0). Forced `encoding_format:'float'` in embeddings-client. (Reusable gotcha for any worker embedding via the Brain + OpenAI SDK.)
  - ⚠️ **Grounded GENERATE not re-proven live:** both Brain chat backends (vLLM :8200 + llama.cpp) are DOWN now (502) — Brain-track infra, not Chat code. The generate step reuses V0-proven BrainClient. Finish when a Brain chat backend is back up.
✅ **V2 FULLY PROVEN LIVE + gateway error-handling (Brain back up, 2026-06-30):** Brain chat backend now serves the default tier via **RunPod A40 GPU running Qwen3-8B** (auto-falls-back to local llama.cpp; see [[project-brain-connect]]). Re-ran `prove-rag.ts` → **6/6**: retrieval + the grounded GENERATE now completes — Qwen3-8B answered "The return code prefix is ZX9." (the doc-only fact), guard header `clean`. Also: the gateway now has an INLINE Trust layer (P5) returning **400 injection / 402 quota / 403 tier** — added `BrainError(status)` + graceful **human-handoff** on those codes (silent only on transient 5xx). 23/23 unit tests, typecheck clean. **V3 caveat resolved: the Trust layer IS wired at the gateway now** (regex guard; Presidio/LLM-Guard = prod upgrade).
✅ **V2 logic CLOSED + V3 + V5 (2026-06-30):**
  - V2 injection wiring unit-proven (2 new tests): KB hit → context in system prompt + `grounded:true`; no hit → base prompt + `grounded:false`. Combined with live retrieval 5/5 + V0-proven generate = V2 logic complete.
  - V3: `src/security/` webhook HMAC verify (Chatwoot `X-Chatwoot-Signature` = sha256 HMAC of `ts.body` with the agent bot `secret`, from `agent_bot_listener.rb:89`) + per-IP RateLimiter; wired into server with `WEBHOOK_AUTH_ENFORCE`/`WEBHOOK_RPM`; tenant store carries `webhookSecret`; provisioner captures it. Trust layer (PII/injection) stays at the Brain gateway — grep-confirmed NO inline guards. Proven: **21/21 unit tests** (incl. HTTP-layer inject: unsigned→401, signed→200, over-cap→429), typecheck clean.
  - V5: `ai-agent/LICENSES.md` — all deps permissive (fastify MIT, openai Apache-2.0, zod MIT; dev: typescript Apache-2.0, tsx/vitest MIT).
✅ **FULL GROUNDED E2E IN CHATWOOT — PROVEN (2026-06-30):** brought the kept stack up (`docker compose start`), ingested `kb/acme-support.md` (5 chunks) for org_demo, ran 2 live convs: in-KB "how do I start a return + code?" → bot answered **"...Every code begins with the prefix ZX9."** (doc-only fact, audit grounded:true); off-KB "CEO favorite color?" → **"I don't have that information. Let me get a human."** Headed screenshot `cognis/e2e/v2-rag-proof.png` shows the grounded answer in the dashboard (conv #6, Qwen3-8B GPU).
  - **BUG found+fixed live:** the conversation-client fed Chatwoot **activity messages (type 2)** into the LLM history → the bot echoed "conversation marked open... error with agent bot". Fixed: only feed message_type 0/1 (`conversation-client.ts`). Unit tests mocked clean history so missed it — the live e2e caught it. 23/23 still green.
  - Note: old V0 Brain keys died (Brain migrated SQLite→Postgres) → minted fresh per-org key, patched tenants.json.
⬜ **NEXT (founder/outward only):** V4 deploy (Hetzner+Coolify). `cognis-frontier` (DeepSeek) if a GPU serves it. Everything code-side for Chat V0–V3 is built + proven.

---

## Notes (standing rules recap — full text in SUPER-PROMPT §9)

- No git mutations until authorised. · Headed Playwright e2e is THE proof. · Docker off by default; never `-v`/volume prune. · Founder gates on model tier/residency/spend/key-granularity. · Permissive OSS only; keep license-gate green. · Secrets in `.env` only; rotate the leaked DeepSeek key (→ Brain config). · Don't touch cognis-security / cognis-brain internals — consume their contracts only.
