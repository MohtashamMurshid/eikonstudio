import { Buffer } from "node:buffer";
import { ProviderInputValidationError } from "./openai/errors.js";
import { OPENAI_IMAGE_MAX_OUTPUT_BYTES } from "./openai/model.js";
const MAX_RESPONSE_BODY_BYTES = 4 * Math.ceil(OPENAI_IMAGE_MAX_OUTPUT_BYTES / 3) + 65_536;
class ResponseBodyOverflowError extends Error {}

export function boundedFetch(injectedFetch: typeof fetch): typeof fetch {
  // OpenAI uses this constructor for its local FormData compatibility probe.
  // Without it the SDK calls injectedFetch("data:,") before the provider request.
  return Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => boundResponse(await injectedFetch(input, { ...init, redirect: "error" })),
    { Response },
  );
}

async function boundResponse(response: Response): Promise<Response> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_RESPONSE_BODY_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseBodyOverflowError();
  }
  if (response.body === null) return new Response(null, responseInit(response));

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (byteLength + result.value.byteLength > MAX_RESPONSE_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ResponseBodyOverflowError();
      }
      chunks.push(result.value);
      byteLength += result.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(bytes, responseInit(response));
}

function responseInit(response: Response): ResponseInit {
  return { status: response.status, statusText: response.statusText, headers: response.headers };
}

export function hasResponseBodyOverflowCause(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (current instanceof ResponseBodyOverflowError) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export function decodeBoundedBase64(value: unknown, maxBytes = OPENAI_IMAGE_MAX_OUTPUT_BYTES): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || value.length > Math.ceil(maxBytes / 3) * 4)
    throw new ProviderInputValidationError();
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new ProviderInputValidationError();
  const bytes = Uint8Array.from(Buffer.from(value, "base64"));
  if (bytes.length === 0 || bytes.length > maxBytes || Buffer.from(bytes).toString("base64") !== value)
    throw new ProviderInputValidationError();
  return bytes;
}
