import { Buffer } from "node:buffer";
import { z } from "zod";
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
import { boundedFetch, decodeBoundedBase64, hasResponseBodyOverflowCause } from "../image-bytes.js";
import { parseImageReferences, resolveImageReferences, type ServerImageResolver } from "../image-references.js";
import { ProviderInputValidationError, ProviderOperationUnsupportedError } from "../openai/errors.js";
import { GOOGLE_IMAGE_CAPABILITY, GOOGLE_IMAGE_EDIT_CAPABILITY, GOOGLE_IMAGE_MODELS, GOOGLE_IMAGE_MAX_OUTPUT_BYTES } from "./model.js";

const valuesSchema = z
  .object({
    prompt: z.string().min(1).max(100_000),
    outputCount: z.literal(1),
    references: z.array(z.unknown()),
    aspectRatio: z.enum(["1:1", "9:16", "16:9", "21:9"]),
    resolution: z.enum(["1K", "2K", "4K"]),
  })
  .strict();
const responseSchema = z.object({
  responseId: z.string().min(1).max(256),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z.object({
          parts: z.array(
            z.object({
              thought: z.boolean().optional(),
              inlineData: z.object({ data: z.string(), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]) }).optional(),
            }),
          ),
        }),
      }),
    )
    .length(1),
});
type Category = PublicGenerationError["category"];
class GoogleTransportError extends Error {
  constructor(
    readonly category: Category,
    readonly status?: number,
  ) {
    super("Google image request failed.");
  }
}
const messages: Record<Category, string> = {
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
export interface GoogleImageAdapterOptions {
  credentialBroker: ServerCredentialBroker;
  fetch: typeof fetch;
  imageResolver?: ServerImageResolver;
  timeoutMs?: number;
  now?: () => string;
}

/** One synchronous REST submission, with no SDK retries or credential-bearing query strings. */
export class GoogleImageAdapter implements ProviderAdapter {
  readonly providerId = "google" as const;
  readonly #options: GoogleImageAdapterOptions;
  readonly #timeoutMs: number;
  constructor(options: GoogleImageAdapterOptions) {
    this.#timeoutMs = options.timeoutMs ?? 240_000;
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs < 1 || this.#timeoutMs > 240_000)
      throw new TypeError("Google timeout must be between 1 and 240000 milliseconds.");
    this.#options = options;
  }
  #unsupported(operation: string): never {
    throw new ProviderOperationUnsupportedError("google", operation);
  }
  async validateCredentials(_reference: ProviderCredentialReference): Promise<CredentialValidationResult> {
    return this.#unsupported("validateCredentials");
  }
  async discoverModels(_context: AdapterContext): Promise<ModelDiscoveryResult> {
    return {
      models: GOOGLE_IMAGE_MODELS,
      transport: {
        submission: "synchronous",
        webhook: "unsupported",
        polling: "unsupported",
        cancellation: "unsupported",
        webhookSignatureSchemes: [],
      },
      discoveredAt: this.#now(),
    };
  }
  async getModelSchema(
    modelId: ModelVariantId,
    task: TaskType,
    operation: OperationType,
    _context: AdapterContext,
  ): Promise<ProviderModelSchema> {
    const capability = task === "image-to-image" ? GOOGLE_IMAGE_EDIT_CAPABILITY : GOOGLE_IMAGE_CAPABILITY;
    assertSupported(modelId, task, operation, capability.schemaRevision);
    return { modelId, capability };
  }
  async normalizeInput(request: GenerationRequest, capability: ModelOperationCapability): Promise<NormalizedProviderInput> {
    assertSupported(request.modelId, request.task, request.operation, request.schemaRevision);
    if (
      capability.schemaRevision !== request.schemaRevision ||
      capability.task !== request.task ||
      capability.operation !== request.operation
    )
      throw new ProviderInputValidationError();
    const references = parseImageReferences(request.input.inputAssets, request.task === "image-to-image");
    const values = valuesSchema.safeParse({
      prompt: request.input.prompt,
      outputCount: request.input.outputCount,
      references,
      aspectRatio: request.input.aspectRatio ?? "1:1",
      resolution: request.input.resolution ?? "2K",
    });
    if (!values.success) throw new ProviderInputValidationError();
    return {
      modelId: request.modelId,
      task: request.task as "text-to-image" | "image-to-image",
      operation: request.operation,
      schemaRevision: request.schemaRevision,
      native: { providerId: "google", namespace: "provider:google", values: { ...values.data, references } },
    };
  }
  async estimateCost(_input: NormalizedProviderInput, _context: AdapterContext): Promise<CostEstimate> {
    return this.#unsupported("estimateCost");
  }
  async submitGeneration(input: NormalizedProviderInput, context: AdapterContext): Promise<SubmissionResult> {
    if (context.signal?.aborted) throw new GoogleTransportError("cancelled");
    const model = assertSupported(input.modelId, input.task, input.operation, input.schemaRevision);
    const credential = ProviderCredentialReferenceSchema.safeParse(context.credential);
    const values = valuesSchema.safeParse(input.native.values);
    if (
      !credential.success ||
      credential.data.providerId !== "google" ||
      input.native.providerId !== "google" ||
      input.native.namespace !== "provider:google" ||
      !values.success
    )
      throw new ProviderInputValidationError();
    const references = parseImageReferences(values.data.references, input.task === "image-to-image");
    const images = await resolveImageReferences(references, this.#options.imageResolver);
    const body = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            ...images.map((image) => ({ inlineData: { data: Buffer.from(image.bytes).toString("base64"), mimeType: image.contentType } })),
            { text: values.data.prompt },
          ],
        },
      ],
      // Existing studio edits let the model derive output dimensions from the references.
      ...(input.task === "text-to-image"
        ? { generationConfig: { imageConfig: { aspectRatio: values.data.aspectRatio, imageSize: values.data.resolution } } }
        : {}),
    });
    if (context.signal?.aborted) throw new GoogleTransportError("cancelled");
    return this.#options.credentialBroker.withCredential(credential.data, async (plaintext) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      context.signal?.addEventListener("abort", abort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.#timeoutMs);
      try {
        if (context.signal?.aborted) throw new GoogleTransportError("cancelled");
        const response = await boundedFetch(this.#options.fetch)(
          `https://generativelanguage.googleapis.com${model.providerNative.endpoint}`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": plaintext },
            body,
            signal: controller.signal,
            redirect: "error",
          },
        );
        if (!response.ok) throw new GoogleTransportError(httpCategory(response.status), response.status);
        const json: unknown = await response.json();
        if (isSafetyRejection(json)) throw new GoogleTransportError("moderation");
        const parsed = responseSchema.safeParse(json);
        if (!parsed.success) throw new ProviderInputValidationError();
        const candidate = parsed.data.candidates[0]!;
        if (candidate.finishReason !== undefined && candidate.finishReason !== "STOP") throw new ProviderInputValidationError();
        const outputs = candidate.content.parts
          .filter((part) => !part.thought && part.inlineData)
          .map((part) => ({
            mediaType: "image" as const,
            contentType: part.inlineData!.mimeType,
            bytes: decodeBoundedBase64(part.inlineData!.data, GOOGLE_IMAGE_MAX_OUTPUT_BYTES),
          }));
        if (outputs.length !== 1) throw new ProviderInputValidationError();
        return { delivery: "synchronous", providerRequestId: parsed.data.responseId, status: "completed", outputs };
      } catch (error) {
        if (timedOut) throw new GoogleTransportError("timeout");
        if (context.signal?.aborted) throw new GoogleTransportError("cancelled");
        if (error instanceof GoogleTransportError || error instanceof ProviderInputValidationError) throw error;
        if (hasResponseBodyOverflowCause(error) || error instanceof SyntaxError) throw new ProviderInputValidationError();
        throw new GoogleTransportError("provider-unavailable");
      } finally {
        clearTimeout(timer);
        context.signal?.removeEventListener("abort", abort);
      }
    });
  }
  async getGenerationStatus(_id: string, _context: AdapterContext): Promise<GenerationStatusResult> {
    return this.#unsupported("getGenerationStatus");
  }
  async cancelGeneration(_id: string, _context: AdapterContext): Promise<never> {
    return this.#unsupported("cancelGeneration");
  }
  async normalizeOutput(_status: GenerationStatusResult, _context: AdapterContext): Promise<ProviderOutput> {
    return this.#unsupported("normalizeOutput");
  }
  normalizeError(error: unknown, correlationId: string): NormalizedErrorResult {
    const category =
      error instanceof GoogleTransportError
        ? error.category
        : error instanceof ProviderInputValidationError || error instanceof ProviderOperationUnsupportedError
          ? "validation"
          : "unknown";
    const code =
      error instanceof ProviderOperationUnsupportedError ? "operation_unsupported" : `provider_${category.replaceAll("-", "_")}_error`;
    const retryable = ["rate-limit", "provider-unavailable", "timeout"].includes(category);
    const status = error instanceof GoogleTransportError ? error.status : undefined;
    return {
      publicError: { category, code, message: messages[category], retryable, correlationId },
      privateError: privateRedactedError("google", correlationId, this.#now(), {
        namespace: "provider:google",
        providerId: "google",
        redacted: true,
        data: { category, code, ...(status === undefined ? {} : { status }) },
      }),
    };
  }
  async verifyWebhook(_request: WebhookVerificationRequest): Promise<WebhookVerificationResult> {
    return this.#unsupported("verifyWebhook");
  }
  #now() {
    return this.#options.now?.() ?? new Date().toISOString();
  }
}
function assertSupported(modelId: string, task: TaskType, operation: OperationType, revision: string) {
  const model = GOOGLE_IMAGE_MODELS.find((model) => model.id === modelId);
  if (!model?.capabilities?.some((cap) => cap.task === task && cap.operation === operation && cap.schemaRevision === revision))
    throw new ProviderInputValidationError();
  return model;
}
function httpCategory(status: number): Category {
  if (status === 400 || status === 404 || status === 422) return "validation";
  if (status === 401) return "authentication";
  if (status === 403) return "billing-access";
  if (status === 429) return "rate-limit";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "provider-unavailable";
  return "unknown";
}
function isSafetyRejection(value: unknown): boolean {
  const parsed = z
    .object({
      promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
      candidates: z.array(z.object({ finishReason: z.string().optional() })).optional(),
    })
    .safeParse(value);
  const reasons = ["SAFETY", "IMAGE_SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "IMAGE_PROHIBITED_CONTENT"];
  return (
    parsed.success &&
    (reasons.includes(parsed.data.promptFeedback?.blockReason ?? "") ||
      (parsed.data.candidates ?? []).some((c) => reasons.includes(c.finishReason ?? "")))
  );
}
