import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { storedImageModelValidator } from "./imageModels";

export default defineSchema({
  generations: defineTable({
    userId: v.string(),
    prompt: v.string(),
    imageStorageId: v.optional(v.id("_storage")), // Full image in Convex storage (optional until completed)
    thumbnailStorageId: v.optional(v.id("_storage")), // Thumbnail in Convex storage (optional until completed)
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    artStyle: v.optional(v.string()),
    createdAt: v.number(),
    // Analytics fields (added for dashboard)
    estimatedCost: v.optional(v.number()), // Cost in USD
    model: v.optional(v.string()), // Model name used for generation
    /** User-selected image model for this generation (set when job is created) */
    imageModel: v.optional(storedImageModelValidator),
    /** Credential-boundary v2 fields are additive for legacy rows. */
    credentialHandle: v.optional(v.string()),
    credentialProvider: v.optional(v.union(v.literal("google"), v.literal("openai"))),
    // Background generation status (optional for backward compatibility with existing records)
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    )),
    errorMessage: v.optional(v.string()), // Error message if generation failed
    // Reference images for image-editing mode (stored as base64 data URLs or storage IDs)
    referenceImageIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status", ["userId", "status"]),

  folders: defineTable({
    userId: v.string(),
    name: v.string(), // Folder name for @folder syntax
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  gallery: defineTable({
    userId: v.string(),
    filename: v.string(), // User-defined name for @mention
    imageStorageId: v.id("_storage"), // Full image in Convex storage
    thumbnailStorageId: v.id("_storage"), // Thumbnail in Convex storage
    folderId: v.optional(v.id("folders")), // null = root level
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_filename", ["userId", "filename"])
    .index("by_folder", ["folderId"]),

  // Secure API key storage
  apiKeys: defineTable({
    userId: v.string(),
    /**
     * Legacy fields remain optional during the non-destructive v2 rollout.
     * They are read only by the internal compatibility resolver and are never
     * populated by new writes.
     */
    provider: v.optional(
      v.union(v.literal("gemini"), v.literal("openai"))
    ),
    encryptedKey: v.optional(v.string()),
    iv: v.optional(v.string()),
    /** Stable opaque operation binding and metadata for v2 credentials. */
    credentialHandle: v.optional(v.string()),
    canonicalProvider: v.optional(
      v.union(v.literal("google"), v.literal("openai"))
    ),
    ciphertext: v.optional(v.string()),
    nonce: v.optional(v.string()),
    authTag: v.optional(v.string()),
    encryptionVersion: v.optional(v.number()),
    keyVersion: v.optional(v.string()),
    health: v.optional(v.union(
      v.literal("active"),
      v.literal("legacy"),
      v.literal("disabled"),
      v.literal("invalid")
    )),
    maskedHint: v.optional(v.string()),
    disabledAt: v.optional(v.number()),
    lastValidatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"])
    .index("by_credential_handle", ["credentialHandle"]),

  platformApiKeys: defineTable({
    userId: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_key_hash", ["keyHash"]),

  // User custom skills for /skillname slash commands
  skills: defineTable({
    userId: v.string(),
    name: v.string(), // Skill name (lowercase, no spaces)
    description: v.string(), // Short description
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    promptText: v.optional(v.string()), // Legacy single-block prompt text
    freeformInstructions: v.optional(v.string()),
    sections: v.optional(v.object({
      styleOverview: v.optional(v.string()),
      visualHallmarks: v.optional(v.string()),
      composition: v.optional(v.string()),
      lighting: v.optional(v.string()),
      palette: v.optional(v.string()),
      materialsAndTextures: v.optional(v.string()),
      mustInclude: v.optional(v.string()),
      avoid: v.optional(v.string()),
      negativePrompt: v.optional(v.string()),
    })),
    builtInSkillKey: v.optional(v.string()),
    isBuiltIn: v.optional(v.boolean()),
    isEditable: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  // Soul Cast characters for video studio
  characters: defineTable({
    userId: v.string(),
    name: v.string(),
    genre: v.optional(v.string()),
    archetype: v.optional(v.string()),
    appearance: v.object({
      gender: v.optional(v.string()),
      age: v.optional(v.string()),
      height: v.optional(v.string()),
      eyeColor: v.optional(v.string()),
      hairColor: v.optional(v.string()),
      hairStyle: v.optional(v.string()),
      skinTone: v.optional(v.string()),
      facialHair: v.optional(v.string()),
      build: v.optional(v.string()),
    }),
    outfit: v.optional(v.string()),
    details: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Phase 2 durable orchestration is additive and intentionally disconnected from legacy generations.
  durableGenerationJobs: defineTable({
    ownerId: v.string(),
    jobKey: v.string(),
    generationKey: v.string(),
    idempotencyKey: v.string(),
    requestFingerprint: v.string(),
    provider: v.union(v.literal("openai"), v.literal("google"), v.literal("bfl"), v.literal("byteplus"), v.literal("kling"), v.literal("xai")),
    credentialHandle: v.string(),
    modelId: v.string(),
    requestMetadataJson: v.string(),
    status: v.union(v.literal("queued"), v.literal("submitting"), v.literal("processing"), v.literal("persisting"), v.literal("completed"), v.literal("failed"), v.literal("cancelled"), v.literal("expired")),
    revision: v.number(),
    submissionState: v.union(v.literal("not_started"), v.literal("in_flight"), v.literal("accepted"), v.literal("ambiguous"), v.literal("reconciled")),
    providerRequestId: v.optional(v.string()),
    completionIdentity: v.optional(v.string()),
    cancellationRequested: v.boolean(),
    cancellationRequestedAt: v.optional(v.number()),
    cancellationObservedAt: v.optional(v.number()),
    cancellationOutcome: v.optional(v.union(v.literal("accepted"), v.literal("unsupported"), v.literal("too_late"), v.literal("local"))),
    leaseOwner: v.optional(v.string()),
    leaseToken: v.optional(v.string()),
    leaseEpoch: v.number(),
    leaseExpiresAt: v.optional(v.number()),
    publicErrorCategory: v.optional(v.string()),
    publicErrorCode: v.optional(v.string()),
    publicErrorMessage: v.optional(v.string()),
    publicErrorRetryable: v.optional(v.boolean()),
    publicErrorCorrelationId: v.optional(v.string()),
    maxAgeSeconds: v.number(),
    expiresAt: v.number(),
    finalizedOutputIds: v.optional(v.array(v.id("durableGenerationOutputs"))),
    terminalAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_idempotency", ["ownerId", "idempotencyKey"])
    .index("by_job_key", ["jobKey"])
    .index("by_status", ["status"])
    .index("by_lease_expiry", ["leaseExpiresAt"]),

  durableGenerationAttempts: defineTable({
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    jobKey: v.string(),
    generationKey: v.string(),
    attemptKey: v.string(),
    attemptNumber: v.number(),
    status: v.union(v.literal("queued"), v.literal("submitting"), v.literal("processing"), v.literal("persisting"), v.literal("completed"), v.literal("failed"), v.literal("cancelled"), v.literal("expired")),
    submissionState: v.union(v.literal("not_started"), v.literal("in_flight"), v.literal("accepted"), v.literal("ambiguous"), v.literal("reconciled")),
    providerRequestId: v.optional(v.string()),
    leaseToken: v.optional(v.string()),
    leaseEpoch: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_attempt_key", ["attemptKey"]),

  durableGenerationEvents: defineTable({
    ownerId: v.string(),
    eventId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    jobKey: v.string(),
    generationKey: v.string(),
    eventType: v.union(v.literal("created"), v.literal("claimed"), v.literal("transitioned"), v.literal("submission_accepted"), v.literal("submission_ambiguous"), v.literal("submission_reconciled"), v.literal("cancellation_requested"), v.literal("cancellation_observed"), v.literal("provider_completed"), v.literal("output_persisted"), v.literal("finalized")),
    eventFingerprint: v.string(),
    revision: v.number(),
    occurredAt: v.number(),
    attemptId: v.optional(v.id("durableGenerationAttempts")),
  })
    .index("by_event_id", ["eventId"])
    .index("by_job_revision", ["jobId", "revision"]),

  durableProviderSubmissions: defineTable({
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    generationKey: v.string(),
    credentialHandle: v.string(),
    attemptId: v.id("durableGenerationAttempts"),
    submissionKey: v.string(),
    provider: v.union(v.literal("openai"), v.literal("google"), v.literal("bfl"), v.literal("byteplus"), v.literal("kling"), v.literal("xai")),
    state: v.union(v.literal("accepted"), v.literal("ambiguous"), v.literal("reconciled")),
    providerRequestId: v.optional(v.string()),
    reconciliationOutcome: v.optional(v.union(v.literal("accepted"), v.literal("failed"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_submission_key", ["submissionKey"])
    .index("by_job", ["jobId"])
    .index("by_provider_request", ["provider", "providerRequestId"]),

  durableGenerationOutputs: defineTable({
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    jobKey: v.string(),
    generationKey: v.string(),
    completionId: v.id("durableGenerationCompletions"),
    outputKey: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    contentType: v.string(),
    byteSize: v.number(),
    checksumSha256: v.string(),
    createdAt: v.number(),
  })
    .index("by_output_key", ["outputKey"])
    .index("by_job", ["jobId"])
    .index("by_completion", ["completionId"]),

  durableGenerationCompletions: defineTable({
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    jobKey: v.string(),
    generationKey: v.string(),
    provider: v.union(v.literal("openai"), v.literal("google"), v.literal("bfl"), v.literal("byteplus"), v.literal("kling"), v.literal("xai")),
    providerRequestId: v.string(),
    completionKey: v.string(),
    outputIdentityKind: v.union(v.literal("checksum"), v.literal("asset")),
    outputIdentity: v.string(),
    createdAt: v.number(),
  })
    .index("by_completion_key", ["completionKey"])
    .index("by_job", ["jobId"])
    .index("by_provider_request", ["provider", "providerRequestId"]),

  // Video generations
  videoGenerations: defineTable({
    userId: v.string(),
    prompt: v.string(),
    videoStorageId: v.id("_storage"), // Full MP4 video in Convex storage
    thumbnailStorageId: v.id("_storage"), // Poster frame (first frame) in Convex storage
    mode: v.union(
      v.literal("text-to-video"),
      v.literal("image-to-video"),
      v.literal("frame-to-video") // First & last frame mode
    ),
    aspectRatio: v.string(), // "16:9" or "9:16"
    resolution: v.string(), // "720p" or "1080p"
    duration: v.optional(v.number()), // Video duration in seconds (typically 8)
    referenceImageStorageIds: v.optional(v.array(v.id("_storage"))), // Up to 3 reference images
    createdAt: v.number(),
    estimatedCost: v.optional(v.number()), // Cost in USD
    model: v.optional(v.string()), // Model name used for generation (e.g., "veo-3.1-generate-preview")
    hasAudio: v.optional(v.boolean()), // Whether the video has audio
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),
});

