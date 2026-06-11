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

## Branding asset layer (2026-06-11, theming spec + Gate 2)

Per `cognis-platform/docs/design/theming/cognis-support.md` as amended by
`cognis-platform/docs/design/gate2/cognis-support-verification.md`. All color
values derive from `cognis-platform/packages/design-tokens/tokens.json`
(canonical). Accent question Q1 (brand primary vs `color.product.support`) was
unanswered — defaulted to the canonical `color.brand.primary` `#0099ff`.

**Additive (cognis-owned):**

- `public/brand-assets/cognis-logo.svg`, `cognis-logo-dark.svg`,
  `cognis-thumbnail.svg` — closes parity gap W5.1. Wordmark = `CognisAi.` in
  Inter SemiBold (outlined from the fork's bundled
  `app/javascript/shared/assets/fonts/Inter/Inter-SemiBold.woff2`), `Ai` in
  `color.brand.primary`, rest `color.brand.fg` / `color.brand.on-dark`;
  square mark = the press-kit symbol (gradient `color.brand.primary` →
  `color.brand.navy-deep`, inner white square). Provenance comments embedded
  in each SVG.
- `config/initializers/cognis_branding.rb` — added `MAILER_SUPPORT_EMAIL`
  (mailer branding via settings, never template edits).
- `cognis/e2e/tests/branding.spec.ts` — 4 new asset-integrity tests (SVG 200s,
  login logo decodes, theme-color match, favicon/badge swap pair).

**Upstream-file edits (justified, minimal, logged per fork-ops):**

- `public/*.png` icon set (30 files, binary swaps; keep-ours on rebase
  conflict): `favicon-{16,32,96,512}`, `favicon-badge-{16,32,96}` (badge dot =
  `color.semantic.critical`; the `faviconHelper.js` filename swap contract is
  load-bearing — replace, never rename), `android-icon-*`, `apple-icon-*`,
  `apple-touch-icon*`, `ms-icon-{70,144,150,310}`. All rendered from the
  `cognis-thumbnail.svg` master geometry. `DISPLAY_MANIFEST` stays `true`.
- `public/manifest.json` — `background_color`/`theme_color` `#1f93ff` →
  `#0099ff` (`color.brand.primary`); PWA chrome showed Chatwoot blue under the
  Cognis name.
- `app/views/layouts/vueapp.html.erb` — exactly 2 attribute values:
  `msapplication-TileColor` + `theme-color` meta `#1f93ff` → `#0099ff`.

**Deliberately NOT done:** `public/brand-assets/logo*.svg` in-place overwrite
(spec §3.3) — gate2 conditioned it on founder sign-off for the incidental
`/super_admin` reskin (Q3), still unanswered. `ShareModal.vue:98` therefore
still loads the upstream-named `logo.svg`. Non-English locale sweep — descoped
to English-only. `LOGOUT_REDIRECT_LINK` — waits for portal SSO Pattern A.

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
