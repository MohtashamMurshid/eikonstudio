import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";

import type {
  GenerationRequest,
  ModelOperationCapability,
  ModelVariantId,
  NormalizedErrorResult,
  OperationType,
  PublicGenerationError,
  TaskType,
} from "@eikonstudio/core";
import {
  privateRedactedError,
  ProviderCredentialReferenceSchema,
  type AdapterContext,
  type CostEstimate,
  type CredentialValidationResult,
  type GenerationStatusResult,
  type ModelDiscoveryResult,
  type NormalizedProviderInput,
  type ProviderAdapter,
  type ProviderCredentialReference,
  type ProviderModelSchema,
  type ProviderOutput,
  type ServerCredentialBroker,
  type SubmissionResult,
  type WebhookVerificationRequest,
  type WebhookVerificationResult,
} from "../adapter.js";
import { ProviderInputValidationError, ProviderOperationUnsupportedError, unsupportedOpenAI } from "./errors.js";
import {
  OPENAI_IMAGE_CAPABILITY,
  OPENAI_IMAGE_MAX_OUTPUT_BYTES,
  OPENAI_IMAGE_MODEL,
  OPENAI_IMAGE_MODEL_ID,
  OPENAI_IMAGE_NATIVE_MODEL_ID,
  OPENAI_IMAGE_QUALITIES,
  OPENAI_IMAGE_SCHEMA_REVISION,
  OPENAI_IMAGE_SIZES,
} from "./model.js";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const REQUEST_TIMEOUT_MS = 240_000;
const CONTENT_TYPE = "image/png";
const RESPONSE_JSON_OVERHEAD_BYTES = 65_536;
const MAX_RESPONSE_BODY_BYTES = 4 * Math.ceil(OPENAI_IMAGE_MAX_OUTPUT_BYTES / 3) + RESPONSE_JSON_OVERHEAD_BYTES;
type ErrorCategory = PublicGenerationError["category"];

class ResponseBodyOverflowError extends Error {
  constructor() {
    super("OpenAI response body exceeded the configured limit.");
    this.name = "ResponseBodyOverflowError";
  }
}

const PUBLIC_MESSAGES: Record<ErrorCategory, string> = {
  authentication: "The provider credential was rejected.",
  "billing-access": "The provider denied access to this operation.",
  validation: "The provider rejected the request.",
  "rate-limit": "The provider rate limit was reached.",
  moderation: "The provider rejected the request under its safety policy.",
  "provider-unavailable": "The provider is unavailable.",
  timeout: "The provider request timed out.",
  cancelled: "The provider request was cancelled.",
  unknown: "The provider could not complete the request.",
};

type ErrorFacts = { category: ErrorCategory; code: string; retryable: boolean; status?: number | undefined; nativeCode?: string | undefined };

export interface OpenAIImageAdapterOptions {
  readonly credentialBroker: ServerCredentialBroker;
  readonly fetch: typeof fetch;
  readonly timeoutMs?: number;
  readonly now?: () => string;
}

export class OpenAIImageAdapter implements ProviderAdapter {
  readonly providerId = "openai" as const;
  readonly #credentialBroker: ServerCredentialBroker;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;
  readonly #now: () => string;

  constructor(options: OpenAIImageAdapterOptions) {
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > REQUEST_TIMEOUT_MS) {
      throw new TypeError("OpenAI timeout must be between 1 and 240000 milliseconds.");
    }
    this.#credentialBroker = options.credentialBroker;
    this.#fetch = options.fetch;
    this.#timeoutMs = timeoutMs;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  async validateCredentials(_reference: ProviderCredentialReference): Promise<CredentialValidationResult> {
    throw unsupportedOpenAI("validateCredentials");
  }

  async discoverModels(_context: AdapterContext): Promise<ModelDiscoveryResult> {
    return {
      models: [OPENAI_IMAGE_MODEL],
      transport: { submission: "synchronous", webhook: "unsupported", polling: "unsupported", cancellation: "unsupported", webhookSignatureSchemes: [] },
      discoveredAt: this.#now(),
    };
  }

  async getModelSchema(modelId: ModelVariantId, task: TaskType, operation: OperationType, _context: AdapterContext): Promise<ProviderModelSchema> {
    assertSupported(modelId, task, operation, OPENAI_IMAGE_SCHEMA_REVISION);
    return { modelId: OPENAI_IMAGE_MODEL.id, capability: OPENAI_IMAGE_CAPABILITY };
  }

  async normalizeInput(request: GenerationRequest, capability: ModelOperationCapability): Promise<NormalizedProviderInput> {
    assertSupported(request.modelId, request.task, request.operation, request.schemaRevision);
    if (capability.schemaRevision !== OPENAI_IMAGE_SCHEMA_REVISION || capability.task !== "text-to-image" || capability.operation !== "generate") {
      throw new ProviderInputValidationError();
    }
    const prompt = request.input.prompt;
    if (request.input.outputCount !== 1 || request.input.inputAssets.length !== 0 || typeof prompt !== "string" || prompt.length < 1 || prompt.length > 32_000) {
      throw new ProviderInputValidationError();
    }
    const { size, quality } = openAIImageSettings(request.input.aspectRatio, request.input.resolution);
    return {
      modelId: request.modelId,
      task: "text-to-image",
      operation: "generate",
      schemaRevision: OPENAI_IMAGE_SCHEMA_REVISION,
      native: { namespace: "provider:openai", providerId: "openai", values: { prompt, outputCount: 1, size, quality } },
    };
  }

  async estimateCost(_input: NormalizedProviderInput, _context: AdapterContext): Promise<CostEstimate> {
    throw unsupportedOpenAI("estimateCost");
  }

  async submitGeneration(input: NormalizedProviderInput, context: AdapterContext): Promise<SubmissionResult> {
    if (context.signal?.aborted) throw new APIUserAbortError();
    const credential = parseOpenAICredential(context.credential);
    const { prompt, size, quality } = validateSubmission(input);
    return this.#credentialBroker.withCredential(credential, async (plaintext) => {
      const client = new OpenAI({ apiKey: plaintext, baseURL: OPENAI_BASE_URL, fetch: boundedFetch(this.#fetch), maxRetries: 0, timeout: this.#timeoutMs });
      let response;
      try {
        response = await client.images
          .generate({ model: OPENAI_IMAGE_NATIVE_MODEL_ID, prompt, n: 1, output_format: "png", stream: false, size, quality }, { signal: context.signal })
          .withResponse();
      } catch (error) {
        if (hasResponseBodyOverflowCause(error)) throw new ProviderInputValidationError();
        if (error instanceof SyntaxError) throw new ProviderInputValidationError();
        throw error;
      }
      const providerRequestId = response.request_id;
      if (typeof providerRequestId !== "string" || providerRequestId.length < 1 || providerRequestId.length > 256) throw new ProviderInputValidationError();
      const images = response.data.data;
      if (!Array.isArray(images) || images.length !== 1 || images[0]?.url !== undefined) throw new ProviderInputValidationError();
      const image = images[0];
      if (image === undefined) throw new ProviderInputValidationError();
      const bytes = decodeBoundedBase64(image.b64_json);
      return { delivery: "synchronous", providerRequestId, status: "completed", outputs: [{ mediaType: "image", contentType: CONTENT_TYPE, bytes }] };
    });
  }

  async getGenerationStatus(_providerRequestId: string, _context: AdapterContext): Promise<GenerationStatusResult> {
    throw unsupportedOpenAI("getGenerationStatus");
  }

  async cancelGeneration(_providerRequestId: string, _context: AdapterContext): Promise<never> {
    throw unsupportedOpenAI("cancelGeneration");
  }

  async normalizeOutput(_status: GenerationStatusResult, _context: AdapterContext): Promise<ProviderOutput> {
    throw unsupportedOpenAI("normalizeOutput");
  }

  normalizeError(error: unknown, correlationId: string): NormalizedErrorResult {
    const facts = classifyError(error);
    const nativeData: Record<string, string | number> = { category: facts.category, code: facts.code };
    if (facts.status !== undefined) nativeData.status = facts.status;
    if (facts.nativeCode !== undefined) nativeData.nativeCode = facts.nativeCode;
    return {
      publicError: { category: facts.category, code: facts.code, message: PUBLIC_MESSAGES[facts.category], retryable: facts.retryable, correlationId },
      privateError: privateRedactedError("openai", correlationId, this.#now(), {
        namespace: "provider:openai",
        providerId: "openai",
        redacted: true,
        data: nativeData,
      }),
    };
  }

  async verifyWebhook(_request: WebhookVerificationRequest): Promise<WebhookVerificationResult> {
    throw unsupportedOpenAI("verifyWebhook");
  }
}

function assertSupported(modelId: ModelVariantId, task: TaskType, operation: OperationType, schemaRevision: string): void {
  if (modelId !== OPENAI_IMAGE_MODEL_ID || task !== "text-to-image" || operation !== "generate" || schemaRevision !== OPENAI_IMAGE_SCHEMA_REVISION) {
    throw new ProviderInputValidationError();
  }
}

function parseOpenAICredential(value: unknown): ProviderCredentialReference {
  const parsed = ProviderCredentialReferenceSchema.safeParse(value);
  if (!parsed.success || parsed.data.providerId !== "openai") throw new ProviderInputValidationError();
  return parsed.data;
}

function validateSubmission(input: NormalizedProviderInput): {
  prompt: string;
  size: (typeof OPENAI_IMAGE_SIZES)[number];
  quality: (typeof OPENAI_IMAGE_QUALITIES)[number];
} {
  assertSupported(input.modelId, input.task, input.operation, input.schemaRevision);
  if (input.native.namespace !== "provider:openai" || input.native.providerId !== "openai") throw new ProviderInputValidationError();
  const keys = Object.keys(input.native.values).sort();
  const { prompt, size, quality } = input.native.values;
  if (
    keys.join(",") !== "outputCount,prompt,quality,size" ||
    input.native.values.outputCount !== 1 ||
    typeof prompt !== "string" ||
    prompt.length < 1 ||
    prompt.length > 32_000 ||
    typeof size !== "string" ||
    !OPENAI_IMAGE_SIZES.includes(size as (typeof OPENAI_IMAGE_SIZES)[number]) ||
    typeof quality !== "string" ||
    !OPENAI_IMAGE_QUALITIES.includes(quality as (typeof OPENAI_IMAGE_QUALITIES)[number])
  ) {
    throw new ProviderInputValidationError();
  }
  return {
    prompt,
    size: size as (typeof OPENAI_IMAGE_SIZES)[number],
    quality: quality as (typeof OPENAI_IMAGE_QUALITIES)[number],
  };
}

function openAIImageSettings(
  aspectRatio: string | undefined,
  resolution: string | undefined,
): { size: (typeof OPENAI_IMAGE_SIZES)[number]; quality: (typeof OPENAI_IMAGE_QUALITIES)[number] } {
  const quality = resolution === "4K" ? "high" : resolution === "1K" ? "auto" : "medium";
  if (aspectRatio === "9:16") return { size: "1024x1536", quality };
  if (aspectRatio === "16:9" || aspectRatio === "21:9") return { size: "1536x1024", quality };
  return { size: "1024x1024", quality };
}

function boundedFetch(injectedFetch: typeof fetch): typeof fetch {
  return async (input, init) => boundResponse(await injectedFetch(input, init));
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

function hasResponseBodyOverflowCause(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (current instanceof ResponseBodyOverflowError) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function decodeBoundedBase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || value.length > Math.ceil(OPENAI_IMAGE_MAX_OUTPUT_BYTES / 3) * 4) throw new ProviderInputValidationError();
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new ProviderInputValidationError();
  const bytes = Uint8Array.from(Buffer.from(value, "base64"));
  if (bytes.length === 0 || bytes.length > OPENAI_IMAGE_MAX_OUTPUT_BYTES || Buffer.from(bytes).toString("base64") !== value) throw new ProviderInputValidationError();
  return bytes;
}

function classifyError(error: unknown): ErrorFacts {
  if (error instanceof ProviderOperationUnsupportedError) return { category: "validation", code: "operation_unsupported", retryable: false };
  if (error instanceof ProviderInputValidationError) return { category: "validation", code: "invalid_provider_response", retryable: false };
  if (error instanceof APIConnectionTimeoutError) return { category: "timeout", code: "provider_timeout", retryable: true };
  if (error instanceof APIUserAbortError || (error instanceof Error && error.name === "AbortError")) return { category: "cancelled", code: "request_cancelled", retryable: false };
  if (error instanceof APIConnectionError) return { category: "provider-unavailable", code: "provider_connection_error", retryable: true };
  if (error instanceof APIError) return classifyApiError(error.status, allowlistedCode(error.code));
  return { category: "unknown", code: "provider_error", retryable: false };
}

function allowlistedCode(code: string | null | undefined): string | undefined {
  return code === "content_policy_violation" || code === "billing_hard_limit_reached" ? code : undefined;
}

function classifyApiError(status: number | undefined, nativeCode: string | undefined): ErrorFacts {
  if (nativeCode === "content_policy_violation") return { category: "moderation", code: "content_policy_violation", retryable: false, status, nativeCode };
  if (nativeCode === "billing_hard_limit_reached") return { category: "billing-access", code: "billing_access_denied", retryable: false, status, nativeCode };
  if (status === 400 || status === 422) return { category: "validation", code: "provider_validation_error", retryable: false, status };
  if (status === 401) return { category: "authentication", code: "provider_authentication_error", retryable: false, status };
  if (status === 403) return { category: "billing-access", code: "provider_access_denied", retryable: false, status };
  if (status === 429) return { category: "rate-limit", code: "provider_rate_limit", retryable: true, status };
  if (status !== undefined && status >= 500 && status <= 599) return { category: "provider-unavailable", code: "provider_unavailable", retryable: true, status };
  return { category: "unknown", code: "provider_error", retryable: false, status };
}
