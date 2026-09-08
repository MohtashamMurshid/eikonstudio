"use node";

import { Buffer } from "node:buffer";
import type { GenerationStatusResult, ProviderCredentialReference, ServerCredentialBroker } from "@eikonstudio/providers";
import { isDurableProviderIdentity } from "./durableExecutionPolicy";

export const VIDEO_MAX_BYTES = 100_000_000;
export const VIDEO_DOWNLOAD_TIMEOUT_MS = 120_000;

export class VideoDownloadError extends Error {
  constructor(readonly code: string, readonly retryable = false) {
    super(code);
    this.name = "VideoDownloadError";
  }
}

// Only recognized transport failures grant a retry. Never retain native messages or URLs.
function transportFailure(error: unknown): VideoDownloadError {
  const candidate = error as { code?: string; name?: string; cause?: { code?: string } } | null;
  const code = candidate?.cause?.code ?? candidate?.code;
  const retryable = candidate?.name === "AbortError" ||
    ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET"].includes(code ?? "");
  return new VideoDownloadError("VIDEO_DOWNLOAD_TRANSPORT", retryable);
}

/** This grant exists only inside one request-bound server operation. It is never a persisted transport URL. */
function approveDownload(status: GenerationStatusResult, requestId: string): string {
  const output = status.pendingOutputs?.[0];
  const reference = output?.reference;
  if (!isDurableProviderIdentity(requestId, "google", "veo-3.1-generate-preview") ||
    status.status !== "completed" || status.providerRequestId !== requestId || status.pendingOutputs?.length !== 1 ||
    output?.mediaType !== "video" || output.contentType !== "video/mp4" || reference?.kind !== "provider-transport" ||
    reference.providerId !== "google" || reference.providerRequestId !== requestId ||
    !/^https:\/\/generativelanguage\.googleapis\.com\/(?:download\/)?v1beta\/files\/[A-Za-z0-9_-]+:download\?alt=media$/.test(reference.transportUrl) ||
    /[\r\n]/.test(reference.transportUrl)) throw new VideoDownloadError("VIDEO_DOWNLOAD_POLICY_REJECTED");
  return reference.transportUrl;
}

export async function downloadDurableVideo(args: {
  status: GenerationStatusResult; requestId: string; credential: ProviderCredentialReference;
  withCredential: ServerCredentialBroker["withCredential"]; fetch: typeof fetch;
}): Promise<Buffer> {
  const url = approveDownload(args.status, args.requestId);
  if (args.credential.providerId !== "google") throw new VideoDownloadError("VIDEO_DOWNLOAD_POLICY_REJECTED");
  return args.withCredential(args.credential, async secret => {
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new VideoDownloadError("VIDEO_DOWNLOAD_TIMEOUT", true)); }, VIDEO_DOWNLOAD_TIMEOUT_MS);
    });
    try {
      return await Promise.race([timeout, (async () => {
        const response = await args.fetch(url, { method: "GET", redirect: "manual", signal: controller.signal,
          headers: { "x-goog-api-key": secret, accept: "video/mp4" } }).catch(error => { throw transportFailure(error); });
        if (response.redirected || (response.url && response.url !== url) || (response.status >= 300 && response.status < 400)) {
          void response.body?.cancel().catch(() => undefined);
          throw new VideoDownloadError("VIDEO_DOWNLOAD_POLICY_REJECTED");
        }
        if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
          void response.body?.cancel().catch(() => undefined);
          throw new VideoDownloadError("VIDEO_DOWNLOAD_TRANSIENT_HTTP", true);
        }
        const length = response.headers.get("content-length");
        if (controller.signal.aborted || !response.ok || response.status !== 200 || response.redirected || (response.url && response.url !== url) ||
          response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "video/mp4" ||
          (length !== null && (!/^\d+$/.test(length) || Number(length) > VIDEO_MAX_BYTES)) || !response.body) {
          void response.body?.cancel().catch(() => undefined);
          throw new VideoDownloadError("VIDEO_DOWNLOAD_REJECTED");
        }
        reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const part = await reader.read().catch(error => { throw transportFailure(error); });
          if (controller.signal.aborted) throw new VideoDownloadError("VIDEO_DOWNLOAD_TIMEOUT", true);
          if (part.done) break;
          size += part.value.byteLength;
          if (size > VIDEO_MAX_BYTES) throw new VideoDownloadError("VIDEO_DOWNLOAD_TOO_LARGE");
          chunks.push(part.value);
        }
        const bytes = Buffer.concat(chunks, size);
        if (bytes.length < 12 || bytes.toString("ascii", 4, 8) !== "ftyp" ||
          (length !== null && Number(length) !== size)) throw new VideoDownloadError("VIDEO_DOWNLOAD_INVALID_MP4");
        return bytes;
      })()]);
    } finally {
      clearTimeout(timer);
      controller.abort();
      void reader?.cancel().catch(() => undefined);
    }
  });
}
