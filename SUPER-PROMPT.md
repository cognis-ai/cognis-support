# COGNIS CHAT — STANDALONE BUILD SUPER-PROMPT

*Operating contract for the autonomous coding agent building Cognis Chat (the AI customer-support / chat worker, formerly "Support"). Agent-native (Claude Code, Opus 4.x, 2026). Re-read §0 + §1 every session. This file is the strategy; `GOAL.md` is the live tracker.*

> Sibling of `cognis-voice/SUPER-PROMPT.md`. Cognis is now **four products: Voice · Chat · Brain · Security**, over one shared self-hosted **Brain**. Chat is a STANDALONE worker (Chatwoot MIT shell + own AI sidecar) that **drops Bridge** but **banks on the Brain** for LLM + RAG + memory — exactly as Voice does. **Brain is NOT Bridge** — it's a separate self-hosted sibling product and the sanctioned shared dependency.

---

## §0 — GOAL (the north star, externalised)

**Ship a working, multi-tenant, STANDALONE Cognis Chat product — the Chatwoot MIT shell + our own AI sidecar that consumes the shared Cognis Brain gateway (LLM + RAG + memory) — depending on NOTHING in `cognis-platform/apps/bridge` (no Bridge, no LiteLLM, no platform Postgres). The Brain gateway is an allowed shared dependency; Bridge is not.**

**Definition of Done (every clause provable):**

1. **Boots without Bridge** — `docker compose up` brings up the Chatwoot shell (`cognis-support`) + the AI sidecar + their own Postgres/Redis, pointed at the Brain gateway, and a customer chat is answered by AI. **No `cognis-platform/apps/bridge` process. No LiteLLM. No platform DB.** Grep-proof: nothing in the running stack imports `@cognis/llm-client` or reaches `bridge`/`litellm`. The Brain gateway URL/key *is* allowed.
2. **The Brain is the brain** — replies come from the Brain gateway (OpenAI-compatible): `BRAIN_BASE_URL` (`http://localhost:8100/v1` dev; Caddy-TLS `BRAIN_DOMAIN` prod), `BRAIN_API_KEY=cbk_live_…` (org-scoped per-app key, app_label `cognis-chat`), `BRAIN_MODEL=cognis-brain-default` (Qwen3, reasoning off by default). The sidecar holds **no** `DEEPSEEK_API_KEY` and never hits `api.deepseek.com` directly — DeepSeek (`cognis-frontier` = deepseek-v3.2) is reached *through* Brain when that tier is activated.
3. **Knowledge-grounded via Brain RAG** — the bot answers from a per-tenant knowledge base built on Brain's shared embeddings (`POST /v1/embeddings`, `cognis-embed` = bge-small) + shared pgvector, org-namespaced. A question answerable *only* from an ingested doc is answered correctly; the bot declines/escalates when the KB lacks it.
4. **Human handoff works** — the `[ESCALATE_TO_HUMAN]` contract routes a conversation to a human agent in the Chatwoot inbox, live.
5. **Multi-tenant from day one** — one Chat worker serves many tenants: inbound webhook `account_id` → `org_id` via Chat's **own** store (replacing Bridge's `ChatwootAccount`/`org_mappings`); every persisted row carries `org_id`; all RAG/memory queries filter by `org_id`; the Brain key enforces per-org metering/isolation at the gateway.
6. **Embeds as a chat widget** — the Chatwoot JS widget drops into a host page and a full customer→AI→handoff round-trip works end-to-end.
7. **Proven by headed Playwright** — a green headed e2e against the live standalone stack, with screenshot + transcript, demonstrates clauses 1–6.
8. **License-clean** — Chatwoot `enterprise/` stays stripped (no Captain), every sidecar dependency permissive OSS, `LICENSES.md` records it. Brain/DeepSeek terms + data-residency caveat documented.

The live, authoritative goal + per-phase checklist lives in **`GOAL.md`**. This file is the strategy; `GOAL.md` is the tracker.

**Architecture decision (supersedes the old fork rule AND the 2026-06-26 draft):** Two retired ideas — (a) the AI brain living in `cognis-platform/apps/bridge` ("everything Cognis goes in Bridge"), and (b) the 2026-06-26 plan to call **DeepSeek cloud directly + build Chat's own RAG**. Under the 4-product model the brain is a **standalone AI sidecar** that talks to Chatwoot's account API + the **Brain gateway** (which itself serves DeepSeek/Qwen + shared RAG + mem0). The Chatwoot fork (`cognis-support`) stays a thin, MIT-only shell; the sidecar is its own process; the heavy AI lifting lives in Brain, shared across all workers.

---

## §1 — TRUTH-LOCK (anti-hallucination laws — never violate)

The 2026 root cause of agent failure is **declaring victory too early**: judging from local code-confidence when correctness needs system-level verification. A verifier that pattern-matches the transcript ("looks done") gets fooled. So:

1. **No "done" without a runnable check.** Paste the exact command and its real output (and **exit code**) as evidence. "Done" = a passing test, a live probe, a screenshot, or a file diff — *shown, not described*.
2. **Cite before you assert.** Before claiming a file, symbol, env var, API, or endpoint exists, name the `file:line` you actually read this session. Memory and this document may be stale — verify against the live tree. (This very file was corrected once already when it assumed DeepSeek-direct; assume it can be stale again.)
3. **"I don't know" beats a confident guess.** Preferred every time.
4. **Intended ≠ wired ≠ deployed ≠ proven.** State which one you mean, every time. (E.g. the Security Trust layer at the Brain gateway is *intended, not yet wired* — don't claim Chat is protected by it until you've verified.)
5. **Never fake green.** No silencing errors, no `--no-verify`, no skipped assertions, no editing/deleting a test to make a suite pass. Ungrounded self-reflection makes accuracy *worse* (2026 finding) — ground every claim against tests, retrieved evidence, or a separate critic.
6. **Self-audit before ending a turn.** Re-read your claims against §1.1–§1.5. Retract any wrong prior statement explicitly, in the same turn you discover it.

---

## §2 — THE LOOP (loop engineering = the operating discipline)

"Loop engineering" is a design discipline, not a CLI command — it's how the features below compose into observe→plan→act→verify. The hard part in 2026 is **context engineering**: curate what enters a finite window on *every* turn.

- **Explore** — gather context just-in-time (read `GOAL.md`, the relevant `file:line`, run a smoke probe). Hold lightweight identifiers; fetch detail on demand. Don't pre-load the world.
- **Plan** — use **plan mode** (`Shift+Tab` / read-only "research + propose, no edits until approved") for anything non-trivial. Pre-commit the plan; for risky/outward-facing steps, get human sign-off (§9).
- **Execute** — the smallest bounded change that advances one phase gate. One feature at a time. Leave the tree runnable.
- **Verify** — against **environment ground truth**, not your own narration: run the command, read output + exit code, and for anything user-facing run the **headed Playwright e2e** (§9.2). Layered DoD: (1) static/lint/type → (2) runtime tests + critical path → (3) e2e. Don't advance a layer until the prior passes.
- **Persist** — externalise state so it survives a context reset: update `GOAL.md` (phase status + working log), commit per bounded unit *(only when authorised — §9.1)*, keep run scripts current.

Re-anchor to §0 at the top of every loop to fight **goal drift** (the dominant long-horizon failure mode in 2026).

---

## §3 — GOAL DISCIPLINE (`/goal` + two ledgers)

`/goal` is a real built-in: it keeps the session working turn-by-turn until a **verifiable completion condition** holds (a fast model judges from what you surface in the transcript — so the condition must be judgeable from your output, e.g. "the e2e passes", not "the server is healthy" unless you probe it). **Always bound it:** `… or stop after N turns`.

Example:
```
/goal a headed Playwright run passes against the local standalone stack where a customer
message in the Chatwoot widget gets a reply generated via the Brain gateway (BRAIN_BASE_URL),
with no Bridge process running — or stop after 12 turns
```

**Two ledgers:**
- **Task ledger** = the plan/strategy → `GOAL.md` (phase checklist, north star, working log).
- **Progress ledger** = tactical TODOs for the current phase → `TaskCreate` / `TaskUpdate`.

Keep both honest. A half-built phase stays 🚧 — never mark it done to move on.

---

## §4 — STOP CONDITIONS (always three)

Every loop/`/goal`/workflow terminates deterministically on exactly one of:
- **Success** — a DoD clause or phase gate is *proven* (evidence shown).
- **Failure** — retry cap hit, or an unrecoverable blocker (record it in `GOAL.md`, surface it).
- **Budget** — turn limit or token/USD ceiling reached.

Never terminate by text-matching "done." If you can't show the evidence, you are not done.

---

## §5 — WORKFLOW DISCIPLINE (multi-agent, the single-writer rule)

Workflows / subagents are real and powerful (16 concurrent, up to 1000/run, adversarial verify). 2026 evidence is blunt: multi-agent **wins for independent, context-bound, read-only work** and **loses for coding** — interdependent edits degenerate parallelism into expensive serial execution and conflicts.

**The single-writer rule:** fan out only for parallel **reading / search / research / audit / verification**; keep all **writes and decisions single-threaded** in the main agent. Use the **evaluator-optimizer** pattern (a *separate* critic agent) for adversarial checks — never single-persona self-review (§1.5). For unavoidable file-mutating parallel work, isolate each agent in a git worktree. (This contract was itself reconciled by a read-only fan-out workflow — that's the sanctioned use.)

---

## §6 — `/loop` (self-pacing long operations)

`/loop` is a real built-in: time-based (`/loop 15m …`) or self-paced (no interval → Claude picks 1m–1h per iteration and can end itself). Session-scoped (7-day expiry; restored on `--resume`). Use it to **babysit long operations the harness can't notify on** — a Chatwoot Docker build, a model/embeddings download, a deploy, a long e2e. For cross-session/unattended scheduling use **`/schedule`** (cloud routines). Don't poll with `/loop` for work the harness already notifies you about (subagents, background tasks).

---

## §7 — DREAMING (reflection — implemented honestly)

**Native "dreaming" / sleep-time compute is a research-direction (Letta sleep-time agents, Reflexion), NOT a Claude Code CLI primitive. Do not claim to invoke it.** Note: the *product* mem0 memory (Brain) is a separate thing from agent "dreaming" — don't conflate them. The CLI-honest equivalent for the build agent is a **scheduled reflection pass**:

- Run during idle time via `/loop` (while quiet) or a `/schedule` routine.
- Mine the session for **durable lessons** — recurring bugs, dead ends, decisions — and write them to **memory** (`~/.claude` memory files) or a `LEARNINGS.md`, so the next session starts smarter.
- **Reflect only against external signals** (test outcomes, retrieved evidence, a critic). 2026 finding: ungrounded self-reflection *degrades* accuracy — never let reflection self-validate a claim.

---

## §8 — CONTEXT HYGIENE & CHECKPOINTING

**Context is finite and rots before it fills.** Compact proactively at task boundaries. Externalise state to durable artifacts (`GOAL.md`, git commits, run scripts, a JSON feature/checklist file) so a crash or compaction resumes from the last checkpoint, not from zero. Don't dump whole files into context — read the slice you need. Feed yourself remaining-budget awareness on long runs.

---

## §9 — STANDING GUARDRAILS (this user's hard rules)

1. **No git mutations** — never commit / stash / push / pull / merge / rebase until the user explicitly authorises it this session. Read-only git (`log`, `diff`, `status`, `show`) is always fine.
2. **Headed Playwright e2e is THE proof** — for any user-facing change, a headed Playwright run against the **live** standalone stack + screenshot is the primary evidence. Unit/contract tests support it; they never replace it.
3. **Docker only when necessary** — containers stay OFF by default. Bring infra up only when a task needs it, then stop it. Take down via stop + container prune — **NEVER** `-v` / volume prune (volumes hold data). Keep images.
4. **Human-in-the-loop gates** — founder/product decisions (model tier, residency, spend, key granularity, anything outward-facing or hard to reverse) pause for sign-off. Don't infer a decision the user owns.
5. **Permissive OSS only** — every dependency MIT/Apache/BSD (AGPL only if explicitly noted). No SSPL/BSL/open-core/Chatwoot-enterprise code. The license-gate CI (`tools/check_no_proprietary.py`) is load-bearing — keep it green.
6. **Secrets never in git** — all tokens (`BRAIN_API_KEY`, Chatwoot tokens) live in `.env` (gitignored). The DeepSeek key the user pasted belongs in **Brain's** config to activate `cognis-frontier`, **not** in the Chat sidecar — and must be **rotated** (it was shared in plaintext).
7. **Don't touch cognis-security or cognis-brain internals** — the user actively works Security in another terminal; Brain is owned by its own track. Chat *consumes* their contracts (gateway URL/key, Trust-layer-at-gateway); it does not modify them. Reading their docs/contracts is fine.

---

## §10 — THE MISSION: standalone Chat, sequenced (2026 stack)

Phases are **V0–V5**, each with a **runnable gate**. Work the lowest open phase. The brain loop to extract already exists in Bridge — reuse it, just retarget the LLM call from LiteLLM to the Brain gateway:

> **Extraction source (read, port):** `cognis-platform/apps/bridge/src/features/agent-bot/` — `agent-bot.service.ts:27-143` (the loop: webhook → history → LLM → reply → `[ESCALATE_TO_HUMAN]` → audit), `chatwoot-conversation.client.ts` (Chatwoot account API: read history / post reply / toggle status — keep as-is), `dto.ts` (webhook schema + `isIncomingFromCustomer` — keep), `prompts/cognis-support.v1.ts` (system prompt — keep verbatim). **Change:** swap the `@cognis/llm-client`→LiteLLM call for an OpenAI-SDK call against `BRAIN_BASE_URL` with `BRAIN_API_KEY` (a ~3-line config swap — same OpenAI-compatible shape). Replace Bridge's Prisma per-org lookups with Chat's own `account_id`→`org_id` store.

**V0 — Standalone baseline (extract the loop, point at Brain, multi-tenant skeleton).**
Stand up the Chatwoot shell + a minimal standalone **AI sidecar** (TypeScript; reuse the ported files) replicating today's agent-bot loop but calling the **Brain gateway** instead of LiteLLM, with Chat's own `account_id`→`org_id` store (multi-tenant from the start) instead of platform Prisma.
*Gate:* `docker compose up` (Chatwoot + sidecar + own Postgres/Redis), a customer message in the live Chatwoot widget gets a reply generated via the Brain gateway, **with no Bridge running**, for a resolved tenant `org_id`. Headed Playwright screenshot + transcript saved.

**V1 — Cut every Bridge/platform dependency.**
Replace all Bridge couplings: `ChatwootAccount`/`LitellmTeam`/`LlmRoutingConfig`/`BillingEvent` → Chat's own store; `AuditService`→ local audit log; `SecretVaultService`→ local secret handling. LLM metering comes from Brain's per-key usage ledger (`GET /admin/usage`), not BillingEvent.
*Gate:* grep proves zero `@cognis/llm-client` / `bridge` / `litellm` references in the running stack (Brain gateway URL/key allowed); the V0 e2e still passes **plus** an escalation path (`[ESCALATE_TO_HUMAN]` → conversation routed to a human in the inbox). Screenshot.

**V2 — Knowledge grounding via Brain RAG (the real gap).**
Per-tenant KB: ingest help-center articles / uploaded docs → `POST /v1/embeddings` (`cognis-embed`) on the Brain gateway → upsert into pgvector with `org_id` filter → cosine top-k → inject before the chat completion. **Do not** stand up a second embedding stack — reuse Brain's bge-small + shared pgvector. Use prompt caching for the static system prompt + KB. (mem0 cross-conversation customer memory via Brain is a V2/V3 add, not V0.)
*Gate:* the bot correctly answers a question answerable **only** from an ingested doc, and declines/escalates when the KB lacks it. e2e screenshot + the ingested doc + the Q/A transcript.

**V3 — Production hardening (adopt the Trust layer, don't rebuild it).**
Chat owns: Chatwoot webhook **HMAC/shared-secret auth** (today's endpoint is `@Public()`, `agent-bot.controller.ts:19`), per-tenant isolation, edge rate-limiting, PII handling in Chat's *own* stored transcripts/KB, structured per-reply audit (prompt version + escalation flag). Chat does **NOT** inline injection/PII guards — those are the Security/Trust layer enforced at the **Brain gateway** (Presidio PII + Llama Guard moderation). ⚠️ Verify whether the Trust layer is actually *wired* into the Brain gateway yet; if not, that's a Brain-team task — do not work around it by importing `cognis-llm-guard`/`presidio` into Chat (that recreates the per-product fork churn the security design forbids).
*Gate:* an unauthenticated webhook is rejected; per-tenant isolation holds; an injection probe is contained *at the gateway* (or the gap is recorded as a Brain dependency, not patched in Chat). Happy-path e2e still green. Evidence for each.

**V4 — Deploy as sold (standalone).**
Deploy the standalone stack to **Hetzner + Coolify**, pointed at the deployed Brain gateway (Caddy-TLS `BRAIN_DOMAIN`). No portal/Bridge required at launch.
*Gate:* the V2 e2e passes **against the deployed instance** (real URL), screenshot saved.

**V5 — License & compliance manifest.**
`LICENSES.md`: confirm Chatwoot `enterprise/` stripped (no Captain), every sidecar dep permissive, Brain/DeepSeek terms + data-residency caveat recorded (DeepSeek open-weight + Brain-self-hosted = the residency mitigation).
*Gate:* license-gate CI green; `LICENSES.md` committed *(on authorisation — §9.1)*.

**Cross-cutting (non-negotiable):** keep the pipeline **auditable** — every AI reply logged with prompt version + escalation flag; per-tenant prompt + KB isolation via `org_id`; the `[ESCALATE_TO_HUMAN]` human-handoff contract intact. Chatwoot stays MIT-shell-only; the sidecar stays a thin process; the heavy AI lives in Brain.

---

## §11 — SESSION ORIENTATION PROTOCOL (run first, every session)

1. Read this file (§0, §1) and `GOAL.md`.
2. `git log --oneline -10` + check working-tree state (read-only — §9.1).
3. Confirm the Brain gateway contract is still current (is `http://localhost:8100/v1` up? does `BRAIN_MODEL` still resolve? — the contract can drift as Brain evolves; verify, don't assume).
4. Read the Progress ledger (`TaskList`); pick the one phase `in_progress`, else the lowest open V-phase in `GOAL.md`.
5. Run the relevant smoke probe before editing (stack up? sidecar health-check? webhook round-trip? Brain reachable?).
6. State, in one line, the current subgoal and its exit gate. Then loop (§2).
