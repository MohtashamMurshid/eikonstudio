# Eikon Studio V1 Progress

_Last updated: August 2, 2026_

This document records implementation progress against [`PRD.md`](./PRD.md) so work can resume safely across development sessions.

## Current delivery state

- **Active phase:** Phase 1 — Canonical model catalog and creator integration
- **Status:** Source-backed catalog slice implemented, locally verified, and independently reviewed on top of the Phase 1 contracts head; awaiting stacked PR checks
- **Branch:** `feature/phase-1-model-catalog`
- **Base:** Phase 1 contracts head `3a8391a`
- **Phase 0:** Merged through [PR #10](https://github.com/MohtashamMurshid/eikonstudio/pull/10) in merge commit `088a53f`

## Phase 1 foundation slice

Implemented locally in this slice:

### `@eikonstudio/core`

- Strict Zod 3 vocabulary for the six canonical providers and ten PRD model families.
- Stable branded IDs for model variants, schema revisions, generations, jobs, attempts, events, assets, pricing rules, credential handles, and webhook handles.
- Immutable Eikon model IDs separated from provider-native model, version, endpoint, and capture snapshots.
- Operation-specific image/video capability records with typed input roles, limits, execution mode, webhook/poll/cancel support, and schema revisions.
- Fail-closed model execution: discovered, deprecated, or disabled variants cannot be submitted as executable models.
- Explicit generation state machine for `queued → submitting → processing → persisting → completed` and terminal alternatives.
- Optimistic transition commands requiring expected status and revision; stale status/revision/generation updates are rejected.
- Atomic create-and-schedule command/port contracts with idempotency, attempt, retry, poll, and maximum-age metadata.
- Deterministic completion identities for duplicate webhook/poll completion protection.
- Strict owned-storage, provider-transport, and untrusted remote-media reference schemas.
- Remote media and webhook callback targets remain non-fetchable until policy approval evidence exists; URL-bearing contracts require HTTPS.
- Safe public errors separated from private, explicitly redacted provider-native envelopes.
- Public provider-credential metadata exposes opaque handles and masked hints only.
- Immutable submitted-estimate and reported/synced actual-cost snapshots with pricing provenance and source-specific timestamps.
- Legacy generation provenance for later image/video data migration.
- Canonical persisted/public schemas avoid coercion, transforms, catches, and implicit defaults.

### `@eikonstudio/providers`

- Complete eleven-method PRD adapter boundary.
- Focused credential, catalog, input, execution, output, and webhook operation interfaces rather than an optional-method inheritance tree.
- Opaque credential references and server-only credential resolution boundary; plaintext key maps are absent from adapter DTOs.
- Provider transport capabilities kept separate from model-variant operation capabilities.
- Raw-byte webhook verification input with normalized multi-value headers, method/path/query, credential/webhook handles, and receipt time.
- Verified/rejected webhook result union with delivery, signature/key version, replay-token, and bounded rejection reasons.
- Safe public error fixture that does not copy arbitrary native error messages or stacks.
- Runtime adapter shape assertion and tested mock adapter.

### Workspace integration

- Added root `pnpm test` orchestration through Turbo.
- Added package build/typecheck/test scripts and valid `dist` exports.
- Added package build dependency ordering and `dist/**` Turbo outputs.
- Updated root documentation and regenerated the single pnpm lockfile.

Deliberately out of scope:

- Provider SDK/network implementations
- Convex schema and data migration
- Durable workers, polling, reconciliation, or webhook routes
- UI and public API integration
- Secret/deployment configuration changes

## Model catalog slice

- Added a strict canonical catalog schema and registry in `@eikonstudio/core`, checked **2026-08-02**, covering every verified variant across all ten PRD families.
- Kept provider lifecycle/availability distinct from Eikon readiness/execution support. Preview, deprecated, uncertain, regional, and entitlement-restricted entries remain publicly visible even when Eikon cannot execute them.
- Added public `/models` search and provider/media/readiness filters with first-party source links.
- Derived the image creator selector from the registry and limited it to the three actually integrated IDs: `gemini-3.1-flash-image`, `gemini-3-pro-image`, and `gpt-image-2`.
- Updated Convex validators, generation routing, schema, public API documentation, and provider-key selection for those IDs.
- Added source-backed, model-specific generation cost estimates with legacy-preview provenance preserved for historical rows.
- Made direct web builds prebuild `@eikonstudio/core` so a clean install does not depend on stale `dist/` output.

## Verification evidence

Fresh verification ran with Turbo cache bypass after the model catalog integration:

- `pnpm install --frozen-lockfile` — passed across all 4 workspace projects.
- `pnpm turbo run test --force` — passed:
  - Core: 38 tests across 4 files.
  - Providers: 9 tests across 1 file.
  - Web pricing: 4 tests across 1 file.
  - Total: 51 tests.
- `pnpm turbo run typecheck --force` — passed: 4 tasks.
- `pnpm turbo run lint --force` — passed: 0 errors and 30 pre-existing web warnings.
- Placeholder-environment `pnpm turbo run build --force` — passed:
  - Core package build.
  - Providers package build.
  - Next.js production build with all 22 routes, including `/models`.
- Removed package `dist` and web `.next`, then ran `pnpm --dir apps/web build` directly — passed; the web script rebuilt `@eikonstudio/core` from source before Next.js.
- Started the production server and requested `/models` — HTTP 200; rendered the catalog title and canonical `gpt-image-2` content.
- Browser QA verified the desktop catalog layout plus Nano Banana Pro search (1/93), deprecated readiness filtering (7/93), and filter reset behavior.
- Independent Codex review completed after iterative clean-checkout, migration-provenance, and model-pricing repairs; final rereview found no correctness regression.
- `git diff --check` — passed.

Focused regressions cover:

- complete legal/illegal lifecycle transition matrix and immutable terminal states;
- stale status/revision/generation transition preconditions;
- atomic scheduling constraints and deterministic completion identity;
- stable IDs, model ownership, executable readiness, and operation capabilities;
- canonical no-default request behavior;
- opaque credentials and absence of recoverable secret maps;
- public/private error separation;
- pending/approved/rejected remote-media handling and HTTPS-only URLs;
- immutable estimate vs reported/synced cost snapshots;
- raw webhook bytes, multi-value headers, verified metadata, stale/replay/encoding rejection shapes;
- all eleven required adapter methods and operation-specific mock execution.

Expected existing warnings remain:

- pnpm reports the existing `better-call` / Zod peer mismatch and ignored dependency build scripts.
- The web lint task reports 30 existing warnings.
- Next.js reports stale `baseline-browser-mapping` data during build/lint.
- Vercel Preview has a pre-existing private configuration failure also observed before Phase 1.

## Next actions

1. Commit, push, and open a stacked catalog PR against `feature/phase-1-core-contracts`.
2. Inspect current-head CI and review comments; do not merge without explicit approval.
3. After PR #11 lands, retarget/rebase the catalog slice onto `main` before merge.

## Phase roadmap

- [x] Phase 0 monorepo migration merged via PR #10 (`088a53f`)
- [x] Phase 1 foundation implementation: hardened shared contracts, lifecycle, registry vocabulary, and adapter boundary (local)
- [x] Phase 1 foundation independent review
- [x] Phase 1 foundation PR opened as #11
- [x] Phase 1 source-backed catalog and creator-ID integration implemented locally
- [x] Phase 1 model catalog independent review
- [ ] Phase 1 model catalog stacked PR
- [ ] Phase 1 persistence integration
- [ ] Phase 2: Provider adapters and durable jobs
- [ ] Phase 3: Catalog, detail pages, and playground
- [ ] Phase 4: Creator and Developer dashboards
- [ ] Phase 5: Public API and SDKs
- [ ] Phase 6: Docs, deployment, and hardening
- [ ] Web Platform Gate
- [ ] Mobile phase
