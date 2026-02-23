export type ImageSize = "1K" | "2K" | "4K";
export type AspectRatio = "square" | "portrait" | "landscape" | "wide";
export type GenerationMode = "text-to-image" | "image-editing";

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

function getGenerateUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/generate`;
}

export async function generateImage(
  baseUrl: string,
  payload: GenerateImageRequest
): Promise<GenerateImageResponse> {
  const response = await fetch(getGenerateUrl(baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new EikonApiError(
      body?.error ?? "Request failed",
      response.status,
      body?.details ?? ""
    );
  }

  return body as GenerateImageResponse;
}
