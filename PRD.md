# Eikon Studio V1 Product Requirements Document

**Status:** Draft for implementation

**Last updated:** August 1, 2026

**Product:** Eikon Studio

**License target:** Apache-2.0
**Primary deployment:** Vercel or generic Node/Docker hosting with hosted Convex

## 1. Executive summary

Eikon Studio V1 will turn the existing image and video creation application into
an open-source, self-hostable generative-media platform inspired by the useful
product patterns of fal: a public model catalog, per-model playgrounds, model
comparison, a creator experience, a developer dashboard, a unified API, SDKs,
usage analytics, and reliable asynchronous generation.

V1 is a bring-your-own-key (BYOK) product. Eikon does not resell inference,
manage credits, or add a markup. Each signed-in user connects first-party API
credentials for supported vendors, and Eikon routes that user's requests to one
canonical provider for each model family.

The current landing page and dashboard establish the visual direction. V1 must
extend them rather than replace them with a fal visual clone. Eikon will retain
its own name, identity, source code, copy, and assets.

V1 is delivered through two sequential gates:

1. **Web Platform Gate:** web app, dashboard, API, SDKs, docs, and supported
   deployment paths are complete and releasable.
2. **Mobile Gate:** React Native development begins only after the Web Platform
   Gate passes. Mobile must reuse the stable public API and shared packages
   rather than influence or delay the web architecture.

## 2. Product principles

1. **BYOK by default.** Users control their provider accounts, credentials, and
   provider-side spending.
2. **One Eikon contract.** Provider differences are normalized into a stable
   catalog and job API without hiding provider-native capabilities.
3. **Creator-friendly and developer-complete.** Common workflows are visual;
   advanced fields, raw JSON, API access, logs, and schemas remain available.
4. **Durable media.** Inputs needed for reproducibility and all successful
   outputs are copied to Eikon-controlled Convex storage.
5. **Serverless-compatible.** No persistent worker process is required. Durable
   state and background work live in Convex.
6. **Open-source operability.** A new operator can deploy the product using
   documented environment variables and supported hosting guides.
7. **Original product identity.** Functional inspiration does not authorize
   copying fal trademarks, proprietary text, protected media, or trade dress.

## 3. Goals

### 3.1 User goals

- Discover and compare current image and video models across first-party
  providers.
- Connect personal provider credentials once and use them securely across the
  Eikon web app and API.
- Generate, edit, monitor, revisit, download, and rerun images and videos.
- Understand provider usage and approximate cost in one place.
- Integrate all supported models through one Eikon API and either the TypeScript
  or Python SDK.
- Deploy a personal Eikon instance to Vercel or a generic Node/Docker host.

### 3.2 Product goals

- Support all active, discoverable variants within the ten selected model
  families.
- Provide a stable provider-adapter boundary so model and vendor changes do not
  leak throughout the UI or public API.
- Preserve the existing Eikon landing page and dashboard design while expanding
  navigation and capabilities.
- Make web deployment and local development reproducible and documented.
- Establish the public API that the final React Native phase will consume.

## 4. Non-goals for V1

- Managed credits, payments, subscriptions, invoices, or inference markup.
- Organizations, teams, invitations, shared keys, or role-based access control.
- Custom model deployment, autoscaled GPU hosting, or dedicated compute.
- Training, fine-tuning, or hosted LoRA workflows.
- Visual node-based workflow composition.
- Audio, speech, 3D, general text, or embedding model catalogs.
- Automatic routing, price optimization, or provider failover.
- Compatibility guarantees for fal's REST API or SDKs.
- A fully independent data plane without hosted Convex.
- Exact visual or brand replication of fal.

## 5. Target users

### 5.1 Creator

A user who wants to explore models visually, generate media, compare results,
reuse prompts, and manage a durable gallery without learning every vendor API.

Primary surfaces:

- Model catalog and favorites
- Playground and sandbox
- Generation history and gallery
- Creator usage summary

### 5.2 Developer

A user who wants a consistent API across model providers, transparent schemas,
copyable examples, asynchronous jobs, webhooks, logs, and usage information.

Primary surfaces:

- Developer dashboard
- API keys and provider settings
- Model schemas and raw JSON input
- Request logs, errors, code examples, and SDK documentation

Users can switch between Creator and Developer views. The views organize the
same underlying account, model registry, jobs, media, and usage records.

## 6. Confirmed V1 model and provider scope

Each family has one canonical first-party provider. V1 does not route the same
family through alternate aggregators.

| Canonical provider | Credential | Model families | Required media capabilities |
| --- | --- | --- | --- |
| OpenAI | OpenAI API key | GPT Image, Sora | Image generation/editing; video generation and supported references/remixes |
| Google | Gemini API key | Nano Banana, Veo, Gemini Omni | Image generation/editing; video generation/editing and supported references |
| Black Forest Labs | BFL API key | FLUX | Image generation, editing, and provider-supported tools |
| BytePlus ModelArk | ARK API key | Seedream, Seedance | Image generation/editing; text/image/reference-to-video and supported video operations |
| Kling AI | Kling developer credentials | Kling | Provider-supported text/image/reference-to-video operations |
| xAI | xAI API key | Grok Imagine | Provider-supported image/video generation, editing, extension, and references |

### 6.1 Variant policy

- Eikon must show every active variant that can be discovered for the selected
  families, including fast, standard, pro, preview, dated, and task-specific
  endpoints.
- Discovery does not mean immediate execution. A newly found variant enters a
  `discovered` state until Eikon has enough schema and capability information to
  render or accept valid input.
- Catalog records use these readiness states:
  `discovered`, `ready`, `degraded`, `deprecated`, and `disabled`.
- Preview variants must be labeled and may change without Eikon version changes.
- Deprecated variants remain visible in historical jobs but are hidden from new
  generation by default.

### 6.2 Registry sources

The model registry combines:

1. Live provider model discovery where an official listing API exists.
2. Cached discovery snapshots for availability and resilience.
3. Eikon-maintained capability and parameter metadata.
4. Manual overrides for names, descriptions, categories, schema gaps,
   thumbnails, pricing, and deprecation.

A scheduled catalog sync runs at least daily. Operators can trigger a manual
sync and inspect additions, changes, failures, and deprecations.

## 7. Information architecture

### 7.1 Public web

Public without authentication:

- Existing Eikon landing page
- Model catalog
- Model detail pages
- Capability and estimated-price comparisons
- API and self-hosting documentation
- Authentication entry point

Authentication is required to generate, save media, connect provider keys,
view history, use the sandbox, inspect personal usage, or administer platform
API keys.

### 7.2 Authenticated web

- Creator home
- Developer home
- Catalog
- Model playground
- Sandbox
- Create image
- Create video
- Generation history
- Gallery
- Usage and cost analytics
- Provider settings
- Eikon platform API keys
- Account settings

Existing routes and visual patterns should be preserved where practical.
Redirects must cover any routes moved during the monorepo migration.

## 8. Functional requirements

### 8.1 Authentication and account isolation

- V1 supports Google OAuth only, matching the current application.
- Every protected query, mutation, action, API request, storage object, and job
  must be authorized against the owning user.
- V1 has personal accounts only. No resource can be shared through organization
  membership.
- Public media sharing is not implicit. Any future share link must use an
  explicit, revocable share record rather than exposing storage identifiers.

### 8.2 Provider credential management

Users can add, validate, replace, and delete one canonical credential set per
provider.

Requirements:

- Credentials are entered over TLS and sent directly to a server-side action.
- Credentials are encrypted at rest using an operator-supplied encryption
  secret and are never returned to the client after saving.
- The UI displays provider, validation state, last four characters where safe,
  created date, updated date, and last successful use.
- Validation makes a low-cost official API call where possible.
- Validation distinguishes invalid credentials, missing billing/model access,
  regional restrictions, provider downtime, and insufficient permissions.
- Deleting a credential prevents future jobs but does not delete history.
- Logs, analytics, exceptions, and webhook payloads must redact secrets.
- The self-hosting guide explains that the deployment operator controls the
  encryption secret and infrastructure; Eikon does not claim end-to-end
  encryption from the operator.

### 8.3 Model catalog

Catalog cards and search results include:

- Eikon model ID and provider-native model ID
- Display name and family
- Provider
- Media type and task category
- Supported input and output modalities
- Readiness and preview/deprecation status
- Supported aspect ratios, resolutions, durations, and reference types when
  known
- Pricing summary and cost-source label
- Thumbnail/example media owned or licensed for use by Eikon
- Favorite state for signed-in users

Filters include provider, image/video, task, family, readiness, preview status,
and capabilities such as editing, audio generation, references, or extension.

Search covers names, IDs, providers, families, descriptions, and tags.

### 8.4 Model detail page

Each ready model or variant includes:

- Description and capability summary
- Input and output schema
- Limits and known constraints
- Pricing and its source/update time
- Playground
- JavaScript, Python, and cURL examples based on the current form state
- Related variants in the same family
- Recent personal generations when signed in
- Provider attribution and links to official terms/documentation

### 8.5 Playground

The playground uses a hybrid input experience:

1. **Common controls:** prompt, negative prompt where supported, input media,
   output count, aspect ratio, resolution/size, duration, seed, and audio toggle.
2. **Advanced controls:** provider/model-specific typed fields derived from the
   Eikon schema registry.
3. **Raw JSON:** complete provider-neutral request with validated
   provider-specific extensions.

Requirements:

- Unsupported controls are hidden or disabled with an explanation.
- Switching variants preserves compatible values and identifies discarded
  fields before submission.
- File inputs upload directly to Convex storage using upload URLs rather than
  passing large media through Vercel functions.
- Client and server validation use shared schemas.
- The UI shows an estimated cost before submission when calculable.
- Submission immediately creates a durable generation job.
- Progress survives refresh and navigation.
- A completed result can be downloaded, favorited, copied to a gallery folder,
  rerun, or opened with its full request details.

### 8.6 Sandbox comparison

- A user can select at least two and up to four ready model variants.
- A shared normalized prompt and common compatible inputs are entered once.
- Model-specific overrides remain available for each comparison column.
- Eikon shows the combined estimated cost before submission.
- Each generation remains an independent job with independent errors and
  cancellation.
- Results show side by side with model, provider, duration, dimensions,
  generation time, and estimated/reported cost.
- A comparison can be rerun and linked through an authenticated, stable URL.

### 8.7 Asynchronous generation lifecycle

All image and video requests use the same durable lifecycle:

`queued -> submitting -> processing -> persisting -> completed`

Terminal alternatives:

`failed`, `cancelled`, or `expired`.

Required job behavior:

- Job creation and initial scheduling are atomic.
- Every provider submission uses an idempotency strategy where supported.
- Provider request IDs are stored for polling, cancellation, reconciliation,
  and support.
- Provider webhooks are preferred where available.
- Scheduled Convex polling is used otherwise, with bounded exponential backoff,
  jitter, maximum age, and explicit retry classification.
- Duplicate webhook delivery or polling completion must not create duplicate
  assets or charges.
- A reconciliation task finds jobs stuck beyond expected provider limits.
- Cancellation stops queued Eikon work and calls provider cancellation when
  supported. The UI states when upstream work cannot be stopped.
- Provider errors are normalized into authentication, billing/access,
  validation, rate limit, moderation, provider unavailable, timeout, cancelled,
  and unknown categories. The original redacted payload is retained for
  developer debugging.

### 8.8 Media persistence

- Inputs required to inspect or rerun a generation are copied to Convex storage.
- Every successful output is downloaded from the provider and copied to Convex
  storage before the job becomes `completed`.
- Provider URLs are transport URLs and must not be treated as durable.
- Image outputs receive optimized thumbnails.
- Video outputs receive a poster thumbnail and stored metadata where feasible.
- Stored metadata includes content type, byte size, dimensions, duration,
  checksum, and provider source.
- Deleting a generation or gallery asset must remove unreferenced storage
  objects safely.
- V1 does not automatically expire completed outputs. Users can delete their
  own assets and history.
- Download endpoints set safe content types and filenames.

### 8.9 History and gallery

History supports:

- Image and video jobs in one searchable timeline
- Filters by date, media type, provider, family, model, status, and source
  (web/API/sandbox/mobile)
- Full request, provider extensions, timestamps, normalized error, cost, and
  output inspection
- Rerun with the original versioned model ID and parameters when still active
- Duplicate into a current replacement variant when the original is deprecated
- Delete and bulk delete

Gallery supports:

- Images and videos
- Existing folder behavior, expanded to support video
- Rename, move, favorite, download, and delete
- Grid/list views and full-screen media preview
- References from gallery assets in supported playground inputs

### 8.10 Usage and cost analytics

The dashboard reports request counts, success/error rates, media generated,
latency, and cost grouped by date, provider, family, model, source, and status.

Cost source hierarchy:

1. **Reported:** exact per-request cost returned by the provider.
2. **Synced:** cost obtained from an official provider usage or billing API.
3. **Estimated:** calculated from a versioned Eikon pricing rule.

Requirements:

- Each job stores its monetary amount, currency, source, pricing-rule version,
  provider usage quantities, and calculation inputs.
- Historical job costs do not silently change when current prices change.
- Dashboard totals visibly distinguish reported, synced, and estimated amounts.
- Provider cost/usage sync is optional and only attempted when the stored
  credential has adequate permission.
- Failure to retrieve billing data must never block generation.
- The UI states that Eikon analytics are informational and provider invoices
  remain authoritative.

### 8.11 Eikon platform API keys

- Signed-in users can create multiple named Eikon API keys.
- Plaintext is displayed exactly once.
- Only a secure hash, prefix, metadata, scopes, and last-used timestamp are
  persisted.
- Keys can be revoked, rotated, and optionally expired.
- Initial scopes include `models:read`, `generations:read`,
  `generations:write`, `files:write`, and `usage:read`.
- V1 supports configurable requests per minute and maximum concurrent jobs per
  key.
- Development deployments have no limits by default; production documentation
  provides safe defaults.
- Users can configure daily estimated-spend warnings and an optional Eikon-side
  hard generation limit. This is a local safeguard, not a provider billing cap.

### 8.12 Public API

The canonical API is provider-neutral and is not fal-compatible.

Minimum endpoints:

```text
GET    /api/v1/models
GET    /api/v1/models/{modelId}
POST   /api/v1/files
POST   /api/v1/generations
GET    /api/v1/generations
GET    /api/v1/generations/{generationId}
POST   /api/v1/generations/{generationId}/cancel
DELETE /api/v1/generations/{generationId}
GET    /api/v1/usage
```

Generation creation returns immediately with an Eikon generation ID. Clients
can poll, receive a signed webhook, or use an SDK wait helper.

The request contract includes:

- Stable Eikon model ID
- Normalized common input
- Optional validated `providerOptions`
- Optional webhook URL and client reference ID
- Optional idempotency key

The response includes:

- Eikon job ID and status
- Model/provider identity and native request ID when safe
- Timestamps and progress where available
- Durable Eikon output URLs after persistence
- Usage, cost, and source
- Normalized error plus safe provider context

API requirements:

- OpenAPI 3.1 specification generated or checked from the canonical contract
- Cursor pagination
- Stable error envelope
- Request IDs on every response
- CORS configurable by the deployment operator
- Webhook signatures using HMAC, timestamp replay protection, retry with
  backoff, and delivery logs
- Idempotent generation creation when an idempotency key is supplied

### 8.13 SDKs

V1 ships and documents:

- `@eikonstudio/sdk` for JavaScript/TypeScript
- `eikonstudio` for Python

Both SDKs support:

- Client configuration and authentication
- Catalog listing/search and schema retrieval
- File upload
- Generation submit, get, list, cancel, and delete
- `generateAndWait()` convenience behavior
- Typed/pydantic request and response models
- Configurable polling, timeouts, and retries
- Webhook verification helpers
- Usage retrieval
- Consistent exceptions mapped from the API error envelope

The TypeScript SDK is generated from or validated against the same source of
truth as the API. The Python SDK must pass contract fixtures shared with the
TypeScript implementation.

### 8.14 Documentation

The separate docs app includes:

- Quickstart for creators
- Quickstart for API users
- Provider credential setup for all six providers
- JavaScript, Python, and cURL API guides
- API reference
- Webhooks and signature verification
- Model catalog and provider-native options
- Vercel deployment guide
- Node/Docker deployment guide
- Convex and Google OAuth setup
- Environment-variable reference
- Encryption-key rotation and backup guidance
- Troubleshooting and provider error guide
- Security and data-retention explanation
- Contribution guide and provider-adapter authoring guide

Code samples must run in CI or be generated from tested fixtures where
practical.

### 8.15 Creator and Developer dashboards

Creator view prioritizes:

- Recent generations
- Favorite and recently used models
- Playground entry points
- Gallery
- Lightweight usage summary

Developer view prioritizes:

- API activity and error rate
- Latency and job-status charts
- Platform and provider credential health
- Recent API requests
- Usage and cost breakdown
- API documentation and SDK quickstarts

Both views retain the existing Eikon dashboard's visual language. A view switch
changes organization and emphasis, not the account or stored data.

## 9. Turborepo architecture

The repository will migrate to a pnpm Turborepo without intentionally changing
the current landing-page or dashboard appearance.

```text
apps/
  web/          Existing Next.js landing page, studio, dashboard, and API
  docs/         Public documentation app
  mobile/       Expo/React Native app; created only after the Web Platform Gate

packages/
  core/         IDs, job lifecycle, shared types, validation, and model registry
  providers/    First-party provider adapters and contract fixtures
  sdk/          JavaScript/TypeScript SDK
  python-sdk/   Python SDK and generated/validated models
  ui/           Web components shared by web and docs
  config/       Shared TypeScript, ESLint, Tailwind, and build configuration
```

Provider code may be split into separate packages later if dependency isolation
or release ownership requires it. V1 can begin with subpath exports from
`packages/providers`.

### 9.1 Provider adapter contract

Every adapter implements the capabilities applicable to its provider:

```text
validateCredentials
discoverModels
getModelSchema
normalizeInput
estimateCost
submitGeneration
getGenerationStatus
cancelGeneration
normalizeOutput
normalizeError
verifyWebhook
```

Provider-native data must remain available in a namespaced, redacted envelope
for debugging without becoming the canonical public contract.

### 9.2 Web and backend responsibilities

**Next.js/Vercel or Node host**

- Public pages and authenticated UI
- Short-lived public API request handling
- Upload initiation
- Documentation links and SDK examples

**Convex**

- Auth integration and user ownership
- Model registry and catalog sync state
- Encrypted provider credentials
- Durable generation jobs and scheduled work
- Provider webhooks through HTTP actions
- Input/output storage and media metadata
- History, gallery, usage, and realtime subscriptions

No V1 workflow may require an always-running process on the web host.

## 10. Data model requirements

The existing Convex schema must be migrated without losing current generations,
gallery items, folders, characters, skills, or platform API keys.

New or expanded concepts include:

- `providerCredentials`
- `providerCredentialHealth`
- `modelFamilies`
- `modelVariants`
- `modelSchemas`
- `catalogSyncRuns`
- `generations` unified across image and video
- `generationEvents`
- `generationAssets`
- `usageRecords`
- `pricingRules`
- `webhookDeliveries`
- expanded `platformApiKeys`
- `favorites`

Implementation may preserve separate image/video legacy tables during migration,
but the application and public API must expose one unified generation model.

Important indexes include user plus creation time, user plus status, user plus
provider/model, native provider request ID, model readiness/category, API key
hash, and jobs requiring reconciliation.

## 11. Security and privacy requirements

- Provider credentials never reach browser storage or mobile storage after
  submission.
- Eikon API keys are hashed at rest; provider credentials are encrypted because
  they must be recoverable for server-side calls.
- Encryption material is supplied through deployment secrets and never committed.
- Server logs use structured redaction for authorization headers, keys, signed
  URLs, prompts when configured, and provider payloads.
- All public API and webhook operations enforce ownership and replay protection.
- Remote input URLs and webhook URLs receive SSRF protections, protocol checks,
  redirect limits, size limits, and timeouts.
- Media type is verified from content, not trusted solely from filenames.
- Upload and output sizes use provider/model-aware limits.
- Provider moderation failures are surfaced without bypass attempts.
- Users can delete their jobs and stored media.
- Documentation explains what Eikon, Convex, and each provider retain.
- Dependencies and SDK releases receive automated vulnerability scanning.

## 12. Reliability, performance, and observability

Initial V1 targets:

- Catalog and authenticated dashboard pages should render useful content within
  2 seconds at p75 under normal conditions, excluding media loading.
- Job creation should return within 2 seconds at p95, excluding direct file
  upload time.
- No acknowledged job is lost across browser refresh, web redeploy, or transient
  action failure.
- Duplicate webhooks and retries do not duplicate durable output assets.
- Eikon-caused job failure rate is below 1% in production smoke tests, excluding
  provider rejection, moderation, quota, and outage errors.

Observability includes:

- Request and generation correlation IDs
- Structured provider call logs with redaction
- Job-state transition events
- Catalog-sync results and diffs
- Webhook receipt/delivery logs
- Provider latency, error class, and success-rate dashboards
- Stuck-job and repeated-authentication-failure alerts

## 13. Accessibility and responsive behavior

- Public and authenticated web experiences target WCAG 2.1 AA.
- All generation controls are keyboard reachable and labeled.
- Progress, success, and failure are not communicated by color alone.
- Tables have responsive alternatives on narrow screens.
- Videos have accessible controls; generated media supports user-entered alt
  descriptions where applicable.
- Existing visual design may be refined to meet accessibility requirements but
  should not be broadly redesigned in V1.

## 14. Deployment and operator experience

Officially supported:

1. Vercel plus hosted Convex.
2. Generic Node/Docker hosting plus hosted Convex.

Required operator assets:

- Root environment example with comments
- Dockerfile and documented runtime requirements
- Vercel deployment guide/button configuration
- Convex development and production setup
- Google OAuth callback configuration
- Provider-credential encryption secret generation
- CORS, allowed origins, public base URL, and webhook base URL configuration
- Data backup and restore guidance
- Upgrade and schema-migration guidance
- Health endpoint exposing safe version and dependency status

The app must fail startup or show a clear operator diagnostic when required
security configuration is missing in production.

## 15. Mobile Gate

Mobile work begins only after every Web Platform Gate acceptance criterion passes.

The expected implementation is an Expo/React Native app in `apps/mobile` that
uses the public Eikon API through the shared TypeScript SDK. Provider credentials
remain server-side and are initially configured on the web.

Expected creator-focused mobile scope:

- Google OAuth
- Catalog, search, favorites, and model details
- Image/video playground using normalized controls
- Upload from camera or library
- Generation progress, cancellation, and notifications
- History and gallery
- Download and native share sheet
- Lightweight usage/cost summary

Developer-only web features such as raw JSON editing, platform-key management,
full API logs, and documentation are not assumed to require mobile parity. The
exact mobile acceptance criteria will be finalized after the Web Platform Gate,
without changing the public API contract.

## 16. Delivery plan

### Phase 0: Monorepo migration

- Introduce pnpm workspaces and Turborepo.
- Move the current application to `apps/web`.
- Extract shared configuration without visual changes.
- Preserve builds, routes, authentication, and Convex code generation.

### Phase 1: Core contracts and registry

- Create shared core types and validation.
- Define provider adapter and unified job contracts.
- Add model family/variant registry and catalog sync framework.
- Expand encrypted provider credential storage.

### Phase 2: Provider adapters and durable jobs

- Implement OpenAI, Google, BFL, BytePlus, Kling, and xAI adapters.
- Implement webhook/polling orchestration, reconciliation, cancellation, and
  normalized errors.
- Migrate image and video generation to the unified lifecycle.
- Persist all inputs and outputs to Convex storage.

### Phase 3: Catalog, detail pages, and playground

- Add public catalog and model pages.
- Build hybrid common/advanced/raw input system.
- Generate code examples from live form state.
- Add favorites and catalog health states.

### Phase 4: Creator and Developer dashboards

- Extend the current UI with the two dashboard views.
- Unify history and gallery across image/video.
- Add sandbox comparison.
- Add usage/cost analytics and provider health.

### Phase 5: Public API and SDKs

- Stabilize and version the API.
- Publish the OpenAPI specification.
- Complete TypeScript and Python SDKs.
- Add platform key scopes, rate limits, safeguards, and signed webhooks.

### Phase 6: Docs, deployment, and hardening

- Launch docs app.
- Validate Vercel and Docker/Node deployment paths.
- Complete migration, security, accessibility, performance, and recovery tests.
- Move repository licensing and notices to Apache-2.0.

### Web Platform Gate

- Release the complete web platform independently.
- Freeze the V1 API contract required by mobile.

### Final V1 phase: Mobile

- Create the Expo app after the web gate.
- Reuse the public API and SDK.
- Complete the separately finalized mobile acceptance checklist.

## 17. Web Platform Gate acceptance criteria

V1 web is complete when all of the following are true:

1. A fresh operator can deploy Eikon successfully using both official hosting
   guides.
2. A user can sign in with Google and securely connect all six canonical
   providers.
3. The catalog sync discovers and classifies active variants in all ten selected
   families.
4. At least one production smoke test succeeds for every selected family using
   its first-party provider.
5. Image generation, image editing, text-to-video, and image-to-video work for
   every family that officially supports them.
6. A job survives refresh and redeploy, completes through webhook or polling,
   and stores durable input/output assets.
7. Playground common fields, advanced fields, and raw JSON produce the same
   canonical request contract.
8. Sandbox comparison handles partial success and failure without losing other
   results.
9. Creator and Developer views expose the confirmed dashboard surfaces while
   retaining Eikon's existing design direction.
10. History, gallery, favorites, deletion, rerun, and downloads work for both
    images and videos.
11. Usage records show reported, synced, or estimated cost with a saved pricing
    snapshot.
12. The Eikon API passes authentication, ownership, rate-limit, idempotency,
    pagination, cancellation, and webhook tests.
13. TypeScript and Python SDK contract suites pass against the same deployed API.
14. Public docs include tested quickstarts for both SDKs and both deployment
    paths.
15. No provider key or Eikon platform key appears in client bundles, logs,
    analytics, API responses, or stored plaintext fields.
16. Existing user data is retained or migrated with a documented rollback path.
17. Production builds run type checking and do not rely on the current
    `ignoreBuildErrors` setting.
18. The repository includes Apache-2.0 licensing and correct third-party notices.

## 18. Test strategy

- **Unit tests:** normalization, schemas, state transitions, cost rules, error
  mapping, webhook verification, redaction, and authorization.
- **Adapter contract tests:** recorded redacted fixtures for discovery, submit,
  status, output, failure, and cancellation.
- **Provider smoke tests:** opt-in tests using dedicated low-limit provider keys.
- **Integration tests:** Convex scheduling, retries, reconciliation, storage, and
  catalog sync.
- **API conformance tests:** OpenAPI requests/responses, error envelopes,
  idempotency, rate limits, and scopes.
- **SDK contract tests:** shared fixtures for TypeScript and Python.
- **End-to-end tests:** Google sign-in test environment, provider setup,
  playground, sandbox, history, gallery, usage, and API-key flows.
- **Deployment tests:** Vercel preview and Docker container smoke tests.
- **Security tests:** secret scanning, authorization boundaries, SSRF inputs,
  webhook replay, unsafe files, and log redaction.

## 19. Success measures

Initial product measures after launch:

- Percentage of new users who validate at least one provider credential.
- Time from sign-in to first completed generation.
- Generation completion rate by provider and model, separated into Eikon-caused
  and provider-caused failures.
- Playground-to-rerun and playground-to-API conversion.
- Weekly active creators and developers.
- Catalog freshness and time to support a newly discovered variant.
- SDK quickstart success rate in CI and reported setup issues.
- Successful self-host deployments using each supported path.

No revenue metric is required for BYOK V1.

## 20. Known risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Provider APIs and model names change quickly | Broken variants and forms | Versioned registry, daily discovery, readiness states, contract fixtures, manual overrides |
| Discovery APIs omit schemas or pricing | Incomplete catalog | Provider enrichment and maintained fallback metadata |
| BYOK credentials lack billing permissions | Missing exact costs | Reported/synced/estimated hierarchy with visible labels |
| Video jobs outlive web functions | Lost or stuck work | Convex durable jobs, webhooks, scheduled polling, reconciliation |
| Provider output URLs expire | Broken history | Copy all successful outputs before completion |
| Large uploads exceed serverless limits | Failed video/reference input | Direct-to-Convex uploads and provider-aware size validation |
| Supporting every variant creates inconsistent UX | High maintenance and confusion | Common controls, advanced schema fields, raw JSON, readiness gating |
| Moving to Turborepo breaks the current app | Regression risk | Phase 0 is structural only, with route/build/UI regression checks |
| A functional fal clone is mistaken for an affiliated product | Legal and brand confusion | Eikon identity, original assets/copy, clear non-affiliation, no fal-compatible branding |
| Mobile pressures unstable web contracts | Rework and delayed dashboard | Mobile starts only after the Web Platform Gate and consumes the frozen API |

## 21. References used for product research

- [fal platform overview](https://fal.ai/docs/documentation)
- [fal playground and sandbox behavior](https://fal.ai/docs/documentation/model-apis/playground)
- [fal model discovery API](https://fal.ai/docs/platform-apis/v1/models)
- [fal image model catalog](https://fal.ai/explore/best-ai-image-generators)
- [fal text-to-video catalog](https://fal.ai/explore/text-to-video-apis)
- [Convex scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions)
- [Convex HTTP actions](https://docs.convex.dev/functions/http-actions)
- [OpenAI video API](https://platform.openai.com/docs/api-reference/videos)
- [Google generative media models](https://ai.google.dev/gemini-api/docs/models)
- [Black Forest Labs API documentation](https://docs.bfl.ai/quick_start/introduction)
- [BytePlus Seedance documentation](https://docs.byteplus.com/en/docs/modelark/1520757)
- [xAI video generation documentation](https://docs.x.ai/developers/model-capabilities/video/generation)

## 22. Remaining implementation-time decisions

These decisions do not block the product scope:

- Exact documentation framework and theme inside `apps/docs`.
- Final npm and PyPI publishing organization names.
- Exact default production rate/concurrency limits.
- Exact mobile acceptance criteria, finalized after the Web Platform Gate.
- Whether provider packages remain combined or split after dependency analysis.
