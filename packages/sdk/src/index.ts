export const IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export const ASPECT_RATIOS = ["square", "portrait", "landscape", "wide"] as const;
export const GENERATION_MODES = ["text-to-image", "image-editing"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type GenerationMode = (typeof GENERATION_MODES)[number];

export type GenerateImageRequest = {
  prompt: string;
  imageSize: ImageSize;
  aspectRatio?: AspectRatio;
  mode?: GenerationMode;
  apiKey?: string;
  images?: string[];
};

export type GenerateImageResponse = {
  url: string;
  prompt: string;
  description: string;
  metadata: {
    imageSize: ImageSize;
    aspectRatio: AspectRatio;
    mode: GenerationMode;
  };
};

type GenerateImageErrorBody = {
  error?: string;
  details?: string;
};

export type GenerateImageOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export type DecodedDataUrl = {
  mimeType: string;
  base64: string;
  bytes: Uint8Array;
};

export class EikonApiError extends Error {
  status: number;
  details: string;

  constructor(message: string, status: number, details: string) {
    super(message);
    this.name = "EikonApiError";
    this.status = status;
    this.details = details;
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function getGenerateUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/api/v1/generate`;
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isGenerateImageResponse(body: unknown): body is GenerateImageResponse {
  return Boolean(
    body &&
      typeof body === "object" &&
      typeof (body as { url?: unknown }).url === "string" &&
      typeof (body as { prompt?: unknown }).prompt === "string"
  );
}

export async function generateImage(
  baseUrl: string,
  payload: GenerateImageRequest,
  options: GenerateImageOptions = {}
): Promise<GenerateImageResponse> {
  const response = await fetch(getGenerateUrl(baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const responseText = await response.text();
  const body = parseJsonSafely(responseText) as GenerateImageErrorBody | GenerateImageResponse | null;

  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? (body as GenerateImageErrorBody) : null;
    throw new EikonApiError(
      errorBody?.error ?? "Request failed",
      response.status,
      errorBody?.details ?? responseText
    );
  }

  if (!isGenerateImageResponse(body)) {
    throw new EikonApiError("Unexpected API response shape", response.status, responseText);
  }

  return body;
}

const DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/;

export function decodeDataUrl(dataUrl: string): DecodedDataUrl {
  const match = dataUrl.match(DATA_URL_REGEX);
  if (!match) {
    throw new Error("Invalid data URL format");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));

  return { mimeType, base64, bytes };
}

export function mimeTypeToExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  switch (lower) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}
