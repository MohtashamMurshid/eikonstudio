import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { createAppError } from "../lib/error-utils";
import { removeDocumentStorageReferences, replaceDocumentStorageReferences } from "./storageReferenceLedger";

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
    await replaceDocumentStorageReferences(ctx, {
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
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    // Get URLs for each video generation's videos and thumbnails
    const videoGenerationsWithUrls = await Promise.all(
      videoGenerations.map(async (gen) => {
        const videoUrl = await ctx.storage.getUrl(gen.videoStorageId);
        const thumbnailUrl = await ctx.storage.getUrl(gen.thumbnailStorageId);

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
      .withIndex("by_user_created", (q) =>
        q.eq("userId", user._id).gte("createdAt", thisMonthStart)
      )
      .collect();

    // Query only last month's video generations using the compound index
    const lastMonthGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_created", (q) =>
        q
          .eq("userId", user._id)
          .gte("createdAt", lastMonthStart)
          .lt("createdAt", thisMonthStart)
      )
      .collect();

    // Query older generations (before last month) for totals
    const olderGenerations = await ctx.db
      .query("videoGenerations")
      .withIndex("by_user_created", (q) =>
        q.eq("userId", user._id).lt("createdAt", lastMonthStart)
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
      .withIndex("by_user", (q) => q.eq("userId", user._id))
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
      .withIndex("by_user", (q) => q.eq("userId", user._id))
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
