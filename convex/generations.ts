import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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

// Save a new generation for the current user (with storage IDs)
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
      model: args.model ?? "gemini-3-pro-image-preview",
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

    // Get URLs for each generation's images
    const generationsWithUrls = await Promise.all(
      generations.map(async (gen) => {
        const imageUrl = await ctx.storage.getUrl(gen.imageStorageId);
        const thumbnailUrl = await ctx.storage.getUrl(gen.thumbnailStorageId);
        return {
          ...gen,
          imageUrl,
          thumbnailUrl,
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

    // Delete the files from storage
    await ctx.storage.delete(generation.imageStorageId);
    await ctx.storage.delete(generation.thumbnailStorageId);

    // Delete the database record
    await ctx.db.delete(args.generationId);
    return { success: true };
  },
});

// ============================================
// Analytics Queries
// ============================================

// Get usage statistics for the current user
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

    const allGenerations = await ctx.db
      .query("generations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    let totalCost = 0;
    let thisMonthGenerations = 0;
    let thisMonthCost = 0;
    let lastMonthGenerations = 0;
    let lastMonthCost = 0;
    let textToImage = 0;
    let imageEditing = 0;

    for (const gen of allGenerations) {
      const cost = gen.estimatedCost ?? calculateCost(gen.imageSize, gen.mode);
      totalCost += cost;

      if (gen.mode === "text-to-image") {
        textToImage++;
      } else {
        imageEditing++;
      }

      if (gen.createdAt >= thisMonthStart) {
        thisMonthGenerations++;
        thisMonthCost += cost;
      } else if (gen.createdAt >= lastMonthStart && gen.createdAt < thisMonthStart) {
        lastMonthGenerations++;
        lastMonthCost += cost;
      }
    }

    return {
      totalGenerations: allGenerations.length,
      totalCost: Math.round(totalCost * 10000) / 10000,
      thisMonth: {
        generations: thisMonthGenerations,
        cost: Math.round(thisMonthCost * 10000) / 10000,
      },
      lastMonth: {
        generations: lastMonthGenerations,
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
      .filter((q) => q.gte(q.field("createdAt"), startTime))
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
      .filter((q) => q.gte(q.field("createdAt"), twoMonthsAgoStart))
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

// Backfill costs for existing generations that don't have cost data
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
      .filter((q) => q.eq(q.field("estimatedCost"), undefined))
      .collect();

    let updated = 0;
    for (const gen of generations) {
      const estimatedCost = calculateCost(gen.imageSize, gen.mode);
      await ctx.db.patch(gen._id, {
        estimatedCost,
        model: gen.model ?? "gemini-3-pro-image-preview",
      });
      updated++;
    }

    return { success: true, updated };
  },
});
