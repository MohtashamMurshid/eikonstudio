import { ConvexError, v, type Infer } from "convex/values";
import { mutation, query, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { createDurableJobRecords, canonicalStorageSha256 } from "./durableJobs";
import { getProviderCredentialRecord } from "./apiKeys";
import { credentialHealth, recordCanonicalProvider, toCredentialMetadata } from "./credentialPolicy";
import { REQUEST_IDEMPOTENCY_KEY_PATTERN } from "./durableExecutionPolicy";
import { authComponent } from "./auth";
import { createAppError } from "../lib/error-utils";
import { insertDocumentStorageReferences, removeDocumentStorageReferences } from "./storageReferenceLedger";

// Cost calculation constants (mirrored from lib/video-cost-calculator.ts for server-side use)
const VIDEO_COST_FACTORS = {
  basePrice: 0.10, // Base price per 8-second video in USD
  resolutionMultiplier: { "720p": 1.0, "1080p": 1.5 } as Record<string, number>,
  modeMultiplier: {
    "text-to-video": 1.0,
    "image-to-video": 1.2,
    "frame-to-video": 1.3,
  } as Record<string, number>,
  referenceImageFee: 0.01, // Per reference image (up to 3)
};

function calculateVideoCost(
  resolution: string = "720p",
  mode: string = "text-to-video",
  referenceImageCount: number = 0
): number {
  const res = ["720p", "1080p"].includes(resolution) ? resolution : "720p";
  const cost =
    VIDEO_COST_FACTORS.basePrice *
    (VIDEO_COST_FACTORS.resolutionMultiplier[res] || 1.0) *
    (VIDEO_COST_FACTORS.modeMultiplier[mode] || 1.0) +
    referenceImageCount * VIDEO_COST_FACTORS.referenceImageFee;
  return Math.round(cost * 10000) / 10000;
}

// Generate upload URL for uploading videos to Convex storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to upload videos"),
      );
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Save a new video generation for the current user (with storage IDs)
export const saveVideoGeneration = mutation({
  args: {
    prompt: v.string(),
    videoStorageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
    mode: v.union(
      v.literal("text-to-video"),
      v.literal("image-to-video"),
      v.literal("frame-to-video")
    ),
    aspectRatio: v.string(),
    resolution: v.string(),
    duration: v.optional(v.number()),
    referenceImageStorageIds: v.optional(v.array(v.id("_storage"))),
    estimatedCost: v.optional(v.number()),
    model: v.optional(v.string()),
    hasAudio: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to save video generations"),
      );
    }
    if ((args.referenceImageStorageIds?.length ?? 0) > 3) {
      throw new ConvexError(createAppError("VALIDATION_ERROR", "Video generation supports at most three reference images"));
    }

    // Calculate cost if not provided
    const referenceImageCount = args.referenceImageStorageIds?.length || 0;
    const estimatedCost =
      args.estimatedCost ??
      calculateVideoCost(args.resolution, args.mode, referenceImageCount);

    const videoGenerationId = await ctx.db.insert("videoGenerations", {
      userId: user._id,
      prompt: args.prompt,
      videoStorageId: args.videoStorageId,
      thumbnailStorageId: args.thumbnailStorageId,
      mode: args.mode,
      aspectRatio: args.aspectRatio,
      resolution: args.resolution,
      duration: args.duration,
      referenceImageStorageIds: args.referenceImageStorageIds,
      createdAt: Date.now(),
      estimatedCost,
      model: args.model ?? "veo-3.1-generate-preview",
      hasAudio: args.hasAudio ?? true,
    });
    await insertDocumentStorageReferences(ctx, {
      source: "video_generations",
      documentId: videoGenerationId,
      ownerId: user._id,
      references: [
        { field: "videoStorageId", storageIds: [args.videoStorageId] },
        { field: "thumbnailStorageId", storageIds: [args.thumbnailStorageId] },
        { field: "referenceImageStorageIds", storageIds: args.referenceImageStorageIds },
      ],
    });

    return videoGenerationId;
  },
});

// Get the current user's video generation history (newest first) with URLs
export const getMyVideoGenerations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const limit = args.limit ?? 50;

    const videoGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_version_created", (q) => q.eq("userId", user._id).eq("durableVersion", undefined))
      .order("desc")
      .take(limit);

    // Get URLs for each video generation's videos and thumbnails
    const videoGenerationsWithUrls = await Promise.all(
      videoGenerations.map(async (gen) => {
        const videoUrl = gen.videoStorageId ? await ctx.storage.getUrl(gen.videoStorageId) : null;
        const thumbnailUrl = gen.thumbnailStorageId ? await ctx.storage.getUrl(gen.thumbnailStorageId) : null;

        // Get reference image URLs if they exist
        let referenceImageUrls: (string | null)[] | undefined;
        if (gen.referenceImageStorageIds) {
          referenceImageUrls = await Promise.all(
            gen.referenceImageStorageIds.map((id) => ctx.storage.getUrl(id))
          );
        }

        return {
          ...gen,
          videoUrl,
          thumbnailUrl,
          referenceImageUrls,
        };
      })
    );

    return videoGenerationsWithUrls;
  },
});

// Delete a video generation (only if owned by current user)
export const deleteVideoGeneration = mutation({
  args: {
    videoGenerationId: v.id("videoGenerations"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to delete video generations"),
      );
    }

    const videoGeneration = await ctx.db.get(args.videoGenerationId);
    if (!videoGeneration) {
      throw new ConvexError(
        createAppError("NOT_FOUND", "Video generation not found"),
      );
    }

    if (videoGeneration.userId !== user._id) {
      throw new ConvexError(
        createAppError(
          "FORBIDDEN",
          "You can only delete your own video generations",
        ),
      );
    }

    if (videoGeneration.durableJobId) throw new ConvexError("DURABLE_VIDEO_DELETE_REQUIRES_TOMBSTONE");

    // Retain storage until a complete cross-table reference ledger proves it is unreferenced.
    await removeDocumentStorageReferences(ctx, "video_generations", args.videoGenerationId, user._id);
    await ctx.db.delete(args.videoGenerationId);
    return { success: true };
  },
});

// ============================================
// Analytics Queries
// ============================================

// Get usage statistics for the current user
export const getVideoUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return {
        totalGenerations: 0,
        totalCost: 0,
        thisMonth: { generations: 0, cost: 0 },
        lastMonth: { generations: 0, cost: 0 },
        textToVideo: 0,
        imageToVideo: 0,
        frameToVideo: 0,
      };
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    ).getTime();

    // Query only this month's video generations using the compound index
    const thisMonthGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_version_created", (q) =>
        q.eq("userId", user._id).eq("durableVersion", undefined).gte("createdAt", thisMonthStart)
      )
      .collect();

    // Query only last month's video generations using the compound index
    const lastMonthGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_version_created", (q) =>
        q
          .eq("userId", user._id)
          .eq("durableVersion", undefined)
          .gte("createdAt", lastMonthStart)
          .lt("createdAt", thisMonthStart)
      )
      .collect();

    // Query older generations (before last month) for totals
    const olderGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_version_created", (q) =>
        q.eq("userId", user._id).eq("durableVersion", undefined).lt("createdAt", lastMonthStart)
      )
      .collect();

    // Calculate this month stats
    let thisMonthCost = 0;
    let thisMonthTextToVideo = 0;
    let thisMonthImageToVideo = 0;
    let thisMonthFrameToVideo = 0;
    for (const gen of thisMonthGenerations) {
      const refCount = gen.referenceImageStorageIds?.length || 0;
      thisMonthCost +=
        gen.estimatedCost ?? calculateVideoCost(gen.resolution, gen.mode, refCount);
      if (gen.mode === "text-to-video") {
        thisMonthTextToVideo++;
      } else if (gen.mode === "image-to-video") {
        thisMonthImageToVideo++;
      } else {
        thisMonthFrameToVideo++;
      }
    }

    // Calculate last month stats
    let lastMonthCost = 0;
    let lastMonthTextToVideo = 0;
    let lastMonthImageToVideo = 0;
    let lastMonthFrameToVideo = 0;
    for (const gen of lastMonthGenerations) {
      const refCount = gen.referenceImageStorageIds?.length || 0;
      lastMonthCost +=
        gen.estimatedCost ?? calculateVideoCost(gen.resolution, gen.mode, refCount);
      if (gen.mode === "text-to-video") {
        lastMonthTextToVideo++;
      } else if (gen.mode === "image-to-video") {
        lastMonthImageToVideo++;
      } else {
        lastMonthFrameToVideo++;
      }
    }

    // Calculate older stats for totals
    let olderCost = 0;
    let olderTextToVideo = 0;
    let olderImageToVideo = 0;
    let olderFrameToVideo = 0;
    for (const gen of olderGenerations) {
      const refCount = gen.referenceImageStorageIds?.length || 0;
      olderCost +=
        gen.estimatedCost ?? calculateVideoCost(gen.resolution, gen.mode, refCount);
      if (gen.mode === "text-to-video") {
        olderTextToVideo++;
      } else if (gen.mode === "image-to-video") {
        olderImageToVideo++;
      } else {
        olderFrameToVideo++;
      }
    }

    const totalGenerations =
      thisMonthGenerations.length +
      lastMonthGenerations.length +
      olderGenerations.length;
    const totalCost = thisMonthCost + lastMonthCost + olderCost;
    const textToVideo = thisMonthTextToVideo + lastMonthTextToVideo + olderTextToVideo;
    const imageToVideo =
      thisMonthImageToVideo + lastMonthImageToVideo + olderImageToVideo;
    const frameToVideo =
      thisMonthFrameToVideo + lastMonthFrameToVideo + olderFrameToVideo;

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
      textToVideo,
      imageToVideo,
      frameToVideo,
    };
  },
});

// Get daily video usage data for charts
export const getVideoDailyUsage = query({
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

    const videoGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_version_created", (q) => q.eq("userId", user._id).eq("durableVersion", undefined))
      .filter((q) => q.gte(q.field("createdAt"), startTime))
      .collect();

    // Group by date
    const dailyData: Record<
      string,
      {
        date: string;
        count: number;
        cost: number;
        textToVideo: number;
        imageToVideo: number;
        frameToVideo: number;
      }
    > = {};

    // Initialize all days with zero values
    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dailyData[dateStr] = {
        date: dateStr,
        count: 0,
        cost: 0,
        textToVideo: 0,
        imageToVideo: 0,
        frameToVideo: 0,
      };
    }

    // Fill in actual data
    for (const gen of videoGenerations) {
      const date = new Date(gen.createdAt);
      const dateStr = date.toISOString().split("T")[0];
      if (dailyData[dateStr]) {
        const refCount = gen.referenceImageStorageIds?.length || 0;
        dailyData[dateStr].count++;
        dailyData[dateStr].cost +=
          gen.estimatedCost ?? calculateVideoCost(gen.resolution, gen.mode, refCount);
        if (gen.mode === "text-to-video") {
          dailyData[dateStr].textToVideo++;
        } else if (gen.mode === "image-to-video") {
          dailyData[dateStr].imageToVideo++;
        } else {
          dailyData[dateStr].frameToVideo++;
        }
      }
    }

    // Convert to array and sort by date
    return Object.values(dailyData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        cost: Math.round(d.cost * 10000) / 10000,
      }));
  },
});

// Get video usage trends (percentage changes)
export const getVideoUsageTrends = query({
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
    const lastMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    ).getTime();
    const twoMonthsAgoStart = new Date(
      now.getFullYear(),
      now.getMonth() - 2,
      1
    ).getTime();

    const videoGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_version_created", (q) => q.eq("userId", user._id).eq("durableVersion", undefined))
      .filter((q) => q.gte(q.field("createdAt"), twoMonthsAgoStart))
      .collect();

    let thisMonthCount = 0;
    let lastMonthCount = 0;
    let thisMonthCost = 0;
    let lastMonthCost = 0;

    for (const gen of videoGenerations) {
      const refCount = gen.referenceImageStorageIds?.length || 0;
      const cost =
        gen.estimatedCost ?? calculateVideoCost(gen.resolution, gen.mode, refCount);

      if (gen.createdAt >= thisMonthStart) {
        thisMonthCount++;
        thisMonthCost += cost;
      } else if (gen.createdAt >= lastMonthStart) {
        lastMonthCount++;
        lastMonthCost += cost;
      }
    }

    const generationsTrend =
      lastMonthCount > 0
        ? Math.round(
            ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100 * 10
          ) / 10
        : thisMonthCount > 0
        ? 100
        : 0;

    const costTrend =
      lastMonthCost > 0
        ? Math.round(((thisMonthCost - lastMonthCost) / lastMonthCost) * 100 * 10) /
          10
        : thisMonthCost > 0
        ? 100
        : 0;

    return {
      generationsTrend,
      costTrend,
    };
  },
});


/** Initial durable video slice uses saved gallery frames, never caller-supplied storage ownership. */
const durableVideoArgs = { idempotencyKey: v.string(), prompt: v.string(),
    aspectRatio: v.union(v.literal("16:9"), v.literal("9:16")),
    resolution: v.union(v.literal("720p"), v.literal("1080p")),
    duration: v.union(v.literal(4), v.literal(6), v.literal(8)),
    referenceGalleryIds: v.array(v.id("gallery")) };
async function startVideo(ctx: MutationCtx, args: Infer<ReturnType<typeof videoArgsValidator>>) {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("UNAUTHENTICATED");
    if (!REQUEST_IDEMPOTENCY_KEY_PATTERN.test(args.idempotencyKey) || args.idempotencyKey.length > 200 ||
      !args.prompt.trim() || args.prompt.length > 10000 || args.referenceGalleryIds.length > 2 ||
      ((args.resolution === "1080p" || args.referenceGalleryIds.length === 2) && args.duration !== 8)) {
      throw new ConvexError("INVALID_VIDEO_REQUEST");
    }
    const requestJson = JSON.stringify([args.prompt, args.aspectRatio, args.resolution, args.duration, args.referenceGalleryIds]);
    const existing = await ctx.db.query("videoGenerations").withIndex("by_user_idempotency",
      q => q.eq("userId", user._id).eq("requestIdempotencyKey", args.idempotencyKey)).unique();
    if (existing) {
      if (existing.requestJson !== requestJson || !existing.durableJobId || existing.tombstonedAt !== undefined) {
        throw new ConvexError("IDEMPOTENCY_COLLISION");
      }
      const job = await ctx.db.get(existing.durableJobId);
      if (!job || job.ownerId !== user._id || job.generationKey !== `video-generation:${existing._id}` ||
        job.provider !== "google" || job.modelId !== "veo-3.1-generate-preview" ||
        job.requestMetadataJson !== JSON.stringify({ kind: "durable-video-v1", videoId: existing._id })) {
        throw new ConvexError("VIDEO_BINDING_INVALID");
      }
      return existing.durableJobId;
    }
    const credential = await getProviderCredentialRecord(ctx, user._id, "google");
    if (!credential?.credentialHandle || credentialHealth(credential) !== "active" || recordCanonicalProvider(credential) !== "google") {
      throw new ConvexError("ACTIVE_SAVED_GOOGLE_CREDENTIAL_REQUIRED");
    }
    const references = [];
    for (const id of args.referenceGalleryIds) {
      if (!await verifiedCreatorFrame(ctx, user._id, id)) throw new ConvexError("INVALID_VIDEO_REFERENCE");
      const gallery = await ctx.db.get(id);
      if (!gallery || gallery.userId !== user._id) throw new ConvexError("REFERENCE_NOT_FOUND");
      const metadata = await ctx.db.system.get(gallery.imageStorageId);
      if (!metadata || (metadata.contentType !== undefined && !["image/png", "image/jpeg"].includes(metadata.contentType)) ||
        metadata.size < 1 || metadata.size > 25_000_000) throw new ConvexError("INVALID_VIDEO_REFERENCE");
      references.push(gallery.imageStorageId);
    }
    const now = Date.now();
    const videoId = await ctx.db.insert("videoGenerations", {
      userId: user._id, prompt: args.prompt, aspectRatio: args.aspectRatio, resolution: args.resolution,
      duration: args.duration, mode: references.length === 2 ? "frame-to-video" : references.length ? "image-to-video" : "text-to-video",
      referenceImageStorageIds: references, requestIdempotencyKey: args.idempotencyKey, requestJson,
      model: "veo-3.1-generate-preview", hasAudio: true, createdAt: now, durableVersion: 1,
    });
    await insertDocumentStorageReferences(ctx, { source: "video_generations", documentId: videoId, ownerId: user._id,
      references: [{ field: "videoStorageId", storageIds: [] }, { field: "thumbnailStorageId", storageIds: [] },
        { field: "referenceImageStorageIds", storageIds: references }] });
    const created = await createDurableJobRecords(ctx, {
      ownerId: user._id, jobKey: `video-job:${videoId}`, generationKey: `video-generation:${videoId}`,
      idempotencyKey: `video:${args.idempotencyKey}`, requestFingerprint: `video:${videoId}`,
      provider: "google", credentialHandle: credential.credentialHandle, modelId: "veo-3.1-generate-preview",
      requestMetadataJson: JSON.stringify({ kind: "durable-video-v1", videoId }), maxAgeSeconds: 1800,
      scheduleAt: now, eventId: `video-created:${videoId}`, occurredAt: now,
    });
    await ctx.db.patch(videoId, { durableJobId: created.jobId });
    await ctx.scheduler.runAt(now, internal.imageGeneration.generateDurableVideoBackground, { jobId: created.jobId });
    return created.jobId;
}
function videoArgsValidator() { return v.object(durableVideoArgs); }
export const startDurableVideo = mutation({ args: durableVideoArgs, handler: startVideo });

export const getDurableVideoExecution = internalQuery({
  args: { jobId: v.id("durableGenerationJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    const video = await ctx.db.query("videoGenerations").withIndex("by_durable_job", q => q.eq("durableJobId", jobId)).unique();
    if (!video || video.durableVersion !== 1 || video.userId !== job.ownerId || job.provider !== "google" || job.modelId !== "veo-3.1-generate-preview" ||
      job.generationKey !== `video-generation:${video._id}` ||
      job.requestMetadataJson !== JSON.stringify({ kind: "durable-video-v1", videoId: video._id })) throw new Error("VIDEO_BINDING_INVALID");
    const attempts = await ctx.db.query("durableGenerationAttempts").withIndex("by_job", q => q.eq("jobId", jobId)).take(2);
    const outputs = await ctx.db.query("durableGenerationOutputs").withIndex("by_job", q => q.eq("jobId", jobId)).take(2);
    const completions = await ctx.db.query("durableGenerationCompletions").withIndex("by_job", q => q.eq("jobId", jobId)).take(2);
    if (attempts.length !== 1 || outputs.length > 1 || completions.length > 1 ||
      [...attempts, ...outputs, ...completions].some(row => row.ownerId !== job.ownerId || row.generationKey !== job.generationKey)) {
      throw new Error("VIDEO_BINDING_INVALID");
    }
    return { job, video, attempt: attempts[0], outputs, completions };
  },
});

/** Refresh-safe history exposes only finalized owned storage, never provider transport URLs or handles. */
export const getMyDurableVideos = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const videos = await ctx.db.query("videoGenerations").withIndex("by_user_visible_created",
      q => q.eq("userId", user._id).eq("durableVersion", 1).eq("tombstonedAt", undefined)).order("desc").take(100);
    const result = [];
    for (const video of videos) {
      if (!video.durableJobId) continue;
      const job = await ctx.db.get(video.durableJobId);
      if (!job || job.ownerId !== user._id || job.generationKey !== `video-generation:${video._id}`) throw new Error("VIDEO_BINDING_INVALID");
      const outputId = job.status === "completed" ? job.finalizedOutputIds?.[0] : undefined;
      const output = outputId ? await ctx.db.get(outputId) : null;
      if (output && (output.ownerId !== user._id || output.jobId !== job._id || output.generationKey !== job.generationKey)) throw new Error("VIDEO_BINDING_INVALID");
      result.push({ id: video._id, jobId: job._id, prompt: video.prompt, status: job.status,
        requiresReconciliation: job.submissionState === "ambiguous", error: job.publicErrorMessage ?? null,
        duration: video.duration, resolution: video.resolution, createdAt: video.createdAt,
        videoUrl: output && output.tombstonedAt === undefined ? await ctx.storage.getUrl(output.storageId) : null });
    }
    return result;
  },
});


// Creator-only boundary. Legacy gallery registration is not proof of blob ownership.
async function verifiedCreatorFrame(ctx: QueryCtx, ownerId: string, galleryId: Infer<ReturnType<typeof galleryIdValidator>>) {
  const gallery = await ctx.db.get(galleryId);
  if (!gallery || gallery.userId !== ownerId) return null;
  const outputs = await ctx.db.query("durableGenerationOutputs")
    .withIndex("by_storage", q => q.eq("storageId", gallery.imageStorageId)).take(16);
  for (const output of outputs) {
    if (output.ownerId !== ownerId || output.mediaType !== "image" || output.tombstonedAt !== undefined ||
      !["image/png", "image/jpeg"].includes(output.contentType)) continue;
    const job = await ctx.db.get(output.jobId);
    if (!job || job.ownerId !== ownerId || job.status !== "completed" ||
      job.generationKey !== output.generationKey || !job.finalizedOutputIds?.includes(output._id)) continue;
    const metadata = await ctx.db.system.get(output.storageId);
    if (!metadata || metadata.size < 1 || metadata.size > 25_000_000 || metadata.size !== output.byteSize ||
      canonicalStorageSha256(metadata.sha256) !== output.checksumSha256 || (metadata.contentType !== undefined && metadata.contentType !== output.contentType)) continue;
    return { id: gallery._id, filename: gallery.filename, url: await ctx.storage.getUrl(output.storageId) };
  }
  return null;
}
function galleryIdValidator() { return v.id("gallery"); }

export const startCreatorVideo = mutation({
  args: { ...durableVideoArgs, ownerId: v.string() },
  handler: async (ctx, { ownerId, ...args }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user || user._id !== ownerId) throw new ConvexError("UNAUTHENTICATED");
    // Shared startVideo enforces frame ownership for every public start path.
    // Its exact replay check precedes reference revalidation.
    return startVideo(ctx, args);
  },
});

/** Owner argument fences stale subscriptions and account-switch callbacks. No provider locators. */
export const getVideoCreatorState = query({
  args: { ownerId: v.string(), requestKey: v.optional(v.string()) },
  handler: async (ctx, { ownerId, requestKey }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user || user._id !== ownerId) return null;
    const galleries = await ctx.db.query("gallery").withIndex("by_user", q => q.eq("userId", ownerId)).order("desc").take(100);
    const frames = (await Promise.all(galleries.map(row => verifiedCreatorFrame(ctx, ownerId, row._id)))).filter(row => row !== null);
    const videos = await ctx.db.query("videoGenerations").withIndex("by_user_visible_created",
      q => q.eq("userId", ownerId).eq("durableVersion", 1).eq("tombstonedAt", undefined)).order("desc").take(100);
    const selected = requestKey ? await ctx.db.query("videoGenerations").withIndex("by_user_idempotency",
      q => q.eq("userId", ownerId).eq("requestIdempotencyKey", requestKey)).unique() : null;
    if (selected && !videos.some(row => row._id === selected._id)) videos.unshift(selected);
    const jobs = [];
    for (const video of videos) {
      if (!video.durableJobId || video.tombstonedAt !== undefined) continue;
      const job = await ctx.db.get(video.durableJobId);
      if (!job || job.ownerId !== ownerId || job.generationKey !== `video-generation:${video._id}`) continue;
      const outputId = job.status === "completed" ? job.finalizedOutputIds?.[0] : undefined;
      const output = outputId ? await ctx.db.get(outputId) : null;
      const videoUrl = output && output.ownerId === ownerId && output.jobId === job._id &&
        output.generationKey === job.generationKey && output.mediaType === "video" && output.tombstonedAt === undefined ? await ctx.storage.getUrl(output.storageId) : null;
      jobs.push({ jobId: job._id, requestKey: video.requestIdempotencyKey!, prompt: video.prompt,
        status: job.status, ambiguous: job.submissionState === "ambiguous", videoUrl,
        // Requested settings are not verified output metadata.
        resolution: video.resolution, duration: video.duration });
    }
    const credential = await getProviderCredentialRecord(ctx, ownerId, "google");
    return { ownerId, frames, jobs, credential: credential ? toCredentialMetadata(credential) : null };
  },
});
