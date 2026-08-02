import { z } from "zod";

import { JsonObjectSchema, ModelVariantIdSchema, SchemaRevisionIdSchema } from "./models.js";
import { GenerationStatusSchema, MediaTypeSchema, OperationTypeSchema, ProviderIdSchema, TaskTypeSchema } from "./vocabulary.js";

const boundedText = (max: number) => z.string().min(1).max(max).regex(/\S/, "Must contain a non-whitespace character");
const id = <T extends string>(pattern: RegExp) => z.string().regex(pattern).brand<T>();
const HttpsUrlSchema = z
  .string()
  .url()
  .max(2_048)
  .regex(/^https:\/\//, "Only HTTPS URLs are allowed");

export const GenerationIdSchema = id<"GenerationId">(/^gen_[A-Za-z0-9]{12,64}$/);
export type GenerationId = z.infer<typeof GenerationIdSchema>;
export const GenerationJobIdSchema = id<"GenerationJobId">(/^job_[A-Za-z0-9]{12,64}$/);
export type GenerationJobId = z.infer<typeof GenerationJobIdSchema>;
export const AssetIdSchema = id<"AssetId">(/^asset_[A-Za-z0-9]{12,64}$/);
export type AssetId = z.infer<typeof AssetIdSchema>;
export const GenerationAttemptIdSchema = id<"GenerationAttemptId">(/^attempt_[A-Za-z0-9]{12,64}$/);
export type GenerationAttemptId = z.infer<typeof GenerationAttemptIdSchema>;
export const EventIdSchema = id<"EventId">(/^event_[A-Za-z0-9]{12,64}$/);
export type EventId = z.infer<typeof EventIdSchema>;
export const PricingRuleIdSchema = id<"PricingRuleId">(/^price_[A-Za-z0-9]{8,64}$/);
export type PricingRuleId = z.infer<typeof PricingRuleIdSchema>;
export const PricingRuleVersionSchema = z.string().regex(/^v[0-9]+(?:\.[0-9]+){0,2}$/).brand<"PricingRuleVersion">();
export type PricingRuleVersion = z.infer<typeof PricingRuleVersionSchema>;
export const PricingRuleRevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).brand<"PricingRuleRevision">();
export type PricingRuleRevision = z.infer<typeof PricingRuleRevisionSchema>;
export const CredentialHandleSchema = id<"CredentialHandle">(/^cred_[A-Za-z0-9]{12,64}$/);
export type CredentialHandle = z.infer<typeof CredentialHandleSchema>;
export const WebhookHandleSchema = id<"WebhookHandle">(/^webhook_[A-Za-z0-9]{12,64}$/);
export type WebhookHandle = z.infer<typeof WebhookHandleSchema>;

export const ProviderOptionsEnvelopeSchema = z
  .object({ namespace: z.string().regex(/^provider:(openai|google|bfl|byteplus|kling|xai)$/), providerId: ProviderIdSchema, values: JsonObjectSchema })
  .strict()
  .superRefine((envelope, context) => {
    if (envelope.namespace !== `provider:${envelope.providerId}`) context.addIssue({ code: z.ZodIssueCode.custom, message: "Provider namespace mismatch", path: ["namespace"] });
  });
export type ProviderOptionsEnvelope = z.infer<typeof ProviderOptionsEnvelopeSchema>;

/** Private diagnostics are contract-safe only after the adapter has removed secrets and unsafe payload fields. */
export const RedactedProviderDataSchema = z
  .object({
    namespace: z.string().regex(/^provider:(openai|google|bfl|byteplus|kling|xai)$/),
    providerId: ProviderIdSchema,
    redacted: z.literal(true),
    data: JsonObjectSchema,
  })
  .strict()
  .superRefine((envelope, context) => {
    if (envelope.namespace !== `provider:${envelope.providerId}`) context.addIssue({ code: z.ZodIssueCode.custom, message: "Provider namespace mismatch", path: ["namespace"] });
  });
export type RedactedProviderData = z.infer<typeof RedactedProviderDataSchema>;

export const ApprovedFetchPolicyEvidenceSchema = z
  .object({
    canonicalUrl: HttpsUrlSchema,
    approvedAt: z.string().datetime(),
    policyVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
    resolvedAddresses: z.array(z.string().ip()).min(1).max(16),
    redirectLimit: z.number().int().min(0).max(5),
    maxBytes: z.number().int().positive().max(10_000_000_000),
    allowedContentTypes: z.array(boundedText(128)).min(1).max(32),
  })
  .strict();

const PendingRemoteMediaReferenceSchema = z.object({ kind: z.literal("remote-untrusted"), url: HttpsUrlSchema, validationStatus: z.literal("pending") }).strict();
const RejectedRemoteMediaReferenceSchema = z
  .object({ kind: z.literal("remote-untrusted"), url: HttpsUrlSchema, validationStatus: z.literal("rejected"), rejectionCode: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/) })
  .strict();
const ApprovedRemoteMediaReferenceSchema = z
  .object({ kind: z.literal("remote-untrusted"), url: HttpsUrlSchema, validationStatus: z.literal("approved"), fetchPolicy: ApprovedFetchPolicyEvidenceSchema })
  .strict();
export const RemoteMediaReferenceSchema = z
  .discriminatedUnion("validationStatus", [PendingRemoteMediaReferenceSchema, ApprovedRemoteMediaReferenceSchema, RejectedRemoteMediaReferenceSchema])
  .superRefine((reference, context) => {
    if (reference.validationStatus === "approved" && reference.url !== reference.fetchPolicy.canonicalUrl) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Fetch approval evidence must match the exact URL", path: ["fetchPolicy", "canonicalUrl"] });
    }
  });

export const OwnedEikonMediaReferenceSchema = z
  .object({ kind: z.literal("eikon-storage"), ownerId: boundedText(128), assetId: AssetIdSchema, storageId: boundedText(256) })
  .strict();
export const ProviderTransportMediaReferenceSchema = z
  .object({
    kind: z.literal("provider-transport"),
    providerId: ProviderIdSchema,
    providerRequestId: boundedText(256),
    transportUrl: HttpsUrlSchema,
    expiresAt: z.string().datetime().optional(),
  })
  .strict();
export const MediaReferenceSchema = z.union([OwnedEikonMediaReferenceSchema, ProviderTransportMediaReferenceSchema, RemoteMediaReferenceSchema]);
export type MediaReference = z.infer<typeof MediaReferenceSchema>;

export function isApprovedRemoteMediaReference(reference: MediaReference): reference is z.infer<typeof ApprovedRemoteMediaReferenceSchema> {
  return reference.kind === "remote-untrusted" && reference.validationStatus === "approved";
}

const PendingWebhookTargetSchema = z.object({ kind: z.literal("untrusted-callback"), url: HttpsUrlSchema, validationStatus: z.literal("pending") }).strict();
const RejectedWebhookTargetSchema = z
  .object({ kind: z.literal("untrusted-callback"), url: HttpsUrlSchema, validationStatus: z.literal("rejected"), rejectionCode: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/) })
  .strict();
const ApprovedWebhookTargetSchema = z
  .object({ kind: z.literal("untrusted-callback"), url: HttpsUrlSchema, validationStatus: z.literal("approved"), validationEvidence: ApprovedFetchPolicyEvidenceSchema })
  .strict();
export const WebhookTargetSchema = z
  .discriminatedUnion("validationStatus", [PendingWebhookTargetSchema, ApprovedWebhookTargetSchema, RejectedWebhookTargetSchema])
  .superRefine((target, context) => {
    if (target.validationStatus === "approved" && target.url !== target.validationEvidence.canonicalUrl) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Callback approval evidence must match the exact URL", path: ["validationEvidence", "canonicalUrl"] });
    }
  });
export type WebhookTarget = z.infer<typeof WebhookTargetSchema>;

export const InputAssetSchema = z
  .object({ mediaType: MediaTypeSchema, contentType: boundedText(128), reference: MediaReferenceSchema })
  .strict();
export type InputAsset = z.infer<typeof InputAssetSchema>;

export const NormalizedGenerationInputSchema = z
  .object({
    prompt: boundedText(100_000),
    negativePrompt: z.string().max(100_000).optional(),
    inputAssets: z.array(InputAssetSchema).max(32),
    outputCount: z.number().int().min(1).max(16),
    aspectRatio: z.string().regex(/^\d{1,3}:\d{1,3}$/).optional(),
    resolution: boundedText(64).optional(),
    durationSeconds: z.number().positive().max(3_600).optional(),
    seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    audio: z.boolean().optional(),
  })
  .strict();
export type NormalizedGenerationInput = z.infer<typeof NormalizedGenerationInputSchema>;

export const GenerationRequestSchema = z
  .object({
    modelId: ModelVariantIdSchema,
    task: TaskTypeSchema,
    operation: OperationTypeSchema,
    schemaRevision: SchemaRevisionIdSchema,
    input: NormalizedGenerationInputSchema,
    providerOptions: ProviderOptionsEnvelopeSchema.optional(),
    webhookTarget: WebhookTargetSchema.optional(),
    clientReferenceId: boundedText(256).optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const providerId = request.modelId.split("/")[0];
    if (request.providerOptions && request.providerOptions.providerId !== providerId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Provider options do not match model provider", path: ["providerOptions", "providerId"] });
  });
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;

export const CostQuantitySchema = z
  .object({ name: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/), value: z.string().regex(/^\d+(?:\.\d{1,18})?$/), unit: z.string().regex(/^[a-zA-Z][a-zA-Z0-9._/-]{0,31}$/) })
  .strict();
const CostSnapshotBase = {
  immutable: z.literal(true),
  amount: z.string().regex(/^\d+(?:\.\d{1,18})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  scale: z.number().int().min(0).max(18),
  providerId: ProviderIdSchema,
  nativeModelId: boundedText(256),
  nativeModelVersion: boundedText(128),
  pricingRuleId: PricingRuleIdSchema,
  pricingRuleVersion: PricingRuleVersionSchema,
  pricingRuleRevision: PricingRuleRevisionSchema,
  sourceKind: z.enum(["provider-published", "provider-api", "operator-configured"]),
  sourceUrl: HttpsUrlSchema,
  publishedAt: z.string().datetime(),
  fetchedAt: z.string().datetime(),
  effectiveAt: z.string().datetime(),
  quantities: z.array(CostQuantitySchema).min(1).max(64),
  assumptions: z.array(boundedText(1_000)).max(32),
};
export const SubmittedCostEstimateSchema = z.object({ ...CostSnapshotBase, kind: z.literal("submitted-estimate"), estimatedAt: z.string().datetime() }).strict();
export type SubmittedCostEstimate = Readonly<z.infer<typeof SubmittedCostEstimateSchema>>;
export const ReportedActualCostSnapshotSchema = z
  .object({ ...CostSnapshotBase, kind: z.literal("actual"), source: z.literal("reported"), reportedAt: z.string().datetime() })
  .strict();
export const SyncedActualCostSnapshotSchema = z
  .object({ ...CostSnapshotBase, kind: z.literal("actual"), source: z.literal("synced"), syncedAt: z.string().datetime() })
  .strict();
export const ActualCostSnapshotSchema = z.discriminatedUnion("source", [ReportedActualCostSnapshotSchema, SyncedActualCostSnapshotSchema]);
export type ActualCostSnapshot = Readonly<z.infer<typeof ActualCostSnapshotSchema>>;
export const GenerationCostSnapshotSchema = z.union([
  SubmittedCostEstimateSchema,
  ReportedActualCostSnapshotSchema,
  SyncedActualCostSnapshotSchema,
]);
export type GenerationCostSnapshot = Readonly<z.infer<typeof GenerationCostSnapshotSchema>>;

export const ErrorCategorySchema = z.enum(["authentication", "billing-access", "validation", "rate-limit", "moderation", "provider-unavailable", "timeout", "cancelled", "unknown"]);
/** Safe public error. Native context, stacks, and provider payloads are intentionally impossible here. */
export const PublicGenerationErrorSchema = z
  .object({
    category: ErrorCategorySchema,
    code: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
    message: boundedText(500),
    retryable: z.boolean(),
    correlationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  })
  .strict();
export type PublicGenerationError = z.infer<typeof PublicGenerationErrorSchema>;
/** @deprecated Use PublicGenerationErrorSchema. */
export const NormalizedGenerationErrorSchema = PublicGenerationErrorSchema;
export type NormalizedGenerationError = PublicGenerationError;
export const PrivateNativeErrorEnvelopeSchema = z
  .object({ providerId: ProviderIdSchema, correlationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/), capturedAt: z.string().datetime(), native: RedactedProviderDataSchema })
  .strict()
  .refine((envelope) => envelope.providerId === envelope.native.providerId, {
    message: "Native error provider must match the envelope provider",
    path: ["native", "providerId"],
  });
export type PrivateNativeErrorEnvelope = z.infer<typeof PrivateNativeErrorEnvelopeSchema>;
export const NormalizedErrorResultSchema = z.object({ publicError: PublicGenerationErrorSchema, privateError: PrivateNativeErrorEnvelopeSchema.optional() }).strict();
export type NormalizedErrorResult = z.infer<typeof NormalizedErrorResultSchema>;

export const CredentialMetadataSchema = z
  .object({
    handle: CredentialHandleSchema,
    providerId: ProviderIdSchema,
    health: z.enum(["unknown", "healthy", "invalid", "degraded"]),
    maskedHint: z.string().regex(/^\*{3,}[A-Za-z0-9._-]{0,8}$/).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastValidatedAt: z.string().datetime().optional(),
  })
  .strict();
export type CredentialMetadata = z.infer<typeof CredentialMetadataSchema>;

export const LegacyGenerationProvenanceSchema = z
  .object({
    sourceSystem: z.literal("legacy-eikon"),
    legacyGenerationId: boundedText(128),
    legacyModel: boundedText(256).optional(),
    importedAt: z.string().datetime(),
    migrationVersion: z.string().regex(/^v[0-9]+(?:\.[0-9]+){0,2}$/),
  })
  .strict();
export type LegacyGenerationProvenance = z.infer<typeof LegacyGenerationProvenanceSchema>;

export const AssetSchema = z
  .object({
    id: AssetIdSchema,
    generationId: GenerationIdSchema,
    mediaType: MediaTypeSchema,
    contentType: boundedText(128),
    reference: MediaReferenceSchema,
    byteSize: z.number().int().nonnegative().max(10_000_000_000),
    width: z.number().int().positive().max(100_000).optional(),
    height: z.number().int().positive().max(100_000).optional(),
    durationSeconds: z.number().nonnegative().max(3_600).optional(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    providerSource: RedactedProviderDataSchema.optional(),
  })
  .strict();
export type Asset = z.infer<typeof AssetSchema>;

export const RetryClassSchema = z.enum(["never", "transient", "rate-limit", "provider-outage"]);
export const JobOrchestrationMetadataSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/),
    nativeRequestId: boundedText(256).optional(),
    attemptId: GenerationAttemptIdSchema,
    attemptNumber: z.number().int().positive().max(100),
    retryClass: RetryClassSchema,
    nextPollAt: z.string().datetime().optional(),
    maxAgeSeconds: z.number().int().positive().max(604_800),
  })
  .strict();
export type JobOrchestrationMetadata = z.infer<typeof JobOrchestrationMetadataSchema>;

export const GenerationJobSchema = z
  .object({
    id: GenerationJobIdSchema,
    generationId: GenerationIdSchema,
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    request: GenerationRequestSchema,
    providerId: ProviderIdSchema,
    status: GenerationStatusSchema,
    orchestration: JobOrchestrationMetadataSchema,
    progress: z.number().min(0).max(1).optional(),
    outputs: z.array(AssetSchema).max(16),
    submittedEstimate: SubmittedCostEstimateSchema.optional(),
    actualCost: ActualCostSnapshotSchema.optional(),
    error: PublicGenerationErrorSchema.optional(),
    privateError: PrivateNativeErrorEnvelopeSchema.optional(),
    providerContext: RedactedProviderDataSchema.optional(),
    legacyProvenance: LegacyGenerationProvenanceSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((job, context) => {
    if (job.request.modelId.split("/")[0] !== job.providerId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Job provider does not match model", path: ["providerId"] });
    for (const [path, providerId] of [
      ["submittedEstimate", job.submittedEstimate?.providerId],
      ["actualCost", job.actualCost?.providerId],
      ["privateError", job.privateError?.providerId],
      ["providerContext", job.providerContext?.providerId],
    ] as const) {
      if (providerId && providerId !== job.providerId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Provider-scoped job data does not match the job provider", path: [path, "providerId"] });
    }
    for (const [index, asset] of job.outputs.entries()) {
      if (asset.generationId !== job.generationId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Output asset belongs to a different generation", path: ["outputs", index, "generationId"] });
      }
      if (asset.providerSource && asset.providerSource.providerId !== job.providerId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Asset provider source does not match the job provider", path: ["outputs", index, "providerSource", "providerId"] });
      if (asset.reference.kind === "provider-transport" && asset.reference.providerId !== job.providerId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Asset transport provider does not match the job provider", path: ["outputs", index, "reference", "providerId"] });
    }
    if (job.status === "completed" && job.outputs.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Completed jobs require output assets", path: ["outputs"] });
    if (job.status === "completed" && job.outputs.some((asset) => asset.reference.kind !== "eikon-storage")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Completed jobs require Eikon-durable output assets", path: ["outputs"] });
    }
    if (job.status === "completed" && !job.completedAt) context.addIssue({ code: z.ZodIssueCode.custom, message: "Completed jobs require completedAt", path: ["completedAt"] });
    if (job.status !== "completed" && job.completedAt) context.addIssue({ code: z.ZodIssueCode.custom, message: "Only completed jobs may set completedAt", path: ["completedAt"] });
    if (job.status === "failed" && !job.error) context.addIssue({ code: z.ZodIssueCode.custom, message: "Failed jobs require a public error", path: ["error"] });
  });
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

export const AtomicCreateAndScheduleGenerationSchema = z
  .object({
    generationId: GenerationIdSchema,
    jobId: GenerationJobIdSchema,
    expectedInitialRevision: z.literal(0),
    initialStatus: z.literal("queued"),
    request: GenerationRequestSchema,
    providerId: ProviderIdSchema,
    orchestration: JobOrchestrationMetadataSchema,
    scheduleAt: z.string().datetime(),
    eventId: EventIdSchema,
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((command, context) => {
    if (command.request.modelId.split("/")[0] !== command.providerId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Scheduled provider does not match model", path: ["providerId"] });
    if (Date.parse(command.scheduleAt) < Date.parse(command.createdAt)) context.addIssue({ code: z.ZodIssueCode.custom, message: "scheduleAt cannot precede createdAt", path: ["scheduleAt"] });
  });
export type AtomicCreateAndScheduleGeneration = z.infer<typeof AtomicCreateAndScheduleGenerationSchema>;
export interface AtomicGenerationSchedulerPort {
  createAndSchedule(command: AtomicCreateAndScheduleGeneration): Promise<{ readonly generationId: GenerationId; readonly jobId: GenerationJobId; readonly created: boolean }>;
}

const CompletionIdentityBase = { generationId: GenerationIdSchema, providerId: ProviderIdSchema, providerRequestId: boundedText(256) };
export const CompletionIdentitySchema = z.discriminatedUnion("outputIdentityKind", [
  z.object({ ...CompletionIdentityBase, outputIdentityKind: z.literal("checksum"), outputChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ ...CompletionIdentityBase, outputIdentityKind: z.literal("asset"), assetId: AssetIdSchema }).strict(),
]);
export type CompletionIdentity = z.infer<typeof CompletionIdentitySchema>;
export function completionIdentityKey(identity: CompletionIdentity): string {
  const output = identity.outputIdentityKind === "checksum" ? identity.outputChecksumSha256 : identity.assetId;
  return JSON.stringify([identity.generationId, identity.providerId, identity.providerRequestId, identity.outputIdentityKind, output]);
}
