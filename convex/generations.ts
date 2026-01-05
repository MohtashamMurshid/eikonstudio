import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

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
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to save generations");
    }

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
