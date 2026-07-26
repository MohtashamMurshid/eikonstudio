# Eikon Studio

An open-source AI image generation platform built with Next.js and Convex, with
support for multiple image models. Generate images from text, edit existing
images, organize them in a personal gallery, and track usage analytics — all in
one place.

**Live demo:** [eikonstudio.xyz](https://eikonstudio.xyz)

---

## Features

- Text-to-image and image-editing modes
- Multiple image models: **Google Gemini 3 Pro** and **OpenAI GPT Image 2** — switch per generation
- Personal gallery with folder organization
- Usage analytics dashboard
- Google OAuth authentication (via Better Auth + Convex)
- Public REST API for programmatic image generation
- Real-time sync powered by Convex

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Convex (real-time database + serverless functions)
- **Auth:** Better Auth with the `@convex-dev/better-auth` component (Google OAuth)
- **AI:** Google Gemini (`gemini-3.1-flash-image-preview`) and OpenAI (`gpt-image-2`)
- **UI:** Radix UI + shadcn/ui patterns

---

## Getting Started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10.18.3+
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- *(Optional)* An [OpenAI API key](https://platform.openai.com/api-keys) if you want to use GPT Image 2
- A [Convex](https://convex.dev) account (free tier works)
- Google OAuth credentials from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### 1. Clone and install

```bash
git clone https://github.com/MohtashamMurshid/eikonstudio.git
cd eikonstudio
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local`. See `.env.example` for notes on each variable.

### 3. Set up Convex

In a separate terminal, run:

```bash
npx convex dev
```

This provisions a dev deployment, writes `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL`
into `.env.local`, and keeps the backend in sync with your `convex/` folder.

> **GPT Image 2 users:** `OPENAI_API_KEY` must be set on the **Convex deployment**
> (not in `.env.local`), because image generation runs server-side in Convex:
>
> ```bash
> npx convex env set OPENAI_API_KEY sk-...
> ```

### 4. Configure Google OAuth

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Create an OAuth 2.0 Client ID (Web application).
2. Add an authorized redirect URI:
  `<NEXT_PUBLIC_CONVEX_SITE_URL>/api/auth/callback/google`
3. Copy the client ID / secret into `.env.local`.

### 5. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts


| Command      | Description              |
| ------------ | ------------------------ |
| `pnpm dev`   | Start Next.js dev server |
| `pnpm build` | Production build         |
| `pnpm start` | Run the production build |
| `pnpm lint`  | Lint with ESLint         |


---

## Project Structure

```
app/          Next.js App Router pages
  studio/     Authenticated app (create, gallery, history, dashboard, settings)
  api/        API routes (including public v1/generate)
convex/       Convex schema, queries, mutations, and auth wiring
components/   React components (UI, gallery, image combiner, dashboard)
lib/          Shared utilities (auth, cost calculation, secure storage)
hooks/        Custom React hooks
public/       Static assets
```

---

## Public API

Eikon Studio exposes a public REST endpoint for programmatic image generation.
Each request must include a **platform API key** generated from your Eikon
Studio account (Studio → Settings → API Keys).

### Endpoint

`POST /api/v1/generate`

### Authentication

Send your platform API key as a Bearer token or in the `x-api-key` header:

```
Authorization: Bearer eik_your_platform_key
# or
x-api-key: eik_your_platform_key
```

### Body parameters


| Field         | Type   | Required | Default          | Description                                       |
| ------------- | ------ | -------- | ---------------- | ------------------------------------------------- |
| `prompt`      | string | yes      | —                | Description of the image to generate              |
| `provider`    | string | yes      | —                | `"gemini"` or `"openai"`                          |
| `model`       | string | no       | provider default | Specific model id to use                          |
| `imageSize`   | string | no       | `"2K"`           | `"1K"`, `"2K"`, or `"4K"`                         |
| `aspectRatio` | string | no       | `"square"`       | `"square"`, `"portrait"`, `"landscape"`, `"wide"` |


### Example

```bash
curl -X POST https://eikonstudio.xyz/api/v1/generate \
  -H "Authorization: Bearer eik_your_platform_key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful landscape with mountains and a lake at sunset",
    "provider": "gemini",
    "imageSize": "2K",
    "aspectRatio": "landscape"
  }'
```

The endpoint is CORS-enabled and can be called from any origin. Requests are
authenticated per-user, but there is currently **no rate limiting** — if you
self-host Eikon Studio, you are responsible for your own Gemini / OpenAI
usage and costs. Consider adding rate limiting before exposing a public
deployment.

---

## Deployment

Any platform that runs Next.js works. The live demo is deployed on Vercel:

1. Push the repo to GitHub.
2. Import the project into Vercel (or your platform of choice).
3. Add the environment variables from `.env.example`.
4. Run `npx convex deploy` to provision a production Convex deployment and use the
  production `CONVEX_URL` / `CONVEX_SITE_URL` in your hosting environment.

---

## Contributing

Contributions are welcome. Please open an issue to discuss major changes before
submitting a pull request.

## License

[MIT](./LICENSE) © Mohtasham Murshid