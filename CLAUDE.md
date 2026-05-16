# Cognis Support — repo context for Claude

This is a soft fork of `chatwoot/chatwoot`. **The fork is not the product — `cognis-platform/apps/bridge` is.** Every hour spent editing Rails controllers here costs 3× at next rebase.

## Branches

- `cognis/main` — default. Cognis work.
- `vendor/upstream` — mirror of chatwoot:develop. NEVER edit.

## Hard rules

1. **Never restore `enterprise/`.** Stripped at fork time; rebuilding enterprise features here is forbidden. They live in Bridge or are out of scope.
2. **Never edit upstream Rails files.** Use Rails initializers, rack middleware, or Bridge webhooks. If you must touch an upstream file, the PR upstream is mandatory before merging to `cognis/main`.
3. **Fork-diff cap: 5% of upstream LOC.** Tracked per-PR. Target ≤0.1%.
4. **Commit prefixes only:** `fork:` / `brand:` / `wire:` / `ci:` / `docs:`.
5. **All Cognis-specific code that isn't pure branding goes in Bridge.** This repo holds: branding initializer, optional Clerk auth rack middleware, FORK.md/CLAUDE.md/CODEOWNERS.

## What lives here

- `config/initializers/cognis_branding.rb` — InstallationConfig overrides (BRAND_NAME, LOGO, URLs)
- `public/brand-assets/cognis-*.svg` — branded logos
- `.github/workflows/license-gate.yml` — ScanCode CI gate (blocks proprietary licenses sneaking in)
- `.github/workflows/upstream-rebase.yml` — nightly rebase bot
- `tools/check_no_proprietary.py` — license allowlist enforcement

## Build & test

This is upstream Chatwoot: `bundle install`, `bundle exec rspec`, etc. See upstream README.

## Auth pattern with Bridge

Default = Pattern A (Bridge proxy). Cognis portal calls Bridge, Bridge holds the Chatwoot Platform API token, Bridge proxies requests with `api_access_token` header. Token never reaches the browser.

Pattern B (rack middleware in this repo) only if direct dashboard access is required. One file: `app/middleware/clerk_bridge_auth.rb`.

## Cost policy

This fork inherits Cognis's managed-SaaS cost policy — see `../cognis-platform/docs/specs/cost-policy.md` for the full per-fork list and rationale. For `cognis-support` specifically, in production deploys DO NOT set: `SENTRY_DSN`, `NEW_RELIC_LICENSE_KEY`, `SCOUT_KEY`, `ELASTIC_APM_SERVER_URL`, `ELASTIC_APM_SECRET_TOKEN`, `AMPLITUDE_API_KEY`. All are optional in upstream Chatwoot and stay inert without env vars. Use Langfuse + internal Prometheus instead.

## What NOT to do

- Don't run Chatwoot's Enterprise install scripts
- Don't add NestJS / Bridge logic here — that's in `cognis-platform/apps/bridge`
- Don't touch `vendor/upstream` directly — it's a mirror branch
- Don't commit credentials; `.env.local` is gitignored upstream
