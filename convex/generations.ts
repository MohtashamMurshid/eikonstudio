import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";

// Cost calculation constants (mirrored from lib/cost-calculator.ts for server-side use)
const COST_FACTORS = {
  basePrice: 0.0025,
  sizeMultiplier: { "1K": 0.8, "2K": 1.0, "4K": 2.0 } as Record<string, number>,
  modeMultiplier: { "text-to-image": 1.0, "image-editing": 1.2 } as Record<string, number>,
};

function calculateCost(imageSize: string = "2K", mode: string = "text-to-image"): number {
  const size = ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "2K";
  const cost = 
    COST_FACTORS.basePrice * 
    (COST_FACTORS.sizeMultiplier[size] || 1.0) * 
    (COST_FACTORS.modeMultiplier[mode] || 1.0);
  return Math.round(cost * 10000) / 10000;
}

// Generate upload URL for uploading images to Convex storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to upload images");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================
// Background Generation System
// ============================================

// Start a new generation - creates a pending record and schedules the background action
export const startGeneration = mutation({
  args: {
    prompt: v.string(),
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    artStyle: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    imageModel: v.union(
      v.literal("gemini-3.1-flash-image-preview"),
      v.literal("gpt-image-2")
    ),
    // Reference image storage IDs for image-editing mode
    referenceImageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to start generation");
    }

    // Create a pending generation record
    const generationId = await ctx.db.insert("generations", {
      userId: user._id,
      prompt: args.prompt,
      mode: args.mode,
      aspectRatio: args.aspectRatio,
      imageSize: args.imageSize,
      artStyle: args.artStyle,
      imageModel: args.imageModel,
      createdAt: Date.now(),
      status: "pending",
      referenceImageIds: args.referenceImageIds,
    });

    // Get URLs for reference images if in image-editing mode
    let referenceImageUrls: string[] | undefined;
    if (args.mode === "image-editing" && args.referenceImageIds && args.referenceImageIds.length > 0) {
      referenceImageUrls = [];
      for (const storageId of args.referenceImageIds) {
        const url = await ctx.storage.getUrl(storageId);
        if (url) {
          referenceImageUrls.push(url);
        }
      }
    }

    // Schedule the background action to run immediately
    await ctx.scheduler.runAfter(0, internal.imageGeneration.generateImageBackground, {
      generationId,
      prompt: args.prompt,
      mode: args.mode,
      aspectRatio: args.aspectRatio,
      imageSize: args.imageSize,
      artStyle: args.artStyle,
      apiKey: args.apiKey,
      imageModel: args.imageModel,
      referenceImageUrls,
      userId: user._id, // Pass userId for looking up custom skills
    });

    return generationId;
  },
});

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
    await ctx.db.patch(args.generationId, {
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
    await ctx.db.patch(args.generationId, {
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
    await ctx.db.patch(args.generationId, {
      status: "failed",
      errorMessage: args.errorMessage,
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
      throw new Error("Must be authenticated to save generations");
    }

    // Calculate cost if not provided
    const estimatedCost = args.estimatedCost ?? calculateCost(args.imageSize, args.mode);

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
      model: args.model ?? "gemini-3.1-flash-image-preview",
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
      .withIndex("by_user", (q) => q.eq("userId", user._id))
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
      throw new Error("Must be authenticated to delete generations");
    }

    const generation = await ctx.db.get(args.generationId);
    if (!generation) {
      throw new Error("Generation not found");
    }

    if (generation.userId !== user._id) {
      throw new Error("Cannot delete another user's generation");
    }

    // Delete the files from storage (if they exist)
    if (generation.imageStorageId) {
      await ctx.storage.delete(generation.imageStorageId);
    }
    if (generation.thumbnailStorageId) {
      await ctx.storage.delete(generation.thumbnailStorageId);
    }
    // Delete reference images if they exist
    if (generation.referenceImageIds) {
      for (const refId of generation.referenceImageIds) {
        try {
          await ctx.storage.delete(refId);
        } catch (e) {
          // Ignore errors deleting reference images (they might be shared)
        }
      }
    }

    // Delete the database record
    await ctx.db.delete(args.generationId);
    return { success: true };
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
      .withIndex("by_user_created", (q) => 
        q.eq("userId", user._id).gte("createdAt", thisMonthStart)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Query only last month's completed generations using the compound index
    const lastMonthGenerations = await ctx.db
      .query("generations")
      .withIndex("by_user_created", (q) => 
        q.eq("userId", user._id)
          .gte("createdAt", lastMonthStart)
          .lt("createdAt", thisMonthStart)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Query older completed generations (before last month) for totals
    // This is still needed for total count and cost, but we minimize data processed
    const olderGenerations = await ctx.db
      .query("generations")
      .withIndex("by_user_created", (q) => 
        q.eq("userId", user._id).lt("createdAt", lastMonthStart)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Calculate this month stats
    let thisMonthCost = 0;
    let thisMonthTextToImage = 0;
    let thisMonthImageEditing = 0;
    for (const gen of thisMonthGenerations) {
      thisMonthCost += gen.estimatedCost ?? calculateCost(gen.imageSize, gen.mode);
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
      lastMonthCost += gen.estimatedCost ?? calculateCost(gen.imageSize, gen.mode);
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
      olderCost += gen.estimatedCost ?? calculateCost(gen.imageSize, gen.mode);
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
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.and(
          q.gte(q.field("createdAt"), startTime),
          q.eq(q.field("status"), "completed")
        )
      )
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
        dailyData[dateStr].cost += gen.estimatedCost ?? calculateCost(gen.imageSize, gen.mode);
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
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.and(
          q.gte(q.field("createdAt"), twoMonthsAgoStart),
          q.eq(q.field("status"), "completed")
        )
      )
      .collect();

    let thisMonthCount = 0;
    let lastMonthCount = 0;
    let thisMonthCost = 0;
    let lastMonthCost = 0;

    for (const gen of generations) {
      const cost = gen.estimatedCost ?? calculateCost(gen.imageSize, gen.mode);
      
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
      throw new Error("Must be authenticated to backfill costs");
    }

    const generations = await ctx.db
      .query("generations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let updated = 0;
    for (const gen of generations) {
      const updates: Record<string, any> = {};
      
      // Backfill cost if missing
      if (gen.estimatedCost === undefined) {
        updates.estimatedCost = calculateCost(gen.imageSize, gen.mode);
      }
      
      // Backfill model if missing
      if (!gen.model) {
        updates.model = "gemini-3.1-flash-image-preview";
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
