# Fork of chatwoot/chatwoot

This repo is a **soft fork** of [`chatwoot/chatwoot`](https://github.com/chatwoot/chatwoot), maintained as `cognis-support` under the Cognis AI platform. License posture: MIT core only. The `enterprise/` directory (proprietary "Chatwoot Enterprise License") is stripped.

## Branches

| Branch | Purpose |
|---|---|
| `vendor/upstream` | Mirror of `chatwoot/chatwoot:develop`. NEVER edit. Rebased by the nightly bot. |
| `cognis/main` | Cognis work. Rebased monthly onto `vendor/upstream`. Default branch. |

## Commit prefixes (grep-friendly across rebases)

- `fork:` — surgical edits to upstream files (last resort; prefer Bridge integration)
- `brand:` — branding (initializer, assets)
- `wire:` — Cognis integration plumbing (auth middleware, Bridge clients)
- `ci:` — GitHub Actions, license gate, rebase bot
- `docs:` — FORK.md, CLAUDE.md, CODEOWNERS, READMEs

## Strip recipe (already applied on `cognis/main`)

1. `config/application.rb` — `Dir.exist?` guards around enterprise eager_load_paths
2. `git rm -rf enterprise/app enterprise/lib enterprise/config enterprise/LICENSE`
3. `enterprise/.gitkeep` retained so guarded paths see an empty directory

What's gone: Captain AI, SLA dashboards, audit logs, custom roles, advanced reporting, SAML SSO, voice calling.

Cognis re-implements as follows:
- SSO → Clerk (Cognis platform identity)
- Captain AI → AnythingLLM agent bot via Bridge
- Audit logs → Bridge `bridge_audit_log` table
- Voice → separate Phase 4 product (Cognis Voice)
- SLA, custom roles, reporting → not in Phase 1 scope

## Fork-diff target

≤0.1% of upstream LOC. Tracked on every PR via `git diff vendor/upstream...cognis/main --stat`. Hard cap 5% — build fails above that.

## Rebase cadence

- Nightly bot: `.github/workflows/upstream-rebase.yml` runs at 06:00 UTC
- Auto-merge clean rebases via Mergify
- Conflicts → bot opens issue labeled `rebase-conflict`; human review
- Shared `rerere-cache` committed to `cognis-platform/infra/rerere-cache/cognis-support/`

## Upstream-PR policy

Contribute back to `chatwoot/chatwoot` *before* merging to `cognis/main`:
- Bug fixes, perf patches, test improvements, i18n, a11y, refactors that shrink fork diff

Keep in fork (do NOT upstream):
- Clerk / Stripe / LiteLLM / Cognis-branded code
- Cognis-specific multi-tenant primitives, billing meters, audit integration

## References

- License-trap detection: `cognis-platform/docs/specs/fork-ops.md`
- Chatwoot integration spec: `cognis-platform/docs/specs/chatwoot-integration.md`
