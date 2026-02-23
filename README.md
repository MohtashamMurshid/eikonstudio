# Nano Banana Starter

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/mohtashams-projects/v0-nano-banana-starter)

## Overview

A Next.js application for combining and generating images using AI.

## Deployment

Your project is live at:

**[https://vercel.com/mohtashams-projects/v0-nano-banana-starter](https://vercel.com/mohtashams-projects/v0-nano-banana-starter)**

**Domain:** https://nano.mohtasham.dev

## Monorepo (Turborepo) - Phase 1

This repository now uses a Turborepo + pnpm workspace setup.

### Workspace layout

- `.` (root): existing Next.js web app (kept in place for Vercel safety)
- `apps/cli`: Bun-based CLI scaffold (OpenTUI target)
- `packages/sdk`: shared TypeScript SDK package

### Useful commands

```bash
# Existing web app commands (unchanged)
pnpm dev
pnpm build
pnpm lint

# Monorepo orchestration
pnpm dev:monorepo
pnpm build:monorepo
pnpm lint:monorepo
pnpm typecheck:monorepo
```

### Vercel safety note

The web app has not been moved yet, so existing Vercel build behavior remains unchanged.
If/when the web app is later moved to `apps/web`, update the Vercel Root Directory accordingly.

## Public API

The application provides a public REST API for image generation.

### Endpoint

`POST /api/v1/generate`

### Mandatory Parameters

- `prompt` (string) - Text description of the image to generate
- `imageSize` (string) - Resolution: `"1K"`, `"2K"`, or `"4K"`

### Optional Parameters

- `aspectRatio` (string) - Default: `"square"`. Options: `"square"`, `"portrait"`, `"landscape"`, `"wide"`
- `mode` (string) - Default: `"text-to-image"`. Options: `"text-to-image"`, `"image-editing"`
- `apiKey` (string) - Google Gemini API key (optional, will use server default if not provided)
- `images` (array) - Array of image URLs or base64 data (required for `image-editing` mode)

### Request Formats

#### JSON Request (Recommended for Programmatic Use)

```bash
curl -X POST https://nano.mohtasham.dev/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful landscape with mountains and a lake at sunset",
    "imageSize": "2K",
    "aspectRatio": "landscape"
  }'
```

#### JavaScript Example

```javascript
const response = await fetch('https://nano.mohtasham.dev/api/v1/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'A cyberpunk cityscape with neon lights',
    imageSize: '2K',
    aspectRatio: 'portrait',
  }),
});

const data = await response.json();
console.log(data.url); // base64 image data
```

#### Python Example

```python
import requests

url = 'https://nano.mohtasham.dev/api/v1/generate'
payload = {
    'prompt': 'A majestic dragon soaring through clouds',
    'imageSize': '4K',
    'aspectRatio': 'square'
}

response = requests.post(url, json=payload)
data = response.json()
print(data['url']) # base64 image data
```

#### FormData Request (For File Uploads)

```bash
curl -X POST https://nano.mohtasham.dev/api/v1/generate \
  -F "prompt=A cyberpunk portrait" \
  -F "imageSize=2K" \
  -F "aspectRatio=square" \
  -F "mode=image-editing" \
  -F "images=@/path/to/image.jpg"
```

### Response Format

```json
{
  "url": "data:image/png;base64,iVBORw0KGgo...",
  "prompt": "A beautiful landscape with mountains and a lake at sunset",
  "description": "",
  "metadata": {
    "imageSize": "2K",
    "aspectRatio": "landscape",
    "mode": "text-to-image"
  }
}
```

### Error Responses

```json
{
  "error": "Missing required field",
  "details": "'prompt' is required and cannot be empty"
}
```

### CORS

The API supports CORS and can be called from any origin.
