# Eikon Studio V1 Progress

_Last updated: August 2, 2026_

This document records implementation progress against [`PRD.md`](./PRD.md) so work can resume safely across development sessions.

## Current delivery state

- **Active phase:** Phase 2 — Storage inventory pagination repair
- **Status:** Poison-row, split-page, and drifting-cutoff repairs implemented and independently reviewed; PR delivery pending
- **Branch:** `fix/storage-inventory-pagination`
- **Base:** Storage inventory merge `origin/main@a060e05` (PR #18)
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

## Phase 2 credential-boundary slice

- Replaced new provider-credential writes with versioned AES-256-GCM envelopes using cryptographic 96-bit nonces and AAD bound to owner, canonical provider, stable handle, encryption version, and key version.
- Removed the production fallback secret. `CREDENTIAL_ENCRYPTION_SECRET` must be canonical base64 for exactly 32 bytes or operations fail closed.
- Preserved read-only legacy compatibility behind an explicit `LEGACY_CREDENTIAL_ENCRYPTION_SECRET`; no destructive migration or production rewrite is performed by this slice.
- Added atomic stable-handle reservation so concurrent credential saves cannot create AAD/handle mismatches.
- Replaced public plaintext-key reads with metadata-only provider credential summaries and reversible disable operations.
- Removed saved provider credentials and platform bearer tokens from browser persistence; newly typed values are cleared after save.
- Bound image generations to authenticated owner/provider/credential handles and removed plaintext keys and transient URLs from scheduler arguments.
- Routed studio image and platform API gateway provider calls through the same internal operation-scoped resolver.
- Removed browser-provided keys from video generation; video temporarily uses server deployment configuration until the durable video-job cutover.
- Added crypto, AAD isolation, metadata, resolution-policy, and source-boundary regressions. No real provider calls or production migration were performed.

## Verification evidence

Phase 2 storage inventory pagination repair:

- Replaced flattened reference occurrences with compact per-document reference groups so schema-valid arrays are preserved completely, including duplicate order, without response expansion per occurrence.
- Removed the artificial 16-reference guard that could turn a valid historical row into a permanent poison cursor.
- Both inventory APIs now use Convex `paginationResultValidator`, preserving `splitCursor` and `pageStatus` for `SplitRecommended` and `SplitRequired` handling.
- Storage pages accept the first server-derived `reviewBefore` on continuation calls, reject newer caller cutoffs, and clamp extremely conservative ages to Unix epoch `0`.
- Removed the arbitrary 90-day maximum; any safe-integer grace period of at least one hour is accepted.
- Source coverage now mechanically compares every schema `_storage` field with the inventory field registry, so a newly added field fails tests until inventoried.
- Five real Convex scenarios and six source-boundary tests cover 17-entry duplicate arrays, compact pagination, stable cross-page cutoffs, conservative epoch clamping, official split-result validators, and schema completeness.
- Focused web tests and typecheck passed; independent Codex review found and repaired the negative-cutoff continuation edge, then rereviewed cleanly.
- No provider request, deployment, production mutation, schema change, deletion, orphan classification, or migration occurred.

Phase 2 read-only storage reconciliation inventory exact-head verification:

- Added internal-only, read-only pages for minimal `_storage` metadata and every schema-defined application reference surface: generations, gallery, characters, durable outputs, and video generations.
- Scalar and array references are returned as compact opaque source/document/field/storage groups; prompts, filenames, owners, URLs, checksums, provider identities, and media bytes are excluded.
- Source rows are paginated with a 100-row cap, full schema-valid arrays are preserved, and storage review eligibility uses server `Date.now()` with a minimum one-hour grace period.
- The API explicitly reports only `eligibleForReview`; it never classifies an object as orphaned and contains no writes, deletion, URL resolution, or scheduler calls.
- Five real Convex integration scenarios and six source-boundary tests cover complete field coverage, row pagination, overflow, server-time cutoff, minimal metadata, invalid bounds, internal-only exposure, and read-only behavior.
- `pnpm install --frozen-lockfile` passed. Platform optional packages remain enabled because clean Vitest execution requires Rollup's native package.
- `pnpm turbo run test --force` passed **131 tests**: 39 core, 9 providers, and 83 web tests across nine files.
- `pnpm turbo run typecheck --force` passed all 4 tasks.
- `pnpm turbo run lint --force` passed with 0 errors and the existing 30-warning baseline.
- Placeholder-environment `pnpm turbo run build --force` passed all 3 tasks and produced all 22 routes.
- `git diff --check` passed; independent Codex review found no actionable correctness defect.
- No provider request, deployment, production mutation, schema change, storage deletion, orphan classification, or migration occurred.

Phase 2 fake-provider behavioral integration exact-head verification:

- Added official `convex-test@0.0.40`, the newest release compatible with the existing Convex `1.31.2` runtime, as a development-only dependency.
- The test-local fake provider executes the real schema and internal durable mutations; it does not duplicate the production state machine or issue network requests.
- Nine integration scenarios cover atomic create/replay/scheduler payload, duplicate delivery, crashes before and after dispatch, ambiguous timeout plus reconciliation, stale lease reclaim, verified storage/output/finalization, terminal replay, local/remote/unsupported cancellation, late completion, and unlinked legacy coexistence.
- `pnpm install --frozen-lockfile` passed with the minimal 12-line lockfile addition. Platform optional packages are required for clean Vitest/Rollup execution.
- `pnpm turbo run test --force` passed **120 tests**: 39 core, 9 providers, and 72 web tests across seven files.
- `pnpm turbo run typecheck --force` passed all 4 tasks.
- `pnpm turbo run lint --force` passed with 0 errors and the existing 30-warning baseline.
- Placeholder-environment `pnpm turbo run build --force` passed all 3 tasks and produced all 22 routes.
- `git diff --check` passed.
- Independent Codex review found no actionable correctness issue.
- No provider request, Convex/Vercel deployment, production mutation, runtime dependency upgrade, or production code path was introduced.

Phase 2 durable-image execution exact-head verification:

- `pnpm turbo run test --force` passed **111 tests**: 39 core, 9 providers, and 63 web tests across six files.
- `pnpm turbo run typecheck --force` passed all 4 tasks.
- `pnpm turbo run lint --force` passed with 0 errors and the existing warning baseline.
- Placeholder-environment `pnpm turbo run build --force` passed all 3 tasks and produced all 22 routes.
- `git diff --check` passed.
- Independent Codex review found and repaired an expired-job scheduler loop; the final rereview found no discrete correctness issue.
- PR #16 review repairs added stable client retry identity/reference reuse, replay re-enqueue, explicit ambiguous-expiry handling, advisory legacy mirroring, provider-identity audit failure classification, future-attempt selection, and stronger ordering/bounds regressions.
- No provider request, deployment, production migration, production mutation, or video cutover was performed while implementing or validating this slice.

Durable image execution now:

- atomically creates the legacy UI row, durable job/attempt/event, linkage, and opaque-ID scheduler record under owner-scoped request idempotency;
- resolves credentials and reference storage URLs only inside the server action before chargeable dispatch;
- persists `in_flight` before provider submission, disables OpenAI SDK retries, bounds both existing provider clients to 240 seconds, and uses OpenAI `request_id` / Google `responseId` as provider-native identities;
- marks uncertain transport outcomes ambiguous and never automatically resubmits reclaimed `in_flight`, accepted, or ambiguous work;
- renews token/epoch-fenced leases after provider and storage work, verifies Convex storage SHA-256 metadata, finalizes only durable outputs, and mirrors completion into the legacy read model idempotently;
- uses a bounded recovery tick for crashes, terminalizes eligible expired jobs without a scheduler loop, and fails closed on destructive deletion of active/completed durable audit or output state;
- preserves the old background action only for jobs already scheduled before cutover; no new start path schedules it.

Phase 2 durable-core exact-head verification:

- `pnpm turbo run test --force` passed **92 tests**: 39 core, 9 providers, and 44 web tests across four files.
- `pnpm turbo run typecheck --force` passed all 4 tasks.
- `pnpm turbo run lint --force` passed with 0 errors and the same 30 existing web warnings.
- Placeholder-environment `pnpm turbo run build --force` passed all 3 tasks and produced all 22 routes.
- `git diff --check` passed.
- Independent Codex review iteratively repaired lease timing, ambiguous-submission, cancellation-race, terminal-state, storage-existence, completion/output-linkage, and idempotent-replay findings; the final rereview found no discrete correctness issue.
- PR #14 review repairs added canonical request-metadata errors, replay-safe timestamp freshness, current-status reconciliation replays, live-lease failure fencing, bounded attempt reads, storage checksum verification, an expiry-sweep index, and independent transition/scheduler-boundary tests. Unsupported cancellation is recorded without falsely marking remote cancellation and does not strand provider work.
- No provider calls, deployment, production migration, destructive legacy rewrite, or legacy execution-flow integration occurred.

Fresh verification ran with Turbo cache bypass after the model catalog integration:

- `pnpm install --frozen-lockfile` — passed across all 4 workspace projects.
- `pnpm turbo run test --force` — passed:
  - Core: 39 tests across 4 files.
  - Providers: 9 tests across 1 file.
  - Web pricing/provenance: 5 tests across 1 file.
  - Total: 53 tests.
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

Phase 2 credential-boundary exact-head verification:

- Frozen workspace install passed with pnpm `10.18.3`.
- `pnpm turbo run test --force` passed **72 tests**: 39 core, 9 providers, and 24 web tests across two files.
- `pnpm turbo run typecheck --force` passed all 4 tasks.
- `pnpm turbo run lint --force` passed with 0 errors and the same 30 existing web warnings.
- Placeholder-environment `pnpm turbo run build --force` passed all 3 tasks and produced all 22 routes.
- `git diff --check` passed.
- Production browser smoke passed: `/auth` rendered without clipping/overflow, and unauthenticated `/studio/settings` showed only the sign-in boundary with no credential metadata or controls exposed.
- Convex codegen could not run in the isolated worktree because no `CONVEX_DEPLOYMENT` is configured; the generated API module registration was updated minimally and must be regenerated against the deployment before release.
- Independent Codex review found two legacy compatibility regressions; deterministic legacy metadata handles and exact historical-secret support were added, and the final rereview found no actionable correctness regressions.
- CodeRabbit found four actionable PR issues; realtime metadata, honest disable semantics, fail-before-reservation ordering, health-aware configured checks, and transient key-test handling were repaired. Additional bounded inventory and resolver-boundary hardening was included, and the repair rereview was clean.

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

1. Run full gates and adversarial review on the durable-image execution slice.
2. Open the bounded PR and inspect all current-head bot comments before merge.
3. Regenerate Convex bindings against a configured deployment before release.
4. Keep video and additional provider transports out of scope until this cutover is accepted.

## Phase roadmap

- [x] Phase 0 monorepo migration merged via PR #10 (`088a53f`)
- [x] Phase 1 foundation implementation: hardened shared contracts, lifecycle, registry vocabulary, and adapter boundary (local)
- [x] Phase 1 foundation independent review
- [x] Phase 1 foundation PR opened as #11
- [x] Phase 1 source-backed catalog and creator-ID integration implemented locally
- [x] Phase 1 model catalog independent review
- [x] Phase 1 model catalog merged via PR #12 (`9eb1f62`)
- [x] Phase 2 credential-boundary implementation and independent review
- [x] Phase 2 credential-boundary PR merged via PR #13 (`f00a9f8`)
- [x] Phase 2 durable lifecycle persistence substrate implemented and independently reviewed
- [ ] Phase 2 existing image transport durable execution cutover
- [ ] Phase 2 provider adapters and durable jobs
- [ ] Phase 3: Catalog, detail pages, and playground
- [ ] Phase 4: Creator and Developer dashboards
- [ ] Phase 5: Public API and SDKs
- [ ] Phase 6: Docs, deployment, and hardening
- [ ] Web Platform Gate
- [ ] Mobile phase
