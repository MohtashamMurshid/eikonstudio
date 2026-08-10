import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { createAppError } from "../lib/error-utils";
import { estimateImageGenerationCost, resolveStoredImageModel } from "../lib/image-costs";
import { LEGACY_IMAGE_MODEL_GEMINI_PREVIEW, IMAGE_MODEL_GPT_IMAGE_2, imageModelValidator } from "./imageModels";
import { getProviderCredentialRecord } from "./apiKeys";
import { credentialHealth, legacyCredentialHandle, recordCanonicalProvider } from "./credentialPolicy";
import { createDurableJobRecords } from "./durableJobs";
import { durableImageKeys, REQUEST_IDEMPOTENCY_KEY_PATTERN } from "./durableExecutionPolicy";

// Generate upload URL for uploading images to Convex storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to upload reference images"),
      );
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================
// Background Generation System
// ============================================

// Start a new generation. The browser submits request metadata only; the
// authenticated credential handle is bound transactionally before scheduling.
export const startGeneration = mutation({
  args: {
    idempotencyKey: v.string(),
    prompt: v.string(),
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    imageModel: imageModelValidator,
    referenceImageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(createAppError("UNAUTHENTICATED", "Sign in to start a generation"));
    }
    if (!args.prompt.trim()) {
      throw new ConvexError(createAppError("VALIDATION_ERROR", "Prompt cannot be empty"));
    }
    if (args.mode === "image-editing" && (!args.referenceImageIds || args.referenceImageIds.length === 0)) {
      throw new ConvexError(createAppError("VALIDATION_ERROR", "Add at least one reference image for image editing"));
    }
    if (!REQUEST_IDEMPOTENCY_KEY_PATTERN.test(args.idempotencyKey)) {
      throw new ConvexError(createAppError("VALIDATION_ERROR", "Generation request identity is invalid"));
    }

    const existing = await ctx.db
      .query("generations")
      .withIndex("by_user_idempotency", (q) => q.eq("userId", user._id).eq("requestIdempotencyKey", args.idempotencyKey))
      .unique();
    if (existing) {
      if (existing.tombstonedAt !== undefined) {
        throw new ConvexError(createAppError("CONFLICT", "Generation request identity belongs to a deleted generation"));
      }
      const existingReferences = existing.referenceImageIds ?? [];
      const requestedReferences = args.referenceImageIds ?? [];
      const sameReferences =
        existingReferences.length === requestedReferences.length &&
        existingReferences.every((storageId, index) => storageId === requestedReferences[index]);
      if (
        existing.prompt !== args.prompt ||
        existing.mode !== args.mode ||
        existing.aspectRatio !== args.aspectRatio ||
        existing.imageSize !== args.imageSize ||
        existing.imageModel !== args.imageModel ||
        !existing.durableJobId ||
        !existing.durableGenerationKey ||
        !sameReferences
      ) {
        throw new ConvexError(createAppError("CONFLICT", "Generation request identity was reused with different inputs"));
      }
      const jobId = existing.durableJobId;
      await ctx.scheduler.runAt(Date.now(), internal.imageGeneration.generateDurableImageBackground, { jobId });
      return existing._id;
    }

    const expectedProvider = args.imageModel === IMAGE_MODEL_GPT_IMAGE_2 ? "openai" : "google";
    const credential = await getProviderCredentialRecord(ctx, user._id, expectedProvider);
    if (!credential || !["active", "legacy"].includes(credentialHealth(credential))) {
      throw new ConvexError(createAppError("VALIDATION_ERROR", "Configure an active provider credential in Settings"));
    }
    const credentialHandle = credential.credentialHandle ?? legacyCredentialHandle(credential._id);
    if (!credential.credentialHandle) {
      await ctx.db.patch(credential._id, {
        credentialHandle,
        canonicalProvider: expectedProvider,
        health: credential.encryptionVersion === 2 ? "active" : "legacy",
        keyVersion: credential.keyVersion ?? "legacy",
        updatedAt: Date.now(),
      });
    }
    if (recordCanonicalProvider(credential) !== expectedProvider) {
      throw new ConvexError(createAppError("VALIDATION_ERROR", "Provider credential does not match the selected model"));
    }

    const now = Date.now();
    const generationId = await ctx.db.insert("generations", {
      userId: user._id,
      prompt: args.prompt,
      mode: args.mode,
      aspectRatio: args.aspectRatio,
      imageSize: args.imageSize,
      imageModel: args.imageModel,
      credentialHandle,
      credentialProvider: expectedProvider,
      requestIdempotencyKey: args.idempotencyKey,
      createdAt: now,
      status: "pending",
      referenceImageIds: args.referenceImageIds,
    });

    const keys = durableImageKeys(generationId, args.idempotencyKey);
    const durable = await createDurableJobRecords(ctx, {
      ownerId: user._id,
      ...keys,
      idempotencyKey: `image:${args.idempotencyKey}`,
      provider: expectedProvider,
      credentialHandle,
      modelId: args.imageModel,
      requestMetadataJson: JSON.stringify({ kind: "legacy-image-v1", generationId }),
      maxAgeSeconds: 1_800,
      scheduleAt: now,
      occurredAt: now,
    });
    if (!durable.created) {
      throw new ConvexError(createAppError("CONFLICT", "Durable generation identity already exists"));
    }
    await ctx.db.patch(generationId, {
      durableJobId: durable.jobId,
      durableGenerationKey: keys.generationKey,
    });
    const jobId = durable.jobId;
    await ctx.scheduler.runAt(now, internal.imageGeneration.generateDurableImageBackground, { jobId });
    return generationId;
  },
});

export const getGenerationExecutionContext = internalQuery({
  args: {
    generationId: v.id("generations"),
    credentialHandle: v.string(),
    credentialProvider: v.union(v.literal("google"), v.literal("openai")),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId);
    if (
      !generation ||
      generation.tombstonedAt !== undefined ||
      generation.credentialHandle !== args.credentialHandle ||
      generation.credentialProvider !== args.credentialProvider
    ) {
      throw new Error("Generation credential binding is invalid");
    }
    const referenceImageUrls: string[] = [];
    for (const storageId of generation.referenceImageIds ?? []) {
      const url = await ctx.storage.getUrl(storageId);
      if (url) referenceImageUrls.push(url);
    }
    return { ownerId: generation.userId, referenceImageUrls };
  },
});

async function loadWritableGeneration(ctx: MutationCtx, generationId: Id<"generations">) {
  const generation = await ctx.db.get(generationId);
  if (!generation || generation.tombstonedAt !== undefined) {
    throw new Error("Generation is unavailable");
  }
  return generation;
}

// Internal mutation to update generation status
export const updateGenerationStatus = internalMutation({
  args: {
    generationId: v.id("generations"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const generation = await loadWritableGeneration(ctx, args.generationId);
    await ctx.db.patch(generation._id, {
      status: args.status,
    });
  },
});

// Internal mutation to complete a generation with image data
export const completeGeneration = internalMutation({
  args: {
    generationId: v.id("generations"),
    imageStorageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
    estimatedCost: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const generation = await loadWritableGeneration(ctx, args.generationId);
    await ctx.db.patch(generation._id, {
      status: "completed",
      imageStorageId: args.imageStorageId,
      thumbnailStorageId: args.thumbnailStorageId,
      estimatedCost: args.estimatedCost,
      model: args.model,
    });
  },
});

// Internal mutation to mark a generation as failed
export const failGeneration = internalMutation({
  args: {
    generationId: v.id("generations"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const generation = await loadWritableGeneration(ctx, args.generationId);
    await ctx.db.patch(generation._id, {
      status: "failed",
      errorMessage: args.errorMessage,
    });
  },
});

async function loadDurableLegacyBinding(ctx: MutationCtx, jobId: Id<"durableGenerationJobs">) {
  const job = await ctx.db.get(jobId);
  if (!job) throw new Error("Durable generation is unavailable");
  const generation = await ctx.db
    .query("generations")
    .withIndex("by_durable_job", (q) => q.eq("durableJobId", jobId))
    .unique();
  if (!generation || generation.userId !== job.ownerId || generation.durableGenerationKey !== job.generationKey) {
    throw new Error("Durable generation binding is invalid");
  }
  return { job, generation };
}

export const markDurableGenerationGenerating = internalMutation({
  args: { jobId: v.id("durableGenerationJobs") },
  handler: async (ctx, { jobId }) => {
    const { job, generation } = await loadDurableLegacyBinding(ctx, jobId);
    if (generation.tombstonedAt !== undefined) return;
    if (job.status !== "submitting" || job.submissionState !== "in_flight") {
      throw new Error("Durable generation is not submitting");
    }
    if (generation.status !== "completed") {
      await ctx.db.patch(generation._id, { status: "generating", errorMessage: undefined });
    }
  },
});

export const mirrorDurableGenerationFailure = internalMutation({
  args: { jobId: v.id("durableGenerationJobs"), errorMessage: v.string() },
  handler: async (ctx, args) => {
    const { job, generation } = await loadDurableLegacyBinding(ctx, args.jobId);
    if (generation.tombstonedAt !== undefined) return;
    const terminalFailure = job.status === "failed" || job.status === "expired" || job.status === "cancelled";
    const ambiguous = job.status === "submitting" && job.submissionState === "ambiguous";
    if (!terminalFailure && !ambiguous) throw new Error("Durable generation failure is not authoritative");
    if (generation.status !== "completed") {
      await ctx.db.patch(generation._id, { status: "failed", errorMessage: args.errorMessage });
    }
  },
});

export const mirrorDurableGenerationCompleted = internalMutation({
  args: { jobId: v.id("durableGenerationJobs") },
  handler: async (ctx, { jobId }) => {
    const { job, generation } = await loadDurableLegacyBinding(ctx, jobId);
    if (generation.tombstonedAt !== undefined) return;
    if (job.status !== "completed" || !job.finalizedOutputIds || job.finalizedOutputIds.length !== 1) {
      throw new Error("Durable generation is not completed");
    }
    const output = await ctx.db.get(job.finalizedOutputIds[0]);
    if (!output || output.jobId !== jobId || output.ownerId !== job.ownerId || !output.thumbnailStorageId) {
      throw new Error("Durable output binding is invalid");
    }
    await ctx.db.patch(generation._id, {
      status: "completed",
      imageStorageId: output.storageId,
      thumbnailStorageId: output.thumbnailStorageId,
      estimatedCost: estimateImageGenerationCost(generation.imageSize, generation.mode, generation.imageModel ?? generation.model),
      model: generation.imageModel ?? generation.model,
      errorMessage: undefined,
    });
  },
});

// Save a new generation for the current user (with storage IDs)
// This is kept for backward compatibility but new code should use startGeneration
export const saveGeneration = mutation({
  args: {
    prompt: v.string(),
    imageStorageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    artStyle: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to save generations"),
      );
    }

    // Calculate cost if not provided
    const estimatedCost = args.estimatedCost ?? estimateImageGenerationCost(
      args.imageSize,
      args.mode,
      args.model ?? LEGACY_IMAGE_MODEL_GEMINI_PREVIEW,
    );

    const generationId = await ctx.db.insert("generations", {
      userId: user._id,
      prompt: args.prompt,
      imageStorageId: args.imageStorageId,
      thumbnailStorageId: args.thumbnailStorageId,
      mode: args.mode,
      aspectRatio: args.aspectRatio,
      imageSize: args.imageSize,
      artStyle: args.artStyle,
      createdAt: Date.now(),
      estimatedCost,
      model: args.model ?? LEGACY_IMAGE_MODEL_GEMINI_PREVIEW,
      status: "completed", // Legacy saves are already completed
    });

    return generationId;
  },
});

// Get the current user's generation history (newest first) with URLs
export const getMyGenerations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const limit = args.limit ?? 50;

    const generations = await ctx.db
      .query("generations")
      .withIndex("by_user_tombstone_created", (q) =>
        q.eq("userId", user._id).eq("tombstonedAt", undefined)
      )
      .order("desc")
      .take(limit);

    // Get URLs for each generation's images (if they exist)
    const generationsWithUrls = await Promise.all(
      generations.map(async (gen) => {
        // Only get URLs if the storage IDs exist (completed generations)
        let imageUrl: string | null = null;
        let thumbnailUrl: string | null = null;
        
        if (gen.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(gen.imageStorageId);
        }
        if (gen.thumbnailStorageId) {
          thumbnailUrl = await ctx.storage.getUrl(gen.thumbnailStorageId);
        }
        
        return {
          ...gen,
          imageUrl,
          thumbnailUrl,
          // Ensure status exists for backward compatibility
          status: gen.status ?? "completed",
        };
      })
    );

    return generationsWithUrls;
  },
});

// Delete a generation (only if owned by current user)
export const deleteGeneration = mutation({
  args: {
    generationId: v.id("generations"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to delete generations"),
      );
    }

    const generation = await ctx.db.get(args.generationId);
    if (!generation) {
      throw new ConvexError(
        createAppError("NOT_FOUND", "Generation not found"),
      );
    }

    if (generation.userId !== user._id) {
      throw new ConvexError(
        createAppError("FORBIDDEN", "You can only delete your own generations"),
      );
    }

    if (generation.durableJobId) {
      const job = await ctx.db.get(generation.durableJobId);
      if (
        !job ||
        job.ownerId !== user._id ||
        job.generationKey !== generation.durableGenerationKey
      ) {
        throw new ConvexError(createAppError("CONFLICT", "Durable generation binding is invalid"));
      }
      const outputs = await ctx.db
        .query("durableGenerationOutputs")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .take(17);
      if (
        outputs.length > 16 ||
        outputs.some((output) =>
          output.ownerId !== user._id ||
          output.jobId !== job._id ||
          output.jobKey !== job.jobKey ||
          output.generationKey !== job.generationKey
        )
      ) {
        throw new ConvexError(createAppError("CONFLICT", "Durable output binding is invalid"));
      }
      const outputCompletions = await Promise.all(
        outputs.map(async (output) => ({ output, completion: await ctx.db.get(output.completionId) })),
      );
      if (
        outputCompletions.some(({ output, completion }) =>
          !completion ||
          completion.ownerId !== user._id ||
          completion.jobId !== job._id ||
          completion.jobKey !== job.jobKey ||
          completion.generationKey !== job.generationKey ||
          completion.provider !== job.provider ||
          completion.providerRequestId !== job.providerRequestId ||
          (completion.outputIdentityKind === "checksum" && completion.outputIdentity !== output.checksumSha256) ||
          (completion.outputIdentityKind === "asset" && completion.outputIdentity !== output.outputKey)
        )
      ) {
        throw new ConvexError(createAppError("CONFLICT", "Durable output completion binding is invalid"));
      }

      const tombstoneEventId = `generation_tombstone:${generation._id}`;
      const tombstoneEvent = await ctx.db
        .query("durableGenerationEvents")
        .withIndex("by_event_id", (q) => q.eq("eventId", tombstoneEventId))
        .unique();
      if (generation.tombstonedAt !== undefined) {
        if (
          !tombstoneEvent ||
          tombstoneEvent.ownerId !== user._id ||
          tombstoneEvent.jobId !== job._id ||
          tombstoneEvent.jobKey !== job.jobKey ||
          tombstoneEvent.generationKey !== job.generationKey ||
          tombstoneEvent.eventType !== "tombstoned" ||
          tombstoneEvent.eventFingerprint !== generation._id ||
          tombstoneEvent.occurredAt !== generation.tombstonedAt ||
          generation.tombstoneEventId !== tombstoneEventId ||
          generation.tombstoneReason !== "user_deleted_generation" ||
          outputs.some((output) =>
            output.tombstonedAt !== generation.tombstonedAt ||
            output.tombstoneEventId !== tombstoneEventId ||
            output.tombstoneReason !== "user_deleted_generation"
          )
        ) {
          throw new ConvexError(createAppError("CONFLICT", "Durable tombstone replay is inconsistent"));
        }
        return { success: true, replayed: true, tombstoned: true, tombstonedAt: generation.tombstonedAt };
      }
      if (tombstoneEvent || outputs.some((output) => output.tombstonedAt !== undefined)) {
        throw new ConvexError(createAppError("CONFLICT", "Durable tombstone state is inconsistent"));
      }

      const validTerminalAt =
        Number.isSafeInteger(job.terminalAt) &&
        job.terminalAt! >= job.createdAt &&
        job.terminalAt! <= Date.now() + 300_000;
      if (
        !["completed", "failed", "cancelled", "expired"].includes(job.status) ||
        job.submissionState === "ambiguous" ||
        job.cancellationRequested ||
        !validTerminalAt
      ) {
        throw new ConvexError(createAppError("CONFLICT", "Durable generation is not consistently terminal"));
      }
      if (
        job.status === "cancelled" &&
        (
          (job.cancellationOutcome !== "accepted" && job.cancellationOutcome !== "local") ||
          !Number.isSafeInteger(job.cancellationRequestedAt) ||
          !Number.isSafeInteger(job.cancellationObservedAt) ||
          job.cancellationRequestedAt! < job.createdAt ||
          job.cancellationRequestedAt! > job.cancellationObservedAt! ||
          job.cancellationObservedAt !== job.terminalAt
        )
      ) {
        throw new ConvexError(createAppError("CONFLICT", "Durable cancellation is not consistently observed"));
      }

      if (job.status === "completed") {
        const finalized = job.finalizedOutputIds ?? [];
        const outputIds = new Set(outputs.map((output) => output._id));
        if (
          finalized.length < 1 ||
          finalized.length > 16 ||
          new Set(finalized).size !== finalized.length ||
          finalized.some((outputId) => !outputIds.has(outputId))
        ) {
          throw new ConvexError(createAppError("CONFLICT", "Durable finalized output binding is invalid"));
        }
        for (const finalizedOutputId of finalized) {
          const finalizedOutput = outputs.find((output) => output._id === finalizedOutputId);
          if (!finalizedOutput || finalizedOutput.mediaType !== "image" || !finalizedOutput.thumbnailStorageId) {
            throw new ConvexError(createAppError("CONFLICT", "Durable finalized image output is invalid"));
          }
        }
      }

      const tombstonedAt = Date.now();
      await ctx.db.insert("durableGenerationEvents", {
        ownerId: user._id,
        eventId: tombstoneEventId,
        jobId: job._id,
        jobKey: job.jobKey,
        generationKey: job.generationKey,
        eventType: "tombstoned",
        eventFingerprint: generation._id,
        revision: job.revision,
        occurredAt: tombstonedAt,
      });
      for (const output of outputs) {
        await ctx.db.patch(output._id, {
          tombstonedAt,
          tombstoneEventId,
          tombstoneReason: "user_deleted_generation",
        });
      }
      await ctx.db.patch(generation._id, {
        tombstonedAt,
        tombstoneEventId,
        tombstoneReason: "user_deleted_generation",
      });
      return { success: true, replayed: false, tombstoned: true, tombstonedAt };
    }

    // Legacy unlinked rows use row-only deletion until reference-ledger reconciliation is complete.
    // Retain storage until a complete cross-table reference ledger proves it is unreferenced.
    await ctx.db.delete(args.generationId);
    return { success: true, replayed: false, tombstoned: false };
  },
});

// ============================================
// Analytics Queries
// ============================================

// Get usage statistics for the current user
// Uses indexed queries with time-range filters to avoid full table scans
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return {
        totalGenerations: 0,
        totalCost: 0,
        thisMonth: { generations: 0, cost: 0 },
        lastMonth: { generations: 0, cost: 0 },
        textToImage: 0,
        imageEditing: 0,
      };
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    // Query only this month's completed generations using the compound index
    const thisMonthGenerations = await ctx.db
      .query("generations")
      .withIndex("by_user_tombstone_created", (q) =>
        q.eq("userId", user._id).eq("tombstonedAt", undefined).gte("createdAt", thisMonthStart)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Query only last month's completed generations using the compound index
    const lastMonthGenerations = await ctx.db
      .query("generations")
      .withIndex("by_user_tombstone_created", (q) =>
        q.eq("userId", user._id)
          .eq("tombstonedAt", undefined)
          .gte("createdAt", lastMonthStart)
          .lt("createdAt", thisMonthStart)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Query older completed generations (before last month) for totals
    // This is still needed for total count and cost, but we minimize data processed
    const olderGenerations = await ctx.db
      .query("generations")
      .withIndex("by_user_tombstone_created", (q) =>
        q.eq("userId", user._id).eq("tombstonedAt", undefined).lt("createdAt", lastMonthStart)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Calculate this month stats
    let thisMonthCost = 0;
    let thisMonthTextToImage = 0;
    let thisMonthImageEditing = 0;
    for (const gen of thisMonthGenerations) {
      thisMonthCost += gen.estimatedCost ?? estimateImageGenerationCost(
        gen.imageSize,
        gen.mode,
        gen.imageModel ?? gen.model ?? LEGACY_IMAGE_MODEL_GEMINI_PREVIEW,
      );
      if (gen.mode === "text-to-image") {
        thisMonthTextToImage++;
      } else {
        thisMonthImageEditing++;
      }
    }

    // Calculate last month stats
    let lastMonthCost = 0;
    let lastMonthTextToImage = 0;
    let lastMonthImageEditing = 0;
    for (const gen of lastMonthGenerations) {
      lastMonthCost += gen.estimatedCost ?? estimateImageGenerationCost(
        gen.imageSize,
        gen.mode,
        gen.imageModel ?? gen.model ?? LEGACY_IMAGE_MODEL_GEMINI_PREVIEW,
      );
      if (gen.mode === "text-to-image") {
        lastMonthTextToImage++;
      } else {
        lastMonthImageEditing++;
      }
    }

    // Calculate older stats for totals
    let olderCost = 0;
    let olderTextToImage = 0;
    let olderImageEditing = 0;
    for (const gen of olderGenerations) {
      olderCost += gen.estimatedCost ?? estimateImageGenerationCost(
        gen.imageSize,
        gen.mode,
        gen.imageModel ?? gen.model ?? LEGACY_IMAGE_MODEL_GEMINI_PREVIEW,
      );
      if (gen.mode === "text-to-image") {
        olderTextToImage++;
      } else {
        olderImageEditing++;
      }
    }

    const totalGenerations = thisMonthGenerations.length + lastMonthGenerations.length + olderGenerations.length;
    const totalCost = thisMonthCost + lastMonthCost + olderCost;
    const textToImage = thisMonthTextToImage + lastMonthTextToImage + olderTextToImage;
    const imageEditing = thisMonthImageEditing + lastMonthImageEditing + olderImageEditing;

    return {
      totalGenerations,
      totalCost: Math.round(totalCost * 10000) / 10000,
      thisMonth: {
        generations: thisMonthGenerations.length,
        cost: Math.round(thisMonthCost * 10000) / 10000,
      },
      lastMonth: {
        generations: lastMonthGenerations.length,
        cost: Math.round(lastMonthCost * 10000) / 10000,
      },
      textToImage,
      imageEditing,
    };
  },
});

// Get daily usage data for charts
export const getDailyUsage = query({
  args: {
    days: v.optional(v.number()), // Default 30 days
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const days = args.days ?? 30;
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    const generations = await ctx.db
      .query("generations")
      .withIndex("by_user_tombstone_created", (q) =>
        q.eq("userId", user._id).eq("tombstonedAt", undefined).gte("createdAt", startTime)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Group by date
    const dailyData: Record<string, { date: string; count: number; cost: number; textToImage: number; imageEditing: number }> = {};

    // Initialize all days with zero values
    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { date: dateStr, count: 0, cost: 0, textToImage: 0, imageEditing: 0 };
    }

    // Fill in actual data
    for (const gen of generations) {
      const date = new Date(gen.createdAt);
      const dateStr = date.toISOString().split('T')[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].count++;
        dailyData[dateStr].cost += gen.estimatedCost ?? estimateImageGenerationCost(
          gen.imageSize,
          gen.mode,
          gen.imageModel ?? gen.model ?? LEGACY_IMAGE_MODEL_GEMINI_PREVIEW,
        );
        if (gen.mode === "text-to-image") {
          dailyData[dateStr].textToImage++;
        } else {
          dailyData[dateStr].imageEditing++;
        }
      }
    }

    // Convert to array and sort by date
    return Object.values(dailyData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        cost: Math.round(d.cost * 10000) / 10000,
      }));
  },
});

// Get usage trends (percentage changes)
export const getUsageTrends = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return {
        generationsTrend: 0,
        costTrend: 0,
      };
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();

    const generations = await ctx.db
      .query("generations")
      .withIndex("by_user_tombstone_created", (q) =>
        q.eq("userId", user._id).eq("tombstonedAt", undefined).gte("createdAt", twoMonthsAgoStart)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    let thisMonthCount = 0;
    let lastMonthCount = 0;
    let thisMonthCost = 0;
    let lastMonthCost = 0;

    for (const gen of generations) {
      const cost = gen.estimatedCost ?? estimateImageGenerationCost(
        gen.imageSize,
        gen.mode,
        gen.imageModel ?? gen.model ?? LEGACY_IMAGE_MODEL_GEMINI_PREVIEW,
      );
      
      if (gen.createdAt >= thisMonthStart) {
        thisMonthCount++;
        thisMonthCost += cost;
      } else if (gen.createdAt >= lastMonthStart) {
        lastMonthCount++;
        lastMonthCost += cost;
      }
    }

    const generationsTrend = lastMonthCount > 0 
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100 * 10) / 10
      : thisMonthCount > 0 ? 100 : 0;

    const costTrend = lastMonthCost > 0
      ? Math.round(((thisMonthCost - lastMonthCost) / lastMonthCost) * 100 * 10) / 10
      : thisMonthCost > 0 ? 100 : 0;

    return {
      generationsTrend,
      costTrend,
    };
  },
});

// Backfill costs and status for existing generations that don't have the data
export const backfillCosts = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to backfill costs"),
      );
    }

    const generations = await ctx.db
      .query("generations")
      .withIndex("by_user_tombstone_created", (q) =>
        q.eq("userId", user._id).eq("tombstonedAt", undefined)
      )
      .collect();

    let updated = 0;
    for (const gen of generations) {
      const updates: Record<string, any> = {};
      const sourceModel = resolveStoredImageModel(gen.imageModel, gen.model);
      
      // Backfill cost if missing
      if (gen.estimatedCost === undefined) {
        updates.estimatedCost = estimateImageGenerationCost(
          gen.imageSize,
          gen.mode,
          sourceModel,
        );
      }
      
      // Backfill model if missing
      if (!gen.model) {
        updates.model = sourceModel;
      }
      
      // Backfill status if missing (legacy records are completed)
      if (!gen.status) {
        updates.status = "completed";
      }
      
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(gen._id, updates);
        updated++;
      }
    }

    return { success: true, updated };
  },
});
