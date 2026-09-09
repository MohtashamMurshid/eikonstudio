## Durable Veo creator cutover, September 8, 2026

- Implemented the scoped creator cutover on base `20201bb`. The mounted creator submits through an authenticated `startCreatorVideo` boundary and subscribes to owned jobs through `getVideoCreatorState`. Browser provider polling, direct legacy-route submission, simulated percentages, browser result persistence, and deployment-key fallback are no longer part of this creator path.
- An owner-scoped localStorage journal persists the request identity before dispatch. Duplicate clicks and refresh after lost mutation responses never automatically submit again. Exact request lookup recovers older jobs beyond the recent history window. Unchanged-input events retain identity; changed inputs or explicit New generation prepare a distinct identity. New alone does not submit. Invalid/unavailable request storage fails closed.
- Account changes remount the form, and server entry points independently verify the requested owner. Credential reads are Google metadata only. Status reflects queued/submitting/processing/persisting/terminal/ambiguous state, and only finalized owned persisted output URLs are rendered. Requested duration/resolution are labeled as request settings; unsupported cost estimates were removed.
- Text, first-frame, and ordered first/last-frame modes remain supported, including duplicate frames. Controls enforce 16:9/9:16, 720p/1080p, and 4/6/8 seconds; two frames or 1080p require eight seconds, with audio enabled.
- The input audit found that legacy gallery registration accepts caller-supplied storage IDs without establishing blob ownership. The creator therefore verifies gallery frames against owned finalized durable image outputs and matching storage size/checksum and PNG/JPEG metadata, both for selection and transactionally before new submission. Added a bounded output storage index and reused the existing checksum normalization helper. The original durable start, worker, replay, and recovery semantics are preserved.
- File uploads and character/asset references are explicitly disabled. Secure raw upload registration remains deferred. Frame selection considers the latest 100 gallery rows and at most 16 output candidates per storage ID; job subscriptions show the latest 100 visible rows plus the exact journal request. Browser-storage clearing and independent drafts across devices/tabs are not synchronized draft recovery.
- Measured affected validation passed **116/116 tests** across three files: 23 session-controller tests, five component interaction/render tests, and 88 durable-video integration tests. The 32 added cases cover duplicate clicks, lost committed responses, refresh, ownership/account changes, ordered/repeated references, forged gallery ownership, unsupported settings, storage failures, terminal/ambiguous no retry, safe errors, and persisted results. Component tests use actual JSX handlers with an injected hook boundary and static rendering; the controller also runs against real synthetic Convex mutations/queries/worker actions. These are offline behavioral tests, not authenticated browser verification.
- Final workspace gates ran sequentially, uncached, with sanitized placeholder configuration and inspected Next dotenv suppression: **568/568 tests** (40 core, 162 providers, 366 web), typecheck **5/5 tasks**, lint **0 errors and 31 existing warnings**, and build **3/3 tasks with 22 routes**. Gate output and exit codes, including repaired intermediate failures, are in `/tmp/eikon-veo-creator-validation.log`; the precise summary is `/tmp/eikon-veo-creator-summary.md`.
- Remaining release work includes independent diff review, deployment codegen/bundle/index validation, and authenticated browser verification. Ambiguous jobs still need reconciliation; posters, verified output media metadata, cost reporting, and public video cancellation/tombstones remain outside this slice. The legacy `/api/generate-video` route is unchanged and is not retired. No other model/provider/image/gateway path or generated binding changed. No .env/credential-file read, live provider call, production query, deployment, migration/backfill execution, deployment-dependent codegen, physical deletion, commit, push, PR, or merge occurred.

# Eikon Studio V1 Progress

## Creator cutover publication checkpoint

- Manual review completed for controller, mounted UI, owner-keyed hook and server start/subscription boundaries. Corrected shared frame ownership and unfinished whitespace-draft restoration. External independent creator review did not complete; no independent approval is claimed.
- Final sequential uncached gates: core 40, providers 162, web 374 tests passed; typecheck, lint, build and diff check passed. Current logs: `/tmp/veo-creator-final-{test,typecheck,lint,build}.log`.
- Creator changes are being published for review in draft PR #32, not merged or deployed. Earlier local/unpublished checkpoints below are historical. Raw uploads, character references, legacy route retirement, authenticated browser/deployment/codegen verification remain deferred.


## Creator shared ownership repair — local, awaiting completed review

- Both public durable video start mutations now validate frames through the same finalized owned-output check in their shared start function. Exact owner-scoped idempotent replay still precedes reference revalidation. Removed duplicate creator-only validation.
- Added public-entry-point regressions for unverified frame rejection without video creation, repeated owned frames, exact replay after reference removal, and collision rejection. Updated old gallery-only fixtures to include verified output provenance. Fixed the history empty-state display with three SSR regressions.
- Final local sequential uncached gates passed: core 40, providers 162, web 371 tests; typecheck, lint, build and diff check passed. Logs: `/tmp/veo-owner-{test,typecheck,lint,build}.log`.
- The external creator review exited before producing a report; these checks do not establish a clean independent review. Creator cutover remains uncommitted and unpublished. No deployment, live provider requests, or backfill execution occurred.


_Last updated: September 8, 2026_


## Durable Veo integration slice, September 8, 2026

Implemented in the isolated worktree based on main `cb9a8e0`, which includes PR #30 and PR #31. The implementation is uncommitted and awaiting independent review.

- Added `videoGenerations.startDurableVideo`: one authenticated transaction checks an active saved Google credential, resolves up to two owned gallery frames in order, retains their storage references through the existing ledger, and creates the video row, durable job/attempt/event, linkage, and initial opaque-ID schedule. Replays compare canonical request values and verify the existing job binding. One starting frame or ordered first/last frames use the merged Veo adapter; no provider transport was reimplemented.
- The node worker resolves the owner/provider/handle-bound encrypted credential for each operation. It persists fenced `in_flight` state before its only submission, stores the exact native `models/veo-3.1-generate-preview/operations/...` identity, and never resubmits an uncertain, accepted, persisting, or terminal request. Image identity validation retains its original grammar.
- Accepted work uses one poll per scheduled delivery. Transactional lease release schedules capped exponential delays with stable per-job jitter, a 60-scheduled-step limit, and a 30-minute maximum job age. Claims atomically schedule lease recovery. Renewals fence stale network results before storage; recovered in-flight submissions become ambiguous. Unsupported cancellation is observed without pretending upstream work stopped, and native cancelled results become cancelled jobs.
- Download approval checks the exact poll/request/locator binding and the two existing Google file-download URL shapes before resolving credentials. Downloads use injected fetch, header-only authentication, no redirects, an exact response-URL check, a two-minute timeout, and a 100 MB header/stream byte cap. MIME, `ftyp`, and declared-length checks precede SHA-256 calculation. Completion, Convex storage, the output-reference ledger, and finalization use the existing durable mutations and checksum verification. A recovered completion without storage re-polls the same operation and requires matching bytes; an existing durable output finalizes without network access.
- Added an owned Convex subscription query and a durable video section in video history. It exposes finalized Convex URLs and durable status, including an explicit ambiguous-outcome message. Durable rows have separate indexes and do not enter legacy video history or its unverified cost formulas. Durable deletion fails closed; terminal/tombstoned replay does not delete or resurrect records or blobs.

Verified locally, with all command output and the earlier failed iterations retained in `/tmp/eikon-veo-validation.log`:

- `CI=true corepack pnpm install --frozen-lockfile` passed.
- Final uncached workspace tests passed **507 tests**: 40 core, 162 providers, and 305 web. The new video suite has **61 cases**, using real `convex-test` actions, mutations, queries, and storage plus direct download-boundary checks. Coverage includes atomic/concurrent creation, ownership, credential health/AAD checks, ordered and duplicate frames, processing/transient polls, ambiguous dispatch, stale/concurrent deliveries, terminal failures/cancellation, malicious locators, redirects, declared and streamed oversize, stalled downloads, checksum/completion/storage replay, history isolation, expiry, and zero resubmission.
- Final workspace typecheck passed all five tasks. Lint passed with 0 errors and the existing 31 warnings. The placeholder-environment production build passed all three tasks. These final gates ran sequentially, avoiding the Next generated-type race. `git diff --check` passed.

Known limitations and release blockers:

- The creator and `/api/generate-video` route still use the legacy flow. They are not cut over to the new start mutation. Their additional asset/character-reference semantics need an explicit UI decision; the durable slice currently accepts saved owned gallery frames, not new file uploads. The new backend path is exercised internally, and durable history is wired to subscriptions; authenticated browser behavior remains unverified.
- No poster generation, full MP4 decoding/probing, verified output dimensions/duration, durable-video cost reporting, public video cancellation control, or durable-video tombstone mutation is included. Requested duration is retained as request metadata. Durable-video deletion is blocked until the tombstone path is implemented. A crash between `storage.store` and output-ledger recording can leave a retained unreferenced blob; this slice never deletes it.
- The installed Convex CLI's application codegen path requires deployment selection and a component push. Its hidden system-UDF-only path is not an application offline-codegen workflow. Deployment-backed codegen was not invoked under this task's constraints. Functions are registered in the existing `videoGenerations`, `durableJobs`, and `imageGeneration` modules, whose existing generated types infer the new exports. Generated bindings were not hand-edited. Deployment codegen/bundle validation remains unverified.
- No real provider credentials, live provider requests, deployment, production queries, backfill operation, migration, physical blob deletion, configuration copied from another checkout, commit, push, PR, or merge was performed. Existing backfill/storage suites ran only inside their isolated test databases as part of workspace tests.

## Veo asynchronous adapter, September 6, 2026

- Verified that PR #30 merged as `4b44b04`, both automated reviews passed, and the production deployment for that commit succeeded. The public site returned HTTP 200. The old PR Preview check remains a historical failure; production success alone does not verify Preview configuration.
- Added the first shared Google Veo adapter on `codex/phase2-veo-adapter`, targeting the existing `veo-3.1-generate-preview` Gemini API model. It supports text generation, one starting frame, and ordered first/last frames through the canonical video request contract. Public catalog readiness and creator selectors are unchanged.
- Submission makes one REST request and returns the native operation name. Polling makes one GET per call, preserves exact operation identity, and distinguishes processing, completion, terminal provider errors, moderation blocks, and cancellation. Scheduling and retries remain the durable caller's responsibility.
- Validates supported model/schema/task/options, one output, 720p/1080p and duration combinations, always-on audio, and owned PNG/JPEG references before credential access. Reference resolution preserves order, bounds each frame at 25 MB, and rejects partial inputs. Requests use an injected server credential broker and injected fetch with timeouts, bounded JSON responses, no redirects, and no automatic retries.
- Completed polls return a request-bound video transport locator, not a stored Eikon asset or permission to fetch it. Exact Google file-download URL shapes are checked; credentials, arbitrary query parameters, alternate hosts, malformed paths, and unrecognized operation IDs are rejected. Provider response text, messages, details, and safety explanations are excluded from normalized errors.
- Unsupported credential validation, pricing, provider cancellation, webhooks, and durable output normalization fail locally. Video download policy, storage persistence, durable job scheduling, legacy-route replacement, and UI migration remain the next integration slice. No Convex deployment or production change is part of this adapter slice.
- Verification passed **446 tests**: 40 core, 162 providers, and 244 web, including 73 new Veo cases. Workspace lint passed with 0 errors and 31 existing warnings. Production build and workspace typecheck passed separately after the initial simultaneous run exposed a race in Next.js generated type files. No dependency changes were required.
- Checked the [Google Veo REST guide](https://ai.google.dev/gemini-api/docs/veo?hl=en) and installed Google SDK converters on September 6. Live checks caught a mismatch with the current REST examples. Frame requests now use the SDK wire format, bytesBase64Encoded plus mimeType. A four-second text request and an eight-second first/last-frame request both completed through the new adapter and returned one validated output locator. Earlier frame attempts returned HTTP 400; two-frame requests shorter than eight seconds now fail preflight. Live checks used the existing development Gemini key, which stayed out of logs and tracked files. Outputs were not downloaded or persisted as durable assets in this slice.

## Review and development verification follow-up, September 6, 2026

- Reviewed the image adapter migration and ran it on the existing development deployment. Regenerated Convex bindings with `pnpm codegen` and deployed the branch with `convex dev --once --typecheck enable --tail-logs disable`.
- Fixed local Google sign-in redirecting to production. The development deployment's `SITE_URL` was the production domain; `DEV_SITE_URL` is unused by the auth code. Set the development `SITE_URL` to `http://localhost:3000` and corrected README setup instructions. Completed Google sign-in in the browser, returned to local Studio, and verified the session survives refresh.
- Configured the missing development credential-encryption secret and saved the existing development Gemini and OpenAI keys as encrypted credentials for the signed-in development account. Secret values stayed out of logs and tracked files.
- Live testing exposed a provider request-identity rejection. The worker and ledger required an alphanumeric first character, which excludes valid base64url identities beginning with `-` or `_`. Both now share the same bounded validator and preserve those native identities verbatim. Four regression cases cover generation/editing, persisted submission/completion identity, and worker redelivery without a second provider call. They failed against the original validator and pass with the fix.
- Authenticated live generation and editing succeeded for all three models: Gemini Flash, Gemini Pro, and OpenAI GPT Image 2. OpenAI was exercised through local Studio; Google requests used the normal authenticated generation action with the existing signed-in development session. History refresh displays the saved results.
- All six completed outputs have matching durable SHA-256 checksums and byte sizes, and both original and thumbnail URLs returned HTTP 200. All images decode at 1024 × 1024, with red generation outputs and blue edited outputs. Redelivering all nine completed/ambiguous smoke jobs preserved attempt records, outputs, request identities, and job revisions.
- Three earlier Flash text samples remain recorded as ambiguous and were not resubmitted. The first failed request-identity validation; two later samples returned the generic unknown-outcome error without enough retained detail to establish their cause. Fresh Flash generation/editing samples succeeded. Added server diagnostics limited to normalized category/code, HTTP status, transport-entry flag, model/provider, and job ID so future failures can be investigated without logging provider bodies or credentials.
- Addressed the automated review finding that Gemini HTTP 200 safety blocks were treated as ambiguous. Explicit adapter-normalized moderation failures now terminate with the correct public error. Eight action regression cases cover prompt/candidate blocks across both Gemini models and modes, redacted errors, no output/completion records, and redelivery without resubmission. All eight failed before the fix and pass afterward.
- Final uncached workspace test, typecheck, lint, and build gates passed all ten tasks and **373 tests**: 40 core, 89 providers, and 244 web. Lint has 0 errors and 31 existing warnings; the production build produced 22 routes.
- Published [PR #30](https://github.com/MohtashamMurshid/eikonstudio/pull/30). Vercel Preview stops before compilation because Preview is configured with a production Convex deploy key. The deployment log confirms this mismatch; base PR #29 also has a failed Vercel check. No production-key override was used.
- Changes are isolated in the review worktree. The original checkout retains the startup correction and updated local-auth instructions. Production was not deployed or merged.

## Existing image adapter migration, September 6, 2026

- Preserved the startup fix in this worktree: providers now declare `@types/node: ^22`, the OpenAI adapter explicitly imports `Buffer` from `node:buffer`, and the lockfile has only the corresponding three-line importer addition. The original checkout and its dev server were not modified.
- The durable studio worker now uses shared adapters for all six existing model/mode combinations: `gemini-3.1-flash-image`, `gemini-3-pro-image`, and `gpt-image-2`, each for generation and editing. The old helper remains available only to legacy/background and gateway execution; public routes and video are outside this cutover.
- Google uses a single injected REST request to the existing `v1beta` generateContent endpoint. Text generation retains aspect ratio and image size; edits retain references before the prompt and omit generationConfig, matching the previous implementation. OpenAI edits use multipart uploads and retain the existing size/quality mapping. The creator model list is unchanged, and adapter IDs come from the existing catalog so canonical `gemini-3-1-flash-image` remains distinct from native `gemini-3.1-flash-image`.
- References stay in Convex storage. The server reads only the job's bound storage IDs, validates all references before credential resolution, preserves order and duplicates, and refuses missing, empty, oversized, or unsupported references instead of submitting a partial edit. The existing four-reference limit remains; this adapter supports PNG, JPEG, and WebP, matching normal studio upload conversion. Each reference is capped at 25 MB. OpenAI text outputs retain the 25 MB decoded cap; Google and OpenAI edit outputs retain the prior 20 MB base64 ceiling, equivalent to 15 MB decoded. Shared response reads enforce a byte cap before JSON parsing, and base64 validation no longer uses a repeated-group regex that can overflow on large valid images.
- Plaintext stays within the server credential callback. Every provider request uses injected fetch, a maximum 240-second timeout, no automatic retries, and no redirects. The OpenAI SDK's FormData probe receives a local Response constructor so it cannot call the injected transport before the actual edit request.
- The worker persists in-flight state before transport and retains the existing lease, ambiguity, recovery, checksum, completion/output ledger, finalization, and legacy mirror rules. Malformed successes and uncertain transport outcomes never trigger automatic resubmission. Google errors retain only allowlisted categories/statuses, and temporary thought images are excluded from successful output.

Verification in this worktree:

- Startup-fix baseline passed the original 48 provider tests and provider typecheck.
- Frozen install passed. Full uncached test/typecheck run passed all eight tasks and **361 tests**: 40 core, 89 providers, and 232 web.
- The 60 durable action integration cases use real Convex functions and storage through `convex-test`, with injected provider fetch and an injected authentication identity for history queries. They cover all six combinations, request mapping, credential disablement, preflight rejection, concurrent dispatch, definitive errors, ambiguous outcomes, stored images and Jimp thumbnails, checksums, ledger/finalization records, owner-scoped history URLs, retained reference bytes, and mirror repair without another provider submission. The existing lifecycle, cancellation, expiry/recovery, tombstone, and storage reconciliation suites also pass.
- Workspace lint passed with 0 errors and the existing 31 warnings. Placeholder-environment production build passed all three tasks and produced 22 routes.
- `pnpm dev -- --port 3107` built providers and started Next.js. `/models` and `/auth` returned HTTP 200 using placeholder Convex URLs. The temporary server was stopped after this smoke check; this does not verify authenticated UI or a deployed backend.
- `pnpm codegen` built providers and reached the Convex CLI, then stopped with `No CONVEX_DEPLOYMENT set`. This isolated worktree has no `.env.local`, Convex deployment binding, or provider credentials in its environment. No bindings were hand-edited. Development-deployment codegen and authenticated live-provider generation, refresh/history, errors, and recovery remain unverified.
- Dependency warnings remain for the existing Better Call/Zod and Vite/Node-types peer ranges, ignored dependency build scripts, and stale baseline-browser-mapping data.

Primary references checked on September 6: [OpenAI image edit API](https://developers.openai.com/api/reference/resources/images/methods/edit), [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation), and [Google generateContent image guide](https://ai.google.dev/gemini-api/docs/generate-content/image-generation). Provider documentation establishes request support; local injected tests do not establish account access or live model availability.

## Audited first provider artifact: OpenAI GPT Image 2 text-to-image, September 1, 2026

- Added the first network-capable `@eikonstudio/providers` adapter for synchronous `gpt-image-2` text-to-image generation. No Convex, route, schema, generated binding, deployment, or live-provider behavior changed.
- Added a constructor-injected server credential broker. Plaintext credentials exist only inside its callback and are passed only to the SDK authorization header.
- Extended the stable eleven-method adapter boundary with an explicit synchronous result carrying ephemeral image bytes. Durable asset creation remains outside the provider package.
- Pinned the OpenAI SDK to the official API base URL with injected fetch, zero SDK retries, a bounded timeout, caller abort support, one PNG/base64 output, and native request IDs from `.withResponse()`. The injected transport bounds declared and chunked response bodies before SDK JSON parsing, cancels oversized streams, and maps overflow to a non-retryable validation failure.
- Added fail-closed model, task, operation, schema, prompt, reference, and output-count validation before credential resolution. Malformed, empty, URL-based, oversized, or unidentified successful responses are rejected.
- Added typed local failures for unsupported credential validation, cost estimation, polling, cancellation, output normalization, and webhook verification. These paths make no network request.
- Normalized only allowlisted HTTP status and native error codes. Provider messages, bodies, headers, stacks, prompts, URLs, and credentials are excluded from public and private error envelopes. Retryability describes the failure only; the adapter never resubmits.
- Added injected one-shot fetch coverage for exact URL, request JSON and authorization, secret confinement, exact output bytes and metadata, malformed responses, declared/chunked response bounds, preflight rejection, status/network/timeout/abort mappings, hostile-message redaction, and zero hidden retries.
- Full verification passed **238/238 tests**: 39 core, 38 providers, and 161 web; typecheck passed 4/4, lint passed with 0 errors and 31 existing warnings, the placeholder production build produced 22 routes, and `git diff --check` passed. Specialist and iterative independent reviews were clean before commit.

## Audited internal ledger operations control plane — August 16, 2026

- Added an internal-only aggregate status query and explicit one-step advancement action for the storage-reference ledger backfill and verification workflow.
- Pinned canonical source/direction ordering, the 16-row page size, and canonical caller-supplied run keys; the action reads status once and invokes zero or one existing mutation.
- Added bounded dual-index uniqueness sentinels and fail-closed validation for checkpoint, run, scope, counter, fingerprint, cutoff, blocked-state, and finalization-coordinate metadata.
- Preserved literal-false authority and physical-deletion fields in every status and advancement result. No public endpoint, storage/provider access, scheduler, reset, repair, promotion, classification, or deletion capability was added.
- Added `convex-test` integration coverage and static source-boundary tests for ordering, one-step dispatch, blocked 5/10-scope no-op behavior, initialization/resume/cutoff behavior, exact run-key rejection, independent keys, duplicate corruption, phase/checkpoint invariants, resumable mid-checkpoint finalization, commitment/evidence validation, exact page-result unions, and prohibited capabilities.
- Full verification passed **209/209 tests**: 39 core, 9 providers, and 161 web; typecheck passed 4/4, lint passed with 0 errors and the existing 30-warning baseline, the placeholder production build produced 22 routes, and `git diff --check` passed. Specialist and iterative context-aware adversarial reviews were dispositioned before commit.

This document records implementation progress against [`PRD.md`](./PRD.md) so work can resume safely across development sessions.

## Current delivery state

- **Active phase:** Phase 2, shared provider adapters and durable jobs.
- **Status:** Image adapters merged in PR #30 and the Veo adapter merged in PR #31. The durable Veo backend, subscription history, and scoped creator cutover are implemented and locally tested; independent creator review, secure raw uploads, and deployment validation remain incomplete.
- **Verified base:** `4b44b04`, the merged and deployed PR #30.
- **Merged milestones:** Phase 0 via #10, Phase 1 foundation/catalog via #11/#12, credentials via #13, durable core/execution via #14/#16, storage ledger/backfill/verification/operations through #26, OpenAI adapter via #28, and OpenAI durable text-to-image wiring via #29.
- The former active backfill status, pending PR, and `f7f21af` base were stale. Backfill merged in #24 as `49e2ddd`, verification in #25 as `34e6a69`, and operations in #26 as `c3af7d8`.
- Development deployment and authenticated live checks are complete for all six image model/mode combinations. No production deployment or merge occurred.

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

Phase 2 resumable historical storage-reference ledger backfill:

- Added one internal versioned checkpoint per logical source with `running|completed|blocked` status, immutable inclusive `cutoffDocumentId` plus `cutoffCreationTime`, audit-only `lastDocumentId`, checkpoint-owned cursor, cumulative page/document/occurrence counters, and blocked-document diagnostics.
- Each run processes at most 16 source rows in one Convex transaction; callers provide neither cursor nor cutoff.
- The initial cutoff is the source table's latest committed document ID and immutable creation time; later inserts remain outside the historical run, while normal deletion of processed/cutoff documents does not strand cursor resumption.
- Checkpoints are cross-validated through bounded key and source/version indexes; immutable version/source/table shape must agree before a page runs.
- Every page preflights all documents before any historical ledger write, so an oversized, partial, conflicting, corrupt, or owner-mismatched row blocks the source without partial page inserts or cursor advancement.
- Exact transactional or historical ledger snapshots replay without writes; missing snapshots are inserted with `historical_backfill_v1`; partial/conflicting snapshots fail closed.
- Duplicate array occurrences and positions are preserved exactly across all five sources and 11 field pairs.
- Completed and blocked checkpoints replay as read-only no-ops; no reset/restart API exists in this slice.
- Backfill status and page results always report `authoritative: false` and `physicalDeletionEnabled: false`; no storage deletion or orphan classification exists.
- Four real Convex scenarios plus three source-boundary tests cover five-source mapping, exact duplicate positions, stable two-page resumption, post-cutoff exclusion, exact live-row replay, whole-page conflict atomicity, terminal no-op replay, duplicate-checkpoint rejection, retained blobs, internal-only exposure, and bounds.
- Full verification passed **164/164 tests**: 39 core, 9 providers, and 116 web; typecheck passed 4/4, lint passed with 0 errors and 30 existing warnings, the placeholder production build produced 22 routes, and `git diff --check` passed.
- Independent Codex review returned clean, and the specialist checkpoint audit was dispositioned before commit.
- Verification/promotion, checkpoint reset, deployment, production execution, provider calls, orphan classification, and physical storage cleanup remain out of scope.

Phase 2 transactional storage-reference ledger foundation:

- Added one canonical five-source/11-field contract shared by reconciliation and the ledger schema.
- Added indexed `storageReferenceLedger` and singleton readiness state tables; readiness is observable only through an internal query and always reports `authoritative: false` in this slice.
- Each raw occurrence has a deterministic `(source, document, field, position)` identity, preserving duplicate array entries and exact order.
- New writes enforce source-specific raw bounds before mutation: generation references ≤4, video references ≤3, and total source maxima of 6/2/1/2/5.
- New-document insertion records complete field snapshots; scalar patches use field-scoped replacement so historical unrelated fields are never opportunistically backfilled.
- Image generation start/completion/durable mirror/legacy save, gallery save, character create/update, durable output persistence, and video save all dual-write only their actual reference changes.
- Legacy generation, gallery image/folder, character, and video row deletion transactionally remove their ledger rows while retaining physical blobs.
- Real Convex tests prove four public creator surfaces, durable output persistence with and without thumbnails, duplicate-array positions, character replacement, all deletion cleanup, three-video-reference acceptance/four rejection, five-generation-reference rollback, field-only historical patches, and corruption rollback.
- Mechanical source tests enforce all production insert/field-replace/removal hooks, canonical source/field counts, occurrence indexes, source bounds, collecting-only state, and the absence of any authority/deletion-enabling API.
- All 109 web tests and typecheck passed; iterative independent reviews returned clean after contract repairs.
- Historical backfill, readiness verification, deletion authority, provider calls, deployment, production mutation, and physical storage cleanup remain out of scope.

Phase 2 shared storage retention safety:

- Removed all 11 `ctx.storage.delete` calls from Convex user-facing deletion paths until a complete cross-table reference ledger and backfill can prove exclusive ownership.
- Legacy image generation, video generation, gallery image, gallery folder cascade, and character deletion remove owned application rows while retaining image, thumbnail, video, reference, and avatar blobs.
- Folder cascades use `.take(5)` and fail closed above the documented four-image contract, preventing unbounded or partial deletion mutations.
- A mechanical source test scans every Convex TypeScript file and fails if physical storage deletion is reintroduced.
- Three real Convex scenarios prove one shared blob survives sequential deletion across generation/gallery/video/character surfaces, folder cascades retain all blobs, and malformed five-image folders preserve every row and blob.
- Updated the legacy generation regression to require retained storage metadata after row deletion.
- All 97 web tests and typecheck passed; independent Codex review returned clean.
- No provider request, deployment, production mutation, or physical storage cleanup occurred.

Phase 2 durable tombstone invariant repair:

- Tombstone replay validates bounded output/completion bindings and exact markers before fresh terminal-state policy; later malformed job state cannot rewrite or invalidate an otherwise exact replay.
- Output loading is capped with `.take(17)` and rejects more than 16 rows; every output validates owner, job ID/key, generation key, provider request, completion identity, and provider linkage.
- Fresh tombstones require coherent `terminalAt`, non-ambiguous submission, and no unresolved cancellation.
- Cancelled jobs require an `accepted` or `local` outcome with request ≤ observation and observation equal to terminal transition time.
- Completed jobs accept 1–16 unique finalized outputs and validate every finalized image/thumbnail binding, including recovery finalization with multiple outputs.
- Tombstoned generating/failure/completion mirrors return before authority/output-shape checks, keeping late scheduler delivery a quiet no-op.
- Nine real Convex scenarios cover all terminal states, retained outputs, multi-finalized recovery, replay-after-job-corruption, marker corruption, malformed completion/image/finalized bindings, 17-output overflow, contradictory cancellation, no resurrection, and reconciliation visibility.
- Focused tests/typecheck passed; iterative independent Codex review found and repaired multi-output, all-output completion, and cancellation-outcome gaps, then returned clean.
- No provider request, deployment, production mutation, row deletion, or durable storage cleanup occurred.

Phase 2 durable generation soft tombstones:

- Durable-linked generations may now be user-deleted only after the authoritative job reaches `completed`, `failed`, `cancelled`, or `expired`; queued, submitting, ambiguous, processing, and persisting jobs remain fail-closed.
- A single owner-authenticated Convex mutation atomically inserts an immutable `tombstoned` durable event and applies deterministic tombstone metadata to the legacy generation and every bound durable output.
- Durable jobs, attempts, events, completions, output identities, storage IDs, checksums, and blobs remain physically intact; the durable branch performs no storage or row deletion.
- Completed jobs validate that every finalized output ID belongs to the full bound output set, while safely tombstoning persisted-but-unfinalized outputs too.
- Exact replay returns the original tombstone timestamp and rejects inconsistent partial state; deleted idempotency identities cannot reschedule or resurrect work.
- User history, usage statistics, daily charts, trends, and backfill use the tombstone-aware `[userId, tombstonedAt, createdAt]` index, preventing hidden recent rows from starving visible pages.
- Post-tombstone legacy status/completion/failure mutations reject or no-op so terminal replay cannot rewrite hidden generation state.
- Six real Convex integration scenarios cover completed output/audit/blob preservation, persisted-but-unfinalized outputs, exact replay, active/ambiguous blocking, terminal failure without outputs, owner isolation, inconsistent bindings, history pagination, analytics, and unchanged legacy physical deletion.
- Focused web tests and typecheck passed; independent Codex review found and repaired finalized-subset handling, then rereviewed cleanly.
- No provider request, deployment, production mutation, physical durable deletion, storage cleanup, or migration occurred.

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

1. Independently review the uncommitted durable Veo creator diff and its local validation evidence.
2. Keep the retained ambiguous development samples for diagnosis; future adapter failures now emit safe normalized server metadata.
3. Complete secure owned raw uploads and separately scope legacy-route retirement and video tombstone controls after reviewing the creator slice. Deployment codegen and authenticated verification remain outstanding. Then continue other canonical providers and broader durable API integration.
4. Keep playgrounds, dashboards, SDKs, mobile, production deployment, and merging outside this task.

## Independent storage-reference ledger verification milestone

- Added an internal-only, resumable `source_ledger_verification_v1` coordinator over all five physical sources and all 11 declared storage-reference fields.
- Initialization requires exactly one completed `historical_backfill_v1` checkpoint per source and atomically captures immutable inclusive source cutoffs; five ledger cutoffs are captured only after every source-direction checkpoint completes.
- Added ten independently resumable scan checkpoints, bounded resumable finalization progress, immutable scope bindings, append-only canonical evidence pages and failures, append-only chained finalization batch commitments (at most 16 evidence pages each), and one immutable `observed_pairs_passed` attestation. Every returned/persisted authority and physical-deletion flag remains literal `false`.
- Verification compares exact occurrence identities and values, preserving duplicate array entries and positions, validates bounded cardinality/fields/origins/timestamps/keys/contiguity, and detects ledger-only or wrong-table source identities.
- Added a bounded ledger source-creation sweep index and enforced a maximum page size of 16 with whole-page preflight before evidence/checkpoint writes.
- Evidence uses deterministic ordered-array serialization and a pinned pure-TypeScript SHA-256 chain; finalization replays at most 16 evidence pages per mutation across all ten chains and refuses incomplete or tampered manifests.
- Application-level append-only enforcement for evidence pages and finalization commitments is the trust boundary for this non-authoritative evidence model. Direct, out-of-band database mutation is outside the model and is not claimed to be detected or prevented.
- Source and ledger directions are intentionally separate bounded observations, not a global point-in-time snapshot: they compare the exact pairs observed in each page, are explicitly non-authoritative, and may become stale immediately.
- The slice does not write source rows, ledger rows, backfill checkpoints, readiness state, or storage; it exposes no public functions, scheduling/provider calls, promotion/reset/orphan/deletion APIs, or storage deletion capability.
- Added convex-test coverage for multipage bidirectional completion, ten scopes/checkpoints, immutable observed-pair attestation, ledger-only detection, append-only failure recording, exact offending-row identity, equal-time cutoff ties, bounded multi-call finalization, commitment corruption, completed replay reconstruction, SHA-256 vectors, and failure atomicity, plus static source-boundary coverage for internal exposure, bounded scans, all sources/fields, immutability, SHA-256, and forbidden capabilities.
- Full verification passed **183/183 tests**: 39 core, 9 providers, and 135 web; typecheck passed 4/4 and `git diff --check` passed. Iterative specialist and context-aware adversarial reviews were dispositioned before commit.

## Durable OpenAI text-to-image adapter wiring

- At PR #29, the durable worker routed only OpenAI `gpt-image-2` text-to-image work through the shared provider adapter. Gemini and editing moved to adapters in the September 6 slice above; legacy execution, gateway, and public routes remain unchanged.
- Canonical aspect ratio and resolution map to exact OpenAI `size` and `quality` values. The adapter validates those normalized fields, preserves the prior 240-second durable-worker timeout, and retains the 25 MB decoded output cap.
- Adapter preflight runs before credential resolution. Plaintext stays inside a local callback, `in_flight` is persisted immediately before the injected transport, and transport entry controls definitive-versus-ambiguous failure handling.
- Recovered in-flight, ambiguous, accepted, persisting, and completed work continues through the existing zero-resubmission recovery matrix.
- Focused provider, helper, source-boundary, and real `convex-test` action scenarios cover exact request bodies, injected-fetch confinement, credential/preflight ordering, definitive rejection, ambiguous outcomes, zero-dispatch redelivery, actual Jimp thumbnailing, Convex storage, checksums, completion/output ledgers, finalization, and legacy mirror recovery. No real provider request or deployment was performed.
- Full verification passed **266/266 tests**: 40 core, 48 providers, and 178 web; typecheck passed all five Turbo tasks, lint passed with 0 errors and 31 existing warnings, the placeholder production build produced 22 routes, and `git diff --check` passed. Provider/core builds are prerequisites for build, codegen, dev, Convex dev, test, and typecheck. Convex codegen reached the CLI after a clean providers build and stopped only because no `CONVEX_DEPLOYMENT` was configured.

## Phase roadmap

- [x] Phase 0 monorepo migration merged via PR #10 (`088a53f`)
- [x] Phase 1 foundation implementation: shared contracts, lifecycle, registry vocabulary, and adapter boundary, merged via PR #11
- [x] Phase 1 foundation independent review
- [x] Phase 1 foundation PR opened as #11
- [x] Phase 1 source-backed catalog and creator-ID integration merged via PR #12
- [x] Phase 1 model catalog independent review
- [x] Phase 1 model catalog merged via PR #12 (`9eb1f62`)
- [x] Phase 2 credential-boundary implementation and independent review
- [x] Phase 2 credential-boundary PR merged via PR #13 (`f00a9f8`)
- [x] Phase 2 durable lifecycle core merged via PR #14
- [x] Phase 2 existing studio image transport durable execution cutover merged via PR #16
- [x] Phase 2 storage ledger/backfill/verification/operations merged through PR #26
- [x] Phase 2 OpenAI text adapter and durable wiring merged via PR #28/#29
- [x] Phase 2 Gemini generation/editing and OpenAI editing adapter migration implemented and locally verified on `codex/phase2-image-adapters`
- [ ] Development Convex codegen and authenticated live-provider verification for this migration
- [ ] Phase 2 provider adapters and durable jobs
- [ ] Phase 3: Catalog, detail pages, and playground
- [ ] Phase 4: Creator and Developer dashboards
- [ ] Phase 5: Public API and SDKs
- [ ] Phase 6: Docs, deployment, and hardening
- [ ] Web Platform Gate
- [ ] Mobile phase

## Independent Veo review repairs, September 8, 2026

- Repaired all three reproduced defects in the isolated Veo worktree while retaining the existing uncommitted integration. Typed transient download failures now schedule a bounded re-poll of the same accepted operation for a fresh approved locator. Redirect/policy/media/size/checksum failures remain terminal; retries share the existing age and 60-step budget and never resubmit POST.
- Acknowledgement now survives cancellation-only revision changes through at most two bounded refreshes and three acknowledgement attempts. Each refresh checks the live lease token/expiry, epoch, exact attempt, both in-flight states, and at most eight contiguous cancellation-only events. Normal mutation fencing remains strict. Both cancellation-during-POST interleavings pass, including another delivery observing unsupported cancellation.
- Added atomic evidence-only recovery for in-flight POSTs crossing maxAge before ordinary expiry. It records ambiguity on job/attempt and in the submission/event ledger, clears leases, and grants no execution or storage rights. Video history reports reconciliation required. The inherited image defect is repaired with six image regressions across all current provider/model/mode variants. Late acknowledgements remain fenced.
- Corrected independent reproductions are retained in the checked-in test source. Measured focused validation: **205/205 tests across 7 files**. Video tests increased **61 → 84**; image tests **72 → 78**. Coverage includes 503/reset/timeout recovery, fresh locator, terminal invalid downloads/checksum, cancellation revision bounds, lease loss, deadline interleavings, concurrent deadline recovery, and full scheduler exhaustion.
- All workspace gates ran sequentially with forced execution, sanitized environment, placeholder `.invalid` URLs, and dotenv loading disabled: **536/536 tests** (40 core, 162 providers, 334 web); typecheck **5/5 tasks**; lint **0 errors, 31 existing warnings**; build **3/3 tasks and 22 routes**. `git diff --check` passed. Actual gate output and exit codes are in `/tmp/eikon-veo-repair-validation.log`; precise repair details are in `/tmp/eikon-veo-repair-summary.md`.
- Residual limits: ambiguous jobs still need an explicit reconciliation service; post-deadline acknowledgement/storage authority was not added, and existing expired rows were not migrated. Unknown unclassified transport errors remain terminal. Storage interruption may still leave an orphan blob. Tests use synthetic HTTP/media and do not establish playable media metadata or authenticated Convex deployment behavior. Public video cancellation/tombstones, metadata/posters/cost reporting, and creator/legacy route cutover remain outstanding. No production query, live provider call, credential-file access, codegen/binding edit, deployment, migration/backfill, physical deletion, commit, push, or PR occurred.
