# Nano Banana Starter

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/mohtashams-projects/v0-nano-banana-starter)

## Overview

A Next.js application for combining and generating images using AI.

## Deployment

Your project is live at:

**[https://vercel.com/mohtashams-projects/v0-nano-banana-starter](https://vercel.com/mohtashams-projects/v0-nano-banana-starter)**

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
curl -X POST https://your-domain.vercel.app/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful landscape with mountains and a lake at sunset",
    "imageSize": "2K",
    "aspectRatio": "landscape"
  }'
```

#### JavaScript Example

```javascript
const response = await fetch('https://your-domain.vercel.app/api/v1/generate', {
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

url = 'https://your-domain.vercel.app/api/v1/generate'
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
curl -X POST https://your-domain.vercel.app/api/v1/generate \
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
