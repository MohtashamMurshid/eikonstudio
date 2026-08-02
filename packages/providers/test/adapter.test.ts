import { describe, expect, it } from "vitest";

import {
  AssetSchema,
  CredentialHandleSchema,
  GenerationRequestSchema,
  ModelVariantSchema,
  NormalizedErrorResultSchema,
  RedactedProviderDataSchema,
  SubmittedCostEstimateSchema,
  WebhookHandleSchema,
} from "@eikonstudio/core";
import {
  PROVIDER_ADAPTER_METHODS,
  ProviderTransportCapabilitiesSchema,
  WebhookVerificationRequestSchema,
  WebhookVerificationResultSchema,
  assertProviderAdapter,
  privateRedactedError,
  requireSubmissionCapability,
  safePublicProviderError,
  type AdapterContext,
  type OpaqueCredentialResolver,
  type ProviderAdapter,
  type ProviderCredentialReference,
  type ResolvedCredential,
  type WebhookVerificationRequest,
} from "../src/index.js";

const now = "2026-08-02T12:00:00.000Z";
const redactedContext = {
  namespace: "provider:openai",
  providerId: "openai",
  redacted: true,
  data: { requestId: "req_safe" },
} as const;

const capability = {
  schemaRevision: "schema_image_v1",
  operation: "generate",
  task: "text-to-image",
  inputRoles: [{ role: "prompt", modality: "text", required: true, minCount: 1, maxCount: 1 }],
  outputMedia: "image",
  limits: { maxReferences: 0, maxOutputCount: 4, maxInputBytes: 10_000_000, maxOutputBytes: 50_000_000 },
  execution: { mode: "asynchronous", webhook: "optional", polling: "required", cancellation: "optional" },
  inputSchema: { revision: "schema_image_v1", parameters: [{ name: "prompt", required: true, schema: { type: "string" } }] },
} as const;

const model = ModelVariantSchema.parse({
  id: "openai/gpt-image/gpt-image-2",
  familyId: "gpt-image",
  providerId: "openai",
  providerNative: { modelId: "gpt-image-2", version: "2026-08", endpoint: "/v1/images", capturedAt: now },
  displayName: "GPT Image 2",
  readiness: "ready",
  mediaTypes: ["image"],
  capabilities: [capability],
  preview: false,
  discoveredAt: now,
  updatedAt: now,
});

const request = GenerationRequestSchema.parse({
  modelId: "openai/gpt-image/gpt-image-2",
  task: "text-to-image",
  operation: "generate",
  schemaRevision: "schema_image_v1",
  input: { prompt: "A test", inputAssets: [], outputCount: 1 },
});
const credential = { providerId: "openai", handle: CredentialHandleSchema.parse("cred_123456789012") } as const satisfies ProviderCredentialReference;
const webhookHandle = WebhookHandleSchema.parse("webhook_123456789012");
const context: AdapterContext = { credential, requestId: "eikon_req_123" };

const resolver: OpaqueCredentialResolver = {
  async withResolvedCredential(_handle, operation) {
    return operation({} as ResolvedCredential);
  },
};

const estimate = SubmittedCostEstimateSchema.parse({
  kind: "submitted-estimate",
  immutable: true,
  amount: "0.040000",
  currency: "USD",
  scale: 6,
  providerId: "openai",
  nativeModelId: "gpt-image-2",
  nativeModelVersion: "2026-08",
  pricingRuleId: "price_12345678",
  pricingRuleVersion: "v1",
  pricingRuleRevision: 1,
  sourceKind: "provider-published",
  sourceUrl: "https://provider.test/pricing",
  publishedAt: now,
  fetchedAt: now,
  effectiveAt: now,
  estimatedAt: now,
  quantities: [{ name: "images", value: "1", unit: "output" }],
  assumptions: [],
});

const outputAsset = AssetSchema.parse({
  id: "asset_123456789012",
  generationId: "gen_123456789012",
  mediaType: "image",
  contentType: "image/png",
  reference: { kind: "provider-transport", providerId: "openai", providerRequestId: "req_123", transportUrl: "https://provider.test/result.png", expiresAt: "2026-08-02T13:00:00.000Z" },
  byteSize: 1_024,
  checksumSha256: "a".repeat(64),
});

function verifyFixtureWebhook(input: WebhookVerificationRequest) {
  if (input.rawBody[0] === 0xff) return { outcome: "rejected", reasonCode: "invalid-encoding", correlationId: "corr_encoding_123" } as const;
  if (input.headers["x-replay"]?.includes("true")) return { outcome: "rejected", reasonCode: "replay", correlationId: "corr_replay_1234" } as const;
  if (input.headers["x-stale"]?.includes("true")) return { outcome: "rejected", reasonCode: "stale", correlationId: "corr_stale_12345" } as const;
  return {
    outcome: "verified",
    providerId: "openai",
    eventId: "evt_native_123",
    deliveryId: input.headers["x-delivery-id"]?.[0] ?? "delivery_missing",
    signedAt: now,
    signatureVersion: "v1",
    keyVersion: "key-v2",
    replayToken: "replay_123456",
    providerRequestId: "req_123",
    event: redactedContext,
  } as const;
}

const mockAdapter: ProviderAdapter = {
  providerId: "openai",
  async validateCredentials(reference, opaqueResolver) {
    return opaqueResolver.withResolvedCredential(reference.handle, async () => ({ valid: true, code: "valid", checkedAt: now } as const));
  },
  async discoverModels() {
    return {
      models: [model],
      transport: { submission: "asynchronous", webhook: "optional", polling: "required", cancellation: "optional", webhookSignatureSchemes: ["hmac-sha256"] },
      discoveredAt: now,
      providerContext: redactedContext,
    };
  },
  async getModelSchema(_modelId, task, operation) {
    return { modelId: model.id, capability: requireSubmissionCapability(model, task, operation) };
  },
  async normalizeInput(normalizedRequest, executableCapability) {
    return {
      modelId: normalizedRequest.modelId,
      task: normalizedRequest.task,
      operation: normalizedRequest.operation,
      schemaRevision: executableCapability.schemaRevision,
      native: { namespace: "provider:openai", providerId: "openai", values: { prompt: normalizedRequest.input.prompt } },
    } as const;
  },
  async estimateCost() {
    return { available: true, estimate } as const;
  },
  async submitGeneration() {
    return { providerRequestId: "req_123", status: "processing", providerContext: redactedContext } as const;
  },
  async getGenerationStatus(providerRequestId) {
    return { providerRequestId, status: "processing", progress: 0.5, providerContext: redactedContext } as const;
  },
  async cancelGeneration() {
    return { accepted: true, status: "cancelled", providerContext: redactedContext } as const;
  },
  async normalizeOutput() {
    return { assets: [outputAsset], providerContext: redactedContext };
  },
  normalizeError(_error, correlationId) {
    return {
      publicError: safePublicProviderError(correlationId),
      privateError: privateRedactedError("openai", correlationId, now, { ...redactedContext, data: { nativeCode: "internal_error" } }),
    };
  },
  async verifyWebhook(webhookRequest) {
    return verifyFixtureWebhook(webhookRequest);
  },
};

describe("ProviderAdapter architecture and security contract", () => {
  it("requires all eleven PRD methods while exposing focused operation contracts", () => {
    expect(PROVIDER_ADAPTER_METHODS).toHaveLength(11);
    expect(() => assertProviderAdapter(mockAdapter)).not.toThrow();
    expect(() => assertProviderAdapter({ ...mockAdapter, cancelGeneration: undefined })).toThrow("cancelGeneration");
    expect(() => assertProviderAdapter({ ...mockAdapter, providerId: "fal" })).toThrow("providerId");
    expect(() => assertProviderAdapter({ ...mockAdapter, providerId: 123 })).toThrow("providerId");
  });

  it("uses only opaque credential handles and resolves inside trusted validation", async () => {
    const validation = await mockAdapter.validateCredentials(credential, resolver);
    expect(validation).toEqual({ valid: true, code: "valid", checkedAt: now });
    expect(JSON.stringify({ credential, context, validation })).not.toMatch(/apiKey|token|plaintext|secret/i);
  });

  it("fails submission closed for non-executable discovery records", () => {
    const discoveredOnly = ModelVariantSchema.parse({ ...model, readiness: "discovered", capabilities: undefined });
    expect(() => requireSubmissionCapability(discoveredOnly, "text-to-image", "generate")).toThrow(/not executable/);
  });

  it("executes the operation-specific mock boundary", async () => {
    const discovered = await mockAdapter.discoverModels(context);
    const executable = requireSubmissionCapability(model, "text-to-image", "generate");
    const input = await mockAdapter.normalizeInput(request, executable);
    const cost = await mockAdapter.estimateCost(input, context);
    const submission = await mockAdapter.submitGeneration(input, context);
    const status = await mockAdapter.getGenerationStatus(submission.providerRequestId, context);
    const output = await mockAdapter.normalizeOutput(status, context);

    expect(ProviderTransportCapabilitiesSchema.safeParse(discovered.transport).success).toBe(true);
    expect(discovered.transport.polling).toBe("required");
    expect(input.task).toBe("text-to-image");
    expect(cost.available && cost.estimate.amount).toBe("0.040000");
    expect(status.progress).toBe(0.5);
    expect(output.assets[0]?.reference.kind).toBe("provider-transport");
    expect(RedactedProviderDataSchema.safeParse(status.providerContext).success).toBe(true);
  });

  it("never copies arbitrary Error message or stack into the public/private contract fixture", () => {
    const nativeError = new Error("sk-live-super-secret");
    nativeError.stack = "private stack with bearer-token";
    const normalized = mockAdapter.normalizeError(nativeError, "corr_12345678");
    expect(NormalizedErrorResultSchema.safeParse(normalized).success).toBe(true);
    expect(JSON.stringify(normalized)).not.toContain("sk-live-super-secret");
    expect(JSON.stringify(normalized)).not.toContain("bearer-token");
    expect(normalized.publicError).not.toHaveProperty("providerContext");
    expect(() => privateRedactedError("google", "corr_private_123", now, redactedContext)).toThrow("provider");
  });

  it("preserves raw bytes and normalized multi-value headers for verified webhooks", async () => {
    const rawBody = new Uint8Array([0x7b, 0x7d]);
    const webhookRequest = WebhookVerificationRequestSchema.parse({
      rawBody,
      headers: { "x-signature": ["v1=one", "v1=two"], "x-delivery-id": ["delivery_123"] },
      method: "POST",
      path: "/webhooks/openai",
      rawQuery: "attempt=1&attempt=2",
      receivedAt: now,
      webhookHandle,
      credential,
    });
    expect(WebhookVerificationRequestSchema.safeParse({ ...webhookRequest, rawBody: "{}" }).success).toBe(false);
    expect(WebhookVerificationRequestSchema.safeParse({ ...webhookRequest, headers: { "X-Signature": ["v1=one"] } }).success).toBe(false);
    expect(WebhookVerificationRequestSchema.safeParse({ ...webhookRequest, headers: { "x signature": ["v1=one"] } }).success).toBe(false);
    const result = await mockAdapter.verifyWebhook(webhookRequest);
    expect(WebhookVerificationResultSchema.safeParse(result).success).toBe(true);
    expect(rawBody).toEqual(new Uint8Array([0x7b, 0x7d]));
    expect(result.outcome).toBe("verified");
    if (result.outcome === "verified") expect(result).toMatchObject({ deliveryId: "delivery_123", signatureVersion: "v1", keyVersion: "key-v2" });
  });

  it.each([
    ["stale", { "x-stale": ["true"] }, new Uint8Array([0x7b])],
    ["replay", { "x-replay": ["true"] }, new Uint8Array([0x7b])],
    ["invalid-encoding", {}, new Uint8Array([0xff])],
  ] as const)("returns a secret-free %s rejection shape", async (reasonCode, headers, rawBody) => {
    const result = await mockAdapter.verifyWebhook({ rawBody, headers, method: "POST", path: "/webhooks/openai", rawQuery: "", receivedAt: now, webhookHandle, credential });
    expect(WebhookVerificationResultSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ outcome: "rejected", reasonCode });
    expect(result).not.toHaveProperty("event");
    expect(JSON.stringify(result)).not.toMatch(/signature|secret|token/i);
  });
});
