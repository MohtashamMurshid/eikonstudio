import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Save a new generation for the current user
export const saveGeneration = mutation({
  args: {
    prompt: v.string(),
    imageData: v.string(),
    thumbnailData: v.string(),
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    artStyle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to save generations");
    }

    const generationId = await ctx.db.insert("generations", {
      userId: user._id,
      prompt: args.prompt,
      imageData: args.imageData,
      thumbnailData: args.thumbnailData,
      mode: args.mode,
      aspectRatio: args.aspectRatio,
      imageSize: args.imageSize,
      artStyle: args.artStyle,
      createdAt: Date.now(),
    });

    return generationId;
  },
});

// Get the current user's generation history (newest first)
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

    return generations;
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

    await ctx.db.delete(args.generationId);
    return { success: true };
  },
});

