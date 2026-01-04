import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Save a new gallery image for the current user
export const saveImage = mutation({
  args: {
    filename: v.string(),
    imageData: v.string(),
    thumbnailData: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to save images");
    }

    // Validate filename format (alphanumeric, hyphens, underscores only)
    const filenameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!filenameRegex.test(args.filename)) {
      throw new Error("Filename can only contain letters, numbers, hyphens, and underscores");
    }

    // Check if filename already exists for this user
    const existing = await ctx.db
      .query("gallery")
      .withIndex("by_user_filename", (q) => 
        q.eq("userId", user._id).eq("filename", args.filename)
      )
      .first();

    if (existing) {
      throw new Error("An image with this filename already exists");
    }

    const imageId = await ctx.db.insert("gallery", {
      userId: user._id,
      filename: args.filename,
      imageData: args.imageData,
      thumbnailData: args.thumbnailData,
      createdAt: Date.now(),
    });

    return imageId;
  },
});

// Get all gallery images for the current user
export const getMyImages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const limit = args.limit ?? 100;

    const images = await ctx.db
      .query("gallery")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return images;
  },
});

// Get a single gallery image by filename
export const getImageByFilename = query({
  args: {
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const image = await ctx.db
      .query("gallery")
      .withIndex("by_user_filename", (q) => 
        q.eq("userId", user._id).eq("filename", args.filename)
      )
      .first();

    return image;
  },
});

// Search gallery images by filename (for autocomplete)
export const searchImages = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const limit = args.limit ?? 10;
    const searchLower = args.searchTerm.toLowerCase();

    // Get all user's images and filter by search term
    const allImages = await ctx.db
      .query("gallery")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by filename containing search term
    const filtered = allImages
      .filter((img) => img.filename.toLowerCase().includes(searchLower))
      .slice(0, limit);

    // Return fields needed for autocomplete and image loading
    return filtered.map((img) => ({
      _id: img._id,
      filename: img.filename,
      thumbnailData: img.thumbnailData,
      imageData: img.imageData,
    }));
  },
});

// Rename a gallery image
export const renameImage = mutation({
  args: {
    imageId: v.id("gallery"),
    newFilename: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to rename images");
    }

    // Validate filename format
    const filenameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!filenameRegex.test(args.newFilename)) {
      throw new Error("Filename can only contain letters, numbers, hyphens, and underscores");
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    if (image.userId !== user._id) {
      throw new Error("Cannot rename another user's image");
    }

    // Check if new filename already exists
    const existing = await ctx.db
      .query("gallery")
      .withIndex("by_user_filename", (q) => 
        q.eq("userId", user._id).eq("filename", args.newFilename)
      )
      .first();

    if (existing && existing._id !== args.imageId) {
      throw new Error("An image with this filename already exists");
    }

    await ctx.db.patch(args.imageId, {
      filename: args.newFilename,
    });

    return { success: true };
  },
});

// Delete a gallery image
export const deleteImage = mutation({
  args: {
    imageId: v.id("gallery"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to delete images");
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    if (image.userId !== user._id) {
      throw new Error("Cannot delete another user's image");
    }

    await ctx.db.delete(args.imageId);
    return { success: true };
  },
});

