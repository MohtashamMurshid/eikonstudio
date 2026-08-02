import { describe, expect, it } from "vitest";

import {
  ActualCostSnapshotSchema,
  AssetIdSchema,
  AtomicCreateAndScheduleGenerationSchema,
  CompletionIdentitySchema,
  CredentialMetadataSchema,
  EventIdSchema,
  GenerationAttemptIdSchema,
  GenerationIdSchema,
  GenerationJobIdSchema,
  GenerationJobSchema,
  GenerationRequestSchema,
  PricingRuleIdSchema,
  PrivateNativeErrorEnvelopeSchema,
  PublicGenerationErrorSchema,
  RedactedProviderDataSchema,
  RemoteMediaReferenceSchema,
  SubmittedCostEstimateSchema,
  completionIdentityKey,
  isApprovedRemoteMediaReference,
} from "../src/index.js";

const request = {
  modelId: "openai/gpt-image/gpt-image-2",
  task: "text-to-image",
  operation: "generate",
  schemaRevision: "schema_image_v1",
  input: { prompt: "A test image", inputAssets: [], outputCount: 1 },
  providerOptions: { namespace: "provider:openai", providerId: "openai", values: { quality: "high" } },
};

const orchestration = {
  idempotencyKey: "idem_123",
  attemptId: "attempt_123456789012",
  attemptNumber: 1,
  retryClass: "transient",
  maxAgeSeconds: 3_600,
};

const costBase = {
  immutable: true,
  amount: "0.040000",
  currency: "USD",
  scale: 6,
  providerId: "openai",
  nativeModelId: "gpt-image-2",
  nativeModelVersion: "2026-08",
  pricingRuleId: "price_12345678",
  pricingRuleVersion: "v1.2",
  pricingRuleRevision: 3,
  sourceKind: "provider-published",
  sourceUrl: "https://provider.test/pricing",
  publishedAt: "2026-08-01T00:00:00.000Z",
  fetchedAt: "2026-08-02T10:00:00.000Z",
  effectiveAt: "2026-08-01T00:00:00.000Z",
  quantities: [{ name: "images", value: "1", unit: "output" }],
  assumptions: ["standard quality"],
} as const;

describe("canonical generation boundary schemas", () => {
  it("brands and rejects malformed stable IDs", () => {
    expect(GenerationIdSchema.safeParse("gen_123456789012").success).toBe(true);
    expect(GenerationJobIdSchema.safeParse("job_123456789012").success).toBe(true);
    expect(GenerationAttemptIdSchema.safeParse("attempt_123456789012").success).toBe(true);
    expect(EventIdSchema.safeParse("event_123456789012").success).toBe(true);
    expect(PricingRuleIdSchema.safeParse("price_12345678").success).toBe(true);
    expect(AssetIdSchema.safeParse("asset_123456789012").success).toBe(true);
    for (const value of ["gen_short", "generation_123456789012", "gen_has-dash-1234"]) expect(GenerationIdSchema.safeParse(value).success).toBe(false);
  });

  it("has no canonical request defaults and rejects cross-provider options", () => {
    expect(GenerationRequestSchema.safeParse({ modelId: request.modelId, input: { prompt: "test" } }).success).toBe(false);
    expect(GenerationRequestSchema.parse(request).input).toEqual({ prompt: "A test image", inputAssets: [], outputCount: 1 });
    expect(GenerationRequestSchema.safeParse({
      ...request,
      providerOptions: { namespace: "provider:google", providerId: "google", values: {} },
    }).success).toBe(false);
  });

  it("keeps public errors safe and private provider diagnostics explicitly redacted", () => {
    const publicError = { category: "rate-limit", code: "rate_limited", message: "Try later", retryable: true, correlationId: "corr_12345678" };
    expect(PublicGenerationErrorSchema.safeParse(publicError).success).toBe(true);
    expect(PublicGenerationErrorSchema.safeParse({ ...publicError, providerContext: {} }).success).toBe(false);
    expect(PublicGenerationErrorSchema.safeParse({ ...publicError, stack: "secret stack" }).success).toBe(false);
    expect(RedactedProviderDataSchema.safeParse({ namespace: "provider:openai", providerId: "openai", redacted: true, data: { requestId: "req_safe" } }).success).toBe(true);
  });

  it("exposes credential metadata only, never recoverable values", () => {
    const metadata = { handle: "cred_123456789012", providerId: "openai", health: "healthy", maskedHint: "****abcd", createdAt: "2026-08-02T12:00:00.000Z", updatedAt: "2026-08-02T12:00:00.000Z" };
    expect(CredentialMetadataSchema.safeParse(metadata).success).toBe(true);
    expect(CredentialMetadataSchema.safeParse({ ...metadata, values: {} }).success).toBe(false);
    expect(Object.keys(metadata)).toEqual(["handle", "providerId", "health", "maskedHint", "createdAt", "updatedAt"]);
  });

  it("does not treat remote media or callback URLs as fetchable before approval", () => {
    const pending = RemoteMediaReferenceSchema.parse({ kind: "remote-untrusted", url: "https://user.test/image.png", validationStatus: "pending" });
    expect(isApprovedRemoteMediaReference(pending)).toBe(false);
    expect(RemoteMediaReferenceSchema.safeParse({ ...pending, validationStatus: "approved" }).success).toBe(false);
    const approved = RemoteMediaReferenceSchema.parse({
      kind: "remote-untrusted",
      url: "https://user.test/image.png",
      validationStatus: "approved",
      fetchPolicy: { canonicalUrl: "https://user.test/image.png", approvedAt: "2026-08-02T12:00:00.000Z", policyVersion: "ssrf-v1", resolvedAddresses: ["203.0.113.10"], redirectLimit: 0, maxBytes: 50_000_000, allowedContentTypes: ["image/png"] },
    });
    expect(isApprovedRemoteMediaReference(approved)).toBe(true);
    expect(RemoteMediaReferenceSchema.safeParse({ ...approved, url: "https://attacker.test/image.png" }).success).toBe(false);
    for (const url of ["http://user.test/image.png", "ftp://user.test/image.png", "file:///etc/passwd"]) {
      expect(RemoteMediaReferenceSchema.safeParse({ kind: "remote-untrusted", url, validationStatus: "pending" }).success).toBe(false);
    }
  });

  it("separates immutable submitted estimates from reported/synced actual costs", () => {
    const estimate = SubmittedCostEstimateSchema.parse({ ...costBase, kind: "submitted-estimate", estimatedAt: "2026-08-02T12:00:00.000Z" });
    const actual = ActualCostSnapshotSchema.parse({ ...costBase, kind: "actual", source: "reported", reportedAt: "2026-08-02T12:02:00.000Z" });
    expect(estimate.kind).toBe("submitted-estimate");
    expect(actual.kind).toBe("actual");
    expect(SubmittedCostEstimateSchema.safeParse(actual).success).toBe(false);
    expect(ActualCostSnapshotSchema.safeParse(estimate).success).toBe(false);
    expect(ActualCostSnapshotSchema.safeParse({ ...costBase, kind: "actual", source: "reported", syncedAt: "2026-08-02T12:03:00.000Z" }).success).toBe(false);
    expect(ActualCostSnapshotSchema.safeParse({ ...costBase, kind: "actual", source: "synced", reportedAt: "2026-08-02T12:03:00.000Z" }).success).toBe(false);
  });

  it("enforces atomic create-and-schedule constraints", () => {
    const command = {
      generationId: "gen_123456789012",
      jobId: "job_123456789012",
      expectedInitialRevision: 0,
      initialStatus: "queued",
      request,
      providerId: "openai",
      orchestration,
      scheduleAt: "2026-08-02T12:00:01.000Z",
      eventId: "event_123456789012",
      createdAt: "2026-08-02T12:00:00.000Z",
    };
    expect(AtomicCreateAndScheduleGenerationSchema.safeParse(command).success).toBe(true);
    expect(AtomicCreateAndScheduleGenerationSchema.safeParse({ ...command, expectedInitialRevision: 1 }).success).toBe(false);
    expect(AtomicCreateAndScheduleGenerationSchema.safeParse({ ...command, initialStatus: "processing" }).success).toBe(false);
    expect(AtomicCreateAndScheduleGenerationSchema.safeParse({ ...command, providerId: "google" }).success).toBe(false);
    expect(AtomicCreateAndScheduleGenerationSchema.safeParse({ ...command, scheduleAt: "2026-08-01T12:00:00.000Z" }).success).toBe(false);
    expect(AtomicCreateAndScheduleGenerationSchema.safeParse({ ...command, orchestration: { ...orchestration, attemptNumber: 0 } }).success).toBe(false);
  });

  it("gives duplicate completions the same idempotent identity", () => {
    const completion = CompletionIdentitySchema.parse({ generationId: "gen_123456789012", providerId: "openai", providerRequestId: "req_123", outputIdentityKind: "checksum", outputChecksumSha256: "a".repeat(64) });
    const keys = new Set([completionIdentityKey(completion), completionIdentityKey({ ...completion })]);
    expect(keys.size).toBe(1);
    const other = CompletionIdentitySchema.parse({ ...completion, outputChecksumSha256: "b".repeat(64) });
    expect(completionIdentityKey(other)).not.toBe(completionIdentityKey(completion));
    const delimited = CompletionIdentitySchema.parse({ ...completion, providerRequestId: "req:tenant:123" });
    expect(delimited.outputIdentityKind).toBe("checksum");
    expect(JSON.parse(completionIdentityKey(delimited))).toEqual([
      delimited.generationId,
      delimited.providerId,
      delimited.providerRequestId,
      delimited.outputIdentityKind,
      "a".repeat(64),
    ]);
  });

  it("requires private native errors to preserve provider ownership", () => {
    const native = RedactedProviderDataSchema.parse({
      namespace: "provider:google",
      providerId: "google",
      redacted: true,
      data: { code: "safe" },
    });
    expect(PrivateNativeErrorEnvelopeSchema.safeParse({
      providerId: "openai",
      correlationId: "corr_12345678",
      capturedAt: "2026-08-02T12:00:00.000Z",
      native,
    }).success).toBe(false);
  });

  it("requires errors for failed jobs and outputs for completed jobs", () => {
    const baseJob = {
      id: "job_123456789012",
      generationId: "gen_123456789012",
      revision: 0,
      request,
      providerId: "openai",
      orchestration,
      outputs: [],
      createdAt: "2026-08-02T12:00:00.000Z",
      updatedAt: "2026-08-02T12:00:00.000Z",
    };
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "failed" }).success).toBe(false);
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "completed" }).success).toBe(false);
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "queued" }).success).toBe(true);
    const foreignAsset = {
      id: "asset_123456789012",
      generationId: "gen_999999999999",
      mediaType: "image",
      contentType: "image/png",
      reference: {
        kind: "provider-transport",
        providerId: "openai",
        providerRequestId: "req_123",
        transportUrl: "https://provider.test/result.png",
      },
      byteSize: 1_024,
      checksumSha256: "a".repeat(64),
    };
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "completed", outputs: [foreignAsset] }).success).toBe(false);
    const ownedAsset = { ...foreignAsset, generationId: baseJob.generationId };
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "completed", outputs: [ownedAsset] }).success).toBe(false);
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "completed", outputs: [ownedAsset], completedAt: "2026-08-02T12:01:00.000Z" }).success).toBe(false);
    const durableAsset = {
      ...ownedAsset,
      reference: { kind: "eikon-storage", ownerId: "user_123", assetId: ownedAsset.id, storageId: "storage_123" },
    };
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "completed", outputs: [durableAsset], completedAt: "2026-08-02T12:01:00.000Z" }).success).toBe(true);
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "queued", completedAt: "2026-08-02T12:01:00.000Z" }).success).toBe(false);
    const wrongProviderEstimate = SubmittedCostEstimateSchema.parse({
      ...costBase,
      providerId: "google",
      kind: "submitted-estimate",
      estimatedAt: "2026-08-02T12:00:00.000Z",
    });
    expect(GenerationJobSchema.safeParse({ ...baseJob, status: "queued", submittedEstimate: wrongProviderEstimate }).success).toBe(false);
  });
});
