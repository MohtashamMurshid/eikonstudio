import { Buffer } from "node:buffer";
import { z } from "zod";
import { GenerationRequestSchema, type GenerationRequest, type ModelOperationCapability, type ModelVariantId, type OperationType, type PublicGenerationError, type TaskType } from "@eikonstudio/core";
import { privateRedactedError, ProviderCredentialReferenceSchema, type AdapterContext, type ProviderCredentialReference, type WebhookVerificationRequest, type GenerationStatusResult, type NormalizedProviderInput, type ProviderAdapter, type ServerCredentialBroker, type SubmissionResult } from "../adapter.js";
import { parseImageReferences, resolveImageReferences, type ServerImageResolver } from "../image-references.js";
import { ProviderInputValidationError, ProviderOperationUnsupportedError } from "../openai/errors.js";
import { GOOGLE_VEO_IMAGE_CAPABILITY, GOOGLE_VEO_MAX_STATUS_BYTES, GOOGLE_VEO_MODEL, GOOGLE_VEO_NATIVE_MODEL, GOOGLE_VEO_TEXT_CAPABILITY } from "./veo-model.js";

const origin = "https://generativelanguage.googleapis.com";
const operationPrefix = `models/${GOOGLE_VEO_NATIVE_MODEL}/operations/`;
const valuesSchema = z.object({
  prompt: z.string().min(1).max(100_000).refine(value => value.trim().length > 0),
  negativePrompt: z.string().max(100_000).optional(),
  outputCount: z.literal(1), references: z.array(z.unknown()).max(2),
  aspectRatio: z.enum(["16:9", "9:16"]), resolution: z.enum(["720p", "1080p"]),
  durationSeconds: z.union([z.literal(4), z.literal(6), z.literal(8)]), audio: z.literal(true),
}).strict()
  .refine(value => value.resolution !== "1080p" || value.durationSeconds === 8)
  .refine(value => value.references.length !== 2 || value.durationSeconds === 8);
const operationSchema = z.object({
  name: z.string().min(1).max(256), done: z.boolean().optional(),
  error: z.object({ code: z.number().int() }).optional(),
  response: z.object({ generateVideoResponse: z.object({
    generatedSamples: z.array(z.object({ video: z.object({ uri: z.string().min(1).max(2_048) }) })).max(1).optional(),
    raiMediaFilteredCount: z.number().int().nonnegative().max(1).optional(),
  }) }).optional(),
});
type Category = PublicGenerationError["category"];
class VeoError extends Error {
  constructor(readonly category: Category, readonly status?: number) { super("Google video request failed."); }
}
const messages: Record<Category, string> = {
  authentication: "The provider credential was rejected.", "billing-access": "The provider denied access to this operation.",
  validation: "The provider rejected the request.", "rate-limit": "The provider rate limit was reached.",
  moderation: "The provider rejected the request under its safety policy.", "provider-unavailable": "The provider is unavailable.",
  timeout: "The provider request timed out.", cancelled: "The provider request was cancelled.", unknown: "The provider could not complete the request.",
};
export interface GoogleVeoAdapterOptions {
  credentialBroker: ServerCredentialBroker;
  fetch: typeof fetch;
  imageResolver?: ServerImageResolver;
  timeoutMs?: number;
  now?: () => string;
}

/** One submission or one poll per call. Scheduling and durable output storage belong to the caller. */
export class GoogleVeoAdapter implements ProviderAdapter {
  readonly providerId = "google" as const;
  readonly #options: GoogleVeoAdapterOptions;
  readonly #timeoutMs: number;
  constructor(options: GoogleVeoAdapterOptions) {
    this.#timeoutMs = options.timeoutMs ?? 60_000;
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs < 1 || this.#timeoutMs > 240_000) throw new TypeError("Veo timeout must be between 1 and 240000 milliseconds.");
    this.#options = options;
  }
  #unsupported(method: string): never { throw new ProviderOperationUnsupportedError("google", method); }
  async validateCredentials(_reference: ProviderCredentialReference): Promise<never> { return this.#unsupported("validateCredentials"); }
  async estimateCost(_input: NormalizedProviderInput, _context: AdapterContext): Promise<never> { return this.#unsupported("estimateCost"); }
  async cancelGeneration(_id: string, _context: AdapterContext): Promise<never> { return this.#unsupported("cancelGeneration"); }
  async normalizeOutput(_status: GenerationStatusResult, _context: AdapterContext): Promise<never> { return this.#unsupported("normalizeOutput"); }
  async verifyWebhook(_request: WebhookVerificationRequest): Promise<never> { return this.#unsupported("verifyWebhook"); }
  async discoverModels(_context: AdapterContext) {
    return { models: [GOOGLE_VEO_MODEL], transport: { submission: "asynchronous", polling: "required", webhook: "unsupported", cancellation: "unsupported", webhookSignatureSchemes: [] } as const, discoveredAt: this.#now() };
  }
  async getModelSchema(modelId: ModelVariantId, task: TaskType, operation: OperationType, _context: AdapterContext) {
    return { modelId, capability: capabilityFor(modelId, task, operation) };
  }
  async normalizeInput(request: GenerationRequest, capability: ModelOperationCapability): Promise<NormalizedProviderInput> {
    const parsed = GenerationRequestSchema.safeParse(request);
    if (!parsed.success) throw new ProviderInputValidationError();
    const value = parsed.data;
    const expected = capabilityFor(value.modelId, value.task, value.operation);
    if (value.schemaRevision !== expected.schemaRevision || capability.schemaRevision !== expected.schemaRevision || capability.task !== value.task || capability.operation !== value.operation || value.providerOptions || value.webhookTarget || value.input.seed !== undefined) throw new ProviderInputValidationError();
    const references = frameReferences(value.input.inputAssets, value.task);
    const values = valuesSchema.safeParse({
      prompt: value.input.prompt, ...(value.input.negativePrompt === undefined ? {} : { negativePrompt: value.input.negativePrompt }),
      outputCount: value.input.outputCount, references, aspectRatio: value.input.aspectRatio ?? "16:9", resolution: value.input.resolution ?? "720p",
      durationSeconds: value.input.durationSeconds ?? 8, audio: value.input.audio ?? true,
    });
    if (!values.success) throw new ProviderInputValidationError();
    return { modelId: value.modelId, task: value.task as "text-to-video" | "image-to-video", operation: value.operation, schemaRevision: expected.schemaRevision,
      native: { providerId: "google", namespace: "provider:google", values: { ...values.data, references } } };
  }
  async submitGeneration(input: NormalizedProviderInput, context: AdapterContext): Promise<SubmissionResult> {
    const expected = capabilityFor(input.modelId, input.task, input.operation);
    if (input.schemaRevision !== expected.schemaRevision || input.native.providerId !== "google" || input.native.namespace !== "provider:google") throw new ProviderInputValidationError();
    const parsed = valuesSchema.safeParse(input.native.values);
    if (!parsed.success) throw new ProviderInputValidationError();
    validateContext(context);
    const values = parsed.data;
    const images = await resolveImageReferences(frameReferences(values.references, input.task), this.#options.imageResolver);
    // Use the Gemini SDK wire format, verified with a live first/last-frame request.
    const inline = images.map(image => ({ mimeType: image.contentType, bytesBase64Encoded: Buffer.from(image.bytes).toString("base64") }));
    const body = JSON.stringify({
      instances: [{ prompt: values.prompt, ...(inline[0] ? { image: inline[0] } : {}), ...(inline[1] ? { lastFrame: inline[1] } : {}) }],
      parameters: { sampleCount: 1, aspectRatio: values.aspectRatio, resolution: values.resolution, durationSeconds: values.durationSeconds,
        personGeneration: input.task === "text-to-video" ? "allow_all" : "allow_adult", ...(values.negativePrompt === undefined ? {} : { negativePrompt: values.negativePrompt }) },
    });
    const result = await this.#request(GOOGLE_VEO_MODEL.providerNative.endpoint!, context, body);
    const operation = z.object({ name: z.string().min(1).max(256) }).safeParse(result);
    // Keep the operation identity even if it completed immediately; a later poll inspects its outcome.
    if (!operation.success || !isOperationName(operation.data.name)) throw new ProviderInputValidationError();
    return { delivery: "asynchronous", providerRequestId: operation.data.name, status: "processing" };
  }
  async getGenerationStatus(providerRequestId: string, context: AdapterContext): Promise<GenerationStatusResult> {
    if (!isOperationName(providerRequestId)) throw new ProviderInputValidationError();
    const result = operationSchema.safeParse(await this.#request(`/v1beta/${providerRequestId}`, context));
    if (!result.success || result.data.name !== providerRequestId) throw new ProviderInputValidationError();
    const operation = result.data;
    if (!operation.done) {
      if (operation.error || operation.response) throw new ProviderInputValidationError();
      return { providerRequestId, status: "processing" };
    }
    if (operation.error) {
      if (operation.response) throw new ProviderInputValidationError();
      return this.#terminalFailure(providerRequestId, rpcCategory(operation.error.code), context);
    }
    const response = operation.response?.generateVideoResponse;
    if (!response) throw new ProviderInputValidationError();
    if (response.raiMediaFilteredCount === 1) {
      if (response.generatedSamples?.length) throw new ProviderInputValidationError();
      return this.#terminalFailure(providerRequestId, "moderation", context);
    }
    const samples = response.generatedSamples;
    if (samples?.length !== 1 || !isVideoTransportUrl(samples[0]!.video.uri)) throw new ProviderInputValidationError();
    return { providerRequestId, status: "completed", pendingOutputs: [{ mediaType: "video", contentType: "video/mp4",
      reference: { kind: "provider-transport", providerId: "google", providerRequestId, transportUrl: samples[0]!.video.uri } }] };
  }
  #terminalFailure(providerRequestId: string, category: Category, context: AdapterContext): GenerationStatusResult {
    const error = this.normalizeError(new VeoError(category), context.requestId).publicError;
    return { providerRequestId, status: category === "cancelled" ? "cancelled" : "failed", error: { ...error, retryable: false } };
  }
  normalizeError(error: unknown, correlationId: string) {
    const category = error instanceof VeoError ? error.category : error instanceof ProviderInputValidationError || error instanceof ProviderOperationUnsupportedError ? "validation" : "unknown";
    const code = error instanceof ProviderOperationUnsupportedError ? "operation_unsupported" : `provider_${category.replaceAll("-", "_")}_error`;
    const status = error instanceof VeoError ? error.status : undefined;
    return { publicError: { category, code, message: messages[category], retryable: ["rate-limit", "provider-unavailable", "timeout"].includes(category), correlationId },
      privateError: privateRedactedError("google", correlationId, this.#now(), { providerId: "google", namespace: "provider:google", redacted: true, data: { category, code, ...(status === undefined ? {} : { status }) } }) };
  }
  async #request(path: string, context: AdapterContext, body?: string): Promise<unknown> {
    validateContext(context);
    return this.#options.credentialBroker.withCredential(context.credential, async plaintext => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      context.signal?.addEventListener("abort", abort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.#timeoutMs);
      try {
        if (context.signal?.aborted) throw new VeoError("cancelled");
        const response = await this.#options.fetch(`${origin}${path}`, { method: body === undefined ? "GET" : "POST", redirect: "error", signal: controller.signal,
          headers: { "x-goog-api-key": plaintext, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body }) });
        if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw new VeoError(httpCategory(response.status), response.status); }
        return await boundedJson(response);
      } catch (error) {
        if (timedOut) throw new VeoError("timeout");
        if (context.signal?.aborted) throw new VeoError("cancelled");
        if (error instanceof VeoError || error instanceof ProviderInputValidationError) throw error;
        if (error instanceof SyntaxError) throw new ProviderInputValidationError();
        throw new VeoError("provider-unavailable");
      } finally { clearTimeout(timer); context.signal?.removeEventListener("abort", abort); }
    });
  }
  #now() { return this.#options.now?.() ?? new Date().toISOString(); }
}
function capabilityFor(model: string, task: TaskType, operation: OperationType) {
  if (model !== GOOGLE_VEO_MODEL.id || operation !== "generate" || !["text-to-video", "image-to-video"].includes(task)) throw new ProviderInputValidationError();
  return task === "image-to-video" ? GOOGLE_VEO_IMAGE_CAPABILITY : GOOGLE_VEO_TEXT_CAPABILITY;
}
function frameReferences(value: unknown, task: TaskType) {
  const references = parseImageReferences(value, task === "image-to-video");
  if (references.length > 2 || references.some(reference => !["image/png", "image/jpeg"].includes(reference.contentType))) throw new ProviderInputValidationError();
  return references;
}
function validateContext(context: AdapterContext) {
  if (!ProviderCredentialReferenceSchema.safeParse(context.credential).success || context.credential.providerId !== "google") throw new ProviderInputValidationError();
  if (context.signal?.aborted) throw new VeoError("cancelled");
}
function isOperationName(value: string) {
  const id = value.slice(operationPrefix.length);
  return value.startsWith(operationPrefix) && value.length <= 256 && id.length > 0 && !/[^A-Za-z0-9_-]/.test(id);
}
function isVideoTransportUrl(value: string): boolean {
  // A locator is not a fetch grant. Reject alternate origins, credentials, fragments, and extra query parameters.
  return /^https:\/\/generativelanguage\.googleapis\.com\/(?:download\/)?v1beta\/files\/[A-Za-z0-9_-]+:download\?alt=media$/.test(value) && !/[\r\n]/.test(value);
}
async function boundedJson(response: Response): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > GOOGLE_VEO_MAX_STATUS_BYTES) {
    await response.body?.cancel().catch(() => undefined); throw new ProviderInputValidationError();
  }
  if (!response.body) throw new ProviderInputValidationError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > GOOGLE_VEO_MAX_STATUS_BYTES) { await reader.cancel().catch(() => undefined); throw new ProviderInputValidationError(); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
}
function httpCategory(status: number): Category {
  if (status === 401) return "authentication";
  if (status === 403) return "billing-access";
  if ([400, 404, 422].includes(status)) return "validation";
  if (status === 429) return "rate-limit";
  if (status === 408 || status === 504) return "timeout";
  return status >= 500 ? "provider-unavailable" : "unknown";
}
function rpcCategory(code: number): Category {
  return ({ 1: "cancelled", 3: "validation", 5: "validation", 7: "billing-access", 8: "rate-limit", 9: "billing-access", 13: "provider-unavailable", 14: "provider-unavailable", 16: "authentication" } as Record<number, Category>)[code] ?? "unknown";
}
