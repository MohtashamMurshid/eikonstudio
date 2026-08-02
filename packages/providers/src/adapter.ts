import { z } from "zod";

import {
  CredentialHandleSchema,
  ProviderIdSchema,
  RedactedProviderDataSchema,
  WebhookHandleSchema,
  assertModelVariantExecutable,
  type ActualCostSnapshot,
  type Asset,
  type CredentialHandle,
  type GenerationRequest,
  type GenerationStatus,
  type JsonObject,
  type ModelOperationCapability,
  type ModelVariant,
  type ModelVariantId,
  type NormalizedErrorResult,
  type OperationType,
  type PrivateNativeErrorEnvelope,
  type ProviderId,
  type PublicGenerationError,
  type RedactedProviderData,
  type SubmittedCostEstimate,
  type TaskType,
} from "@eikonstudio/core";

export const ProviderCredentialReferenceSchema = z.object({ providerId: ProviderIdSchema, handle: CredentialHandleSchema }).strict();
export type ProviderCredentialReference = z.infer<typeof ProviderCredentialReferenceSchema>;

/** Nominal server-only credential. It has no public fields or value-returning API. */
declare const resolvedCredentialBrand: unique symbol;
export interface ResolvedCredential {
  readonly [resolvedCredentialBrand]: true;
}

/** Implemented in trusted server infrastructure; plaintext is never represented by adapter DTOs. */
export interface OpaqueCredentialResolver {
  withResolvedCredential<T>(handle: CredentialHandle, operation: (credential: ResolvedCredential) => Promise<T>): Promise<T>;
}

export type CredentialValidationCode =
  | "valid"
  | "invalid"
  | "billing-access"
  | "regional-restriction"
  | "provider-unavailable"
  | "insufficient-permissions";

export type CredentialValidationResult =
  | { readonly valid: true; readonly code: "valid"; readonly checkedAt: string }
  | { readonly valid: false; readonly code: Exclude<CredentialValidationCode, "valid">; readonly safeMessage?: string; readonly checkedAt: string };

export interface AdapterContext {
  readonly credential: ProviderCredentialReference;
  readonly requestId: string;
  readonly signal?: AbortSignal;
}

/** Provider-level delivery transport, intentionally separate from model operation limits. */
export const ProviderTransportCapabilitiesSchema = z
  .object({
    submission: z.enum(["synchronous", "asynchronous", "both"]),
    webhook: z.enum(["unsupported", "optional", "required"]),
    polling: z.enum(["unsupported", "optional", "required"]),
    cancellation: z.enum(["unsupported", "optional", "required"]),
    webhookSignatureSchemes: z.array(z.enum(["hmac-sha256", "ed25519", "rsa-sha256"])).max(3).readonly(),
  })
  .strict();
export type ProviderTransportCapabilities = z.infer<typeof ProviderTransportCapabilitiesSchema>;

export interface ModelDiscoveryResult {
  readonly models: readonly ModelVariant[];
  readonly transport: ProviderTransportCapabilities;
  readonly discoveredAt: string;
  readonly providerContext?: RedactedProviderData;
}

export interface ProviderModelSchema {
  readonly modelId: ModelVariantId;
  readonly capability: ModelOperationCapability;
}

/** Namespaced native operation payload; never contains credentials. */
interface NativeOperationPayload {
  readonly namespace: `provider:${ProviderId}`;
  readonly providerId: ProviderId;
  readonly values: JsonObject;
}

interface ProviderOperationInputBase {
  readonly modelId: ModelVariantId;
  readonly operation: OperationType;
  readonly schemaRevision: ModelOperationCapability["schemaRevision"];
  readonly native: NativeOperationPayload;
}

export type NormalizedProviderInput =
  | (ProviderOperationInputBase & { readonly task: "text-to-image" })
  | (ProviderOperationInputBase & { readonly task: "image-to-image" })
  | (ProviderOperationInputBase & { readonly task: "text-to-video" })
  | (ProviderOperationInputBase & { readonly task: "image-to-video" })
  | (ProviderOperationInputBase & { readonly task: "video-to-video" });

export type CostEstimate =
  | { readonly available: true; readonly estimate: SubmittedCostEstimate }
  | { readonly available: false; readonly reasonCode: "pricing-unavailable" | "unsupported-quantity" | "provider-unavailable" };

export interface SubmissionResult {
  readonly providerRequestId: string;
  readonly status: GenerationStatus;
  readonly providerContext?: RedactedProviderData;
}

export interface GenerationStatusResult {
  readonly providerRequestId: string;
  readonly status: GenerationStatus;
  readonly progress?: number;
  readonly providerContext?: RedactedProviderData;
}

export interface CancellationResult {
  readonly accepted: boolean;
  readonly status: GenerationStatus;
  readonly providerContext?: RedactedProviderData;
}

export interface ProviderOutput {
  readonly assets: readonly Asset[];
  readonly actualCost?: ActualCostSnapshot;
  readonly providerContext?: RedactedProviderData;
}

export const NormalizedWebhookHeadersSchema = z.record(z.array(z.string().max(8_192)).min(1).max(32).readonly()).readonly();
export type NormalizedWebhookHeaders = z.infer<typeof NormalizedWebhookHeadersSchema>;

export const WebhookVerificationRequestSchema = z
  .object({
    rawBody: z.instanceof(Uint8Array),
    headers: NormalizedWebhookHeadersSchema,
    method: z.string().regex(/^[A-Z]{3,12}$/),
    path: z.string().regex(/^\/[\x21-\x7E]{0,2047}$/),
    rawQuery: z.string().max(8_192),
    receivedAt: z.string().datetime(),
    webhookHandle: WebhookHandleSchema,
    credential: ProviderCredentialReferenceSchema,
  })
  .strict();
export type WebhookVerificationRequest = z.infer<typeof WebhookVerificationRequestSchema>;

export const VerifiedWebhookResultSchema = z
  .object({
    outcome: z.literal("verified"),
    providerId: ProviderIdSchema,
    eventId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/),
    deliveryId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/),
    signedAt: z.string().datetime(),
    signatureVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
    keyVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
    replayToken: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/),
    providerRequestId: z.string().min(1).max(256).optional(),
    event: RedactedProviderDataSchema.optional(),
  })
  .strict();
export type VerifiedWebhookResult = z.infer<typeof VerifiedWebhookResultSchema>;

export const RejectedWebhookResultSchema = z
  .object({
    outcome: z.literal("rejected"),
    reasonCode: z.enum(["invalid-signature", "stale", "replay", "invalid-encoding", "malformed", "unknown-key"]),
    correlationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  })
  .strict();
export type RejectedWebhookResult = z.infer<typeof RejectedWebhookResultSchema>;
export const WebhookVerificationResultSchema = z.discriminatedUnion("outcome", [VerifiedWebhookResultSchema, RejectedWebhookResultSchema]);
export type WebhookVerificationResult = z.infer<typeof WebhookVerificationResultSchema>;

export interface CredentialOperations {
  validateCredentials(reference: ProviderCredentialReference, resolver: OpaqueCredentialResolver): Promise<CredentialValidationResult>;
}
export interface CatalogOperations {
  discoverModels(context: AdapterContext): Promise<ModelDiscoveryResult>;
  getModelSchema(modelId: ModelVariantId, task: TaskType, operation: OperationType, context: AdapterContext): Promise<ProviderModelSchema>;
}
export interface InputOperations {
  normalizeInput(request: GenerationRequest, capability: ModelOperationCapability): Promise<NormalizedProviderInput>;
  estimateCost(input: NormalizedProviderInput, context: AdapterContext): Promise<CostEstimate>;
}
export interface ExecutionOperations {
  submitGeneration(input: NormalizedProviderInput, context: AdapterContext): Promise<SubmissionResult>;
  getGenerationStatus(providerRequestId: string, context: AdapterContext): Promise<GenerationStatusResult>;
  cancelGeneration(providerRequestId: string, context: AdapterContext): Promise<CancellationResult>;
}
export interface OutputOperations {
  normalizeOutput(status: GenerationStatusResult, context: AdapterContext): Promise<ProviderOutput>;
  normalizeError(error: unknown, correlationId: string): NormalizedErrorResult;
}
export interface WebhookOperations {
  verifyWebhook(request: WebhookVerificationRequest): Promise<WebhookVerificationResult>;
}

/** Stable eleven-method boundary, factored into focused operation handler contracts. */
export interface ProviderAdapter extends CredentialOperations, CatalogOperations, InputOperations, ExecutionOperations, OutputOperations, WebhookOperations {
  readonly providerId: ProviderId;
}

export const PROVIDER_ADAPTER_METHODS = [
  "validateCredentials",
  "discoverModels",
  "getModelSchema",
  "normalizeInput",
  "estimateCost",
  "submitGeneration",
  "getGenerationStatus",
  "cancelGeneration",
  "normalizeOutput",
  "normalizeError",
  "verifyWebhook",
] as const satisfies readonly (keyof ProviderAdapter)[];

export function assertProviderAdapter(value: unknown): asserts value is ProviderAdapter {
  if (typeof value !== "object" || value === null || !("providerId" in value)) throw new TypeError("Provider adapter must be an object with a providerId");
  if (!ProviderIdSchema.safeParse((value as { providerId: unknown }).providerId).success) throw new TypeError("Provider adapter has an invalid providerId");
  for (const method of PROVIDER_ADAPTER_METHODS) {
    if (typeof (value as Record<string, unknown>)[method] !== "function") throw new TypeError(`Provider adapter is missing method: ${method}`);
  }
}

/** Fail-closed submission helper: discovery metadata alone cannot authorize execution. */
export function requireSubmissionCapability(variant: ModelVariant, task: TaskType, operation: OperationType): ModelOperationCapability {
  return assertModelVariantExecutable(variant, task, operation);
}

export function safePublicProviderError(correlationId: string): PublicGenerationError {
  return {
    category: "unknown",
    code: "provider_error",
    message: "The provider could not complete the request.",
    retryable: false,
    correlationId,
  };
}

export function privateRedactedError(providerId: ProviderId, correlationId: string, capturedAt: string, native: RedactedProviderData): PrivateNativeErrorEnvelope {
  return { providerId, correlationId, capturedAt, native };
}
