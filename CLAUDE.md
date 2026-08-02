# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eikon Studio (formerly Nano Banana Starter) is an AI image generation platform built with Next.js 16, Convex (backend), and Google Gemini 3 Pro Image API. The app allows users to generate images via text-to-image or image-editing modes, manage a personal gallery with folders, and track usage analytics.

**Live deployment:** https://eikonstudio.xyz

The public `/models` route renders the canonical, first-party-source-backed model registry. Catalog availability and Eikon execution readiness are separate fields; never expose discovered-only entries in creator selectors.

## Development Commands

```bash
# Install dependencies (uses pnpm)
pnpm install

# Run workspace development tasks through Turbo (currently the Next.js app)
pnpm dev

# In a separate terminal, sync the Convex backend
pnpm dev:convex

# Regenerate Convex bindings without starting the watcher
pnpm codegen

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Run shared package contract tests
pnpm test

# Type-check workspace packages
pnpm typecheck
```

**Note:** This project uses `pnpm` as the package manager (version 10.18.3+).

## Architecture

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Convex (real-time database + serverless functions)
- **Authentication:** Better Auth + Convex integration (Google OAuth)
- **AI:** Google Gemini stable image APIs (`gemini-3.1-flash-image`, `gemini-3-pro-image`) and OpenAI GPT Image 2 (`gpt-image-2`)
- **UI Components:** Radix UI, shadcn/ui patterns
- **State Management:** Convex React hooks with query caching (5-minute cache, 100 max idle entries)

### Key Architecture Patterns

#### 0. Shared platform contracts
- `packages/core`: canonical provider/model IDs, strict source-backed variant catalog (as of 2026-08-02), Zod schemas, model-family registry, and generation lifecycle
- `packages/providers`: provider-adapter boundary and contract fixtures; no provider network implementations yet
- Both packages build TypeScript output to `dist/` and are orchestrated from the repository root with Turbo

#### 1. Convex Backend Structure
All backend logic lives in the `apps/web/convex/` directory:
- **`schema.ts`**: Defines database tables (`generations`, `gallery`, `folders`, `apiKeys`)
- **`generations.ts`**: Mutations/queries for AI image generation history and analytics
- **`gallery.ts`**: Mutations/queries for user's personal image gallery with folder organization
- **`apiKeys.ts`**: Secure API key storage with AES-GCM encryption
- **`auth.ts`** + **`auth.config.ts`**: Better Auth integration with Convex
- **`http.ts`**: HTTP router for authentication endpoints

**Important indexes:**
- `generations`: `by_user`, `by_user_created` (compound index for time-range queries)
- `gallery`: `by_user`, `by_user_filename`, `by_folder`
- `folders`: `by_user`, `by_user_name`

#### 2. Image Storage
- All images are stored in Convex storage (not filesystem or external CDN)
- Each image has TWO storage IDs: `imageStorageId` (full) and `thumbnailStorageId` (preview)
- To upload: call `generateUploadUrl()` mutation → upload to URL → save storage ID in DB
- To display: fetch URL via `ctx.storage.getUrl(storageId)` in queries

#### 3. Gallery Organization
- Users can create **folders** (max 4 images per folder)
- Images can be in a folder or at root level (uncategorized)
- **Reference syntax:**
  - Root images: `@filename`
  - Folder images: `@folder/filename`
- Filename validation: alphanumeric + hyphens + underscores only (`/^[a-zA-Z0-9_-]+$/`)

#### 4. Authentication Flow
- Client: `apps/web/lib/auth-client.ts` exports `authClient` (Better Auth React client)
- Server: `apps/web/lib/auth-server.ts` exports server-side auth instance
- Convex integration: Uses `@convex-dev/better-auth` component
- Protected routes check `authComponent.safeGetAuthUser(ctx)` in mutations/queries

#### 5. Cost Tracking
- Formula in `apps/web/lib/cost-calculator.ts` and mirrored in `apps/web/convex/generations.ts`
- Base price: $0.0025
- Multipliers: `1K` (0.8x), `2K` (1.0x), `4K` (2.0x); `text-to-image` (1.0x), `image-editing` (1.2x)
- Analytics queries use compound indexes to avoid full table scans

#### 6. Public API
- **Endpoint:** `POST /api/v1/generate`
- Accepts JSON or multipart/form-data
- Required params: `prompt`, `imageSize` (`1K`/`2K`/`4K`)
- Optional: `aspectRatio`, `mode`, `apiKey`, `images` (for image-editing)
- Returns base64-encoded image data
- CORS-enabled for all origins

### Directory Structure
```text
apps/web/
├── app/                # Next.js App Router pages
├── studio/            # Authenticated app pages (create, gallery, history, dashboard, settings)
├── auth/              # Authentication page
├── api/               # API routes (v1/generate)
├── api-docs/          # API documentation page
├── brand/             # Brand/marketing page
├── ConvexClientProvider.tsx  # Wraps app with Convex + auth providers
├── convex/            # Convex backend (mutations, queries, schema)
├── components/        # React components
├── ui/               # Base UI components (shadcn/ui style)
├── image-combiner/   # Image generation interface
├── gallery/          # Gallery management UI
├── dashboard/        # Analytics dashboard
├── lib/               # Shared utilities
├── auth-client.ts    # Client-side auth
├── auth-server.ts    # Server-side auth
├── secure-storage.ts # API key encryption utilities
├── cost-calculator.ts # Cost estimation logic
├── utils/             # Additional utilities
├── hooks/             # Custom React hooks
└── styles/            # Global styles
```

### Environment Variables
Required for development (see `apps/web/.env.local`):
- `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`: Google Gemini API key
- Better Auth secrets (auto-configured by Convex component)

Required on the Convex deployment for saved provider credentials:
- `CREDENTIAL_ENCRYPTION_SECRET`: exactly 32 random bytes encoded as canonical base64; no fallback exists
- `LEGACY_CREDENTIAL_ENCRYPTION_SECRET`: temporary explicit old `ENCRYPTION_SECRET` value only while reading pre-v2 records

Saved provider credentials are metadata-only in public APIs. Never add plaintext-key queries, browser persistence, generation/scheduler key arguments, or a default encryption secret. Resolve an owner/provider/handle binding only inside the server operation that calls the provider.

### Important Notes
- **Production builds run TypeScript checking:** `next.config.mjs` does not bypass build errors
- **Image domains allowed:** `*.convex.cloud`, `*.googleusercontent.com`
- **Query caching:** Convex queries cached for 5 minutes (see `ConvexClientProvider.tsx`)
- **Executable image models:** `gemini-3.1-flash-image`, `gemini-3-pro-image`, and `gpt-image-2`; derive selectors from `@eikonstudio/core` and keep discovered-only catalog entries non-executable
- **Aspect ratios:** Maps friendly names (`square`, `portrait`, `landscape`, `wide`) to ratios (`1:1`, `9:16`, `16:9`, `21:9`)

## Common Development Tasks

### Adding a New Convex Query/Mutation
1. Define in the appropriate file in `apps/web/convex/` (e.g., `generations.ts`)
2. Use `query()` or `mutation()` from `./_generated/server`
3. Validate user auth with `authComponent.safeGetAuthUser(ctx)`
4. Use indexes for queries to avoid full table scans
5. Import and use in React components via `useQuery()` or `useMutation()` from `convex/react`

### Working with Images
- Always upload both full image and thumbnail
- Use `generateUploadUrl()` → upload → save storage IDs pattern
- Queries should fetch URLs via `ctx.storage.getUrl()`
- Delete storage files when deleting database records

### Modifying Schema
1. Edit `apps/web/convex/schema.ts`
2. Convex auto-detects schema changes
3. Add indexes for any new query patterns
4. Migration: Use mutations to backfill data if needed (see `backfillCosts` in `generations.ts`)

### Testing the Public API
```bash
curl -X POST https://eikonstudio.xyz/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A sunset over mountains", "imageSize": "2K"}'
```
