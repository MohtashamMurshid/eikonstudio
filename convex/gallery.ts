import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import type { Id } from "./_generated/dataModel";

const MAX_IMAGES_PER_FOLDER = 4;

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

// ==================== FOLDER OPERATIONS ====================

// Create a new folder
export const createFolder = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to create folders");
    }

    // Validate folder name format
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(args.name)) {
      throw new Error("Folder name can only contain letters, numbers, hyphens, and underscores");
    }

    // Check if folder already exists
    const existing = await ctx.db
      .query("folders")
      .withIndex("by_user_name", (q) => 
        q.eq("userId", user._id).eq("name", args.name)
      )
      .first();

    if (existing) {
      throw new Error("A folder with this name already exists");
    }

    const folderId = await ctx.db.insert("folders", {
      userId: user._id,
      name: args.name,
      createdAt: Date.now(),
    });

    return folderId;
  },
});

// Rename a folder
export const renameFolder = mutation({
  args: {
    folderId: v.id("folders"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to rename folders");
    }

    // Validate folder name format
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(args.newName)) {
      throw new Error("Folder name can only contain letters, numbers, hyphens, and underscores");
    }

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (folder.userId !== user._id) {
      throw new Error("Cannot rename another user's folder");
    }

    // Check if new name already exists
    const existing = await ctx.db
      .query("folders")
      .withIndex("by_user_name", (q) => 
        q.eq("userId", user._id).eq("name", args.newName)
      )
      .first();

    if (existing && existing._id !== args.folderId) {
      throw new Error("A folder with this name already exists");
    }

    await ctx.db.patch(args.folderId, { name: args.newName });
    return { success: true };
  },
});

// Delete a folder and all its images
export const deleteFolder = mutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to delete folders");
    }

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (folder.userId !== user._id) {
      throw new Error("Cannot delete another user's folder");
    }

    // Delete all images in the folder
    const images = await ctx.db
      .query("gallery")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    for (const img of images) {
      await ctx.storage.delete(img.imageStorageId);
      await ctx.storage.delete(img.thumbnailStorageId);
      await ctx.db.delete(img._id);
    }

    // Delete the folder
    await ctx.db.delete(args.folderId);
    return { success: true, deletedImages: images.length };
  },
});

// Get all folders for the current user with image counts
export const getMyFolders = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Get image counts for each folder
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const images = await ctx.db
          .query("gallery")
          .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
          .collect();
        return {
          ...folder,
          imageCount: images.length,
          isFull: images.length >= MAX_IMAGES_PER_FOLDER,
        };
      })
    );

    return foldersWithCounts;
  },
});

// Get all images in a folder by folder name (for @folder syntax)
export const getImagesByFolderName = query({
  args: {
    folderName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    // Find the folder
    const folder = await ctx.db
      .query("folders")
      .withIndex("by_user_name", (q) => 
        q.eq("userId", user._id).eq("name", args.folderName)
      )
      .first();

    if (!folder) {
      return [];
    }

    // Get all images in the folder
    const images = await ctx.db
      .query("gallery")
      .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
      .collect();

    // Get URLs for each image
    const imagesWithUrls = await Promise.all(
      images.map(async (img) => {
        const imageUrl = await ctx.storage.getUrl(img.imageStorageId);
        const thumbnailUrl = await ctx.storage.getUrl(img.thumbnailStorageId);
        return {
          ...img,
          imageUrl,
          thumbnailUrl,
          folderName: folder.name,
        };
      })
    );

    return imagesWithUrls;
  },
});

// Move image to a folder
export const moveImageToFolder = mutation({
  args: {
    imageId: v.id("gallery"),
    folderId: v.optional(v.id("folders")), // null to move to root
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to move images");
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    if (image.userId !== user._id) {
      throw new Error("Cannot move another user's image");
    }

    // If moving to a folder, check uniqueness and limit
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }

      if (folder.userId !== user._id) {
        throw new Error("Cannot move to another user's folder");
      }

      // Check folder limit and filename uniqueness
      const existingImages = await ctx.db
        .query("gallery")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
        .collect();

      // Check filename uniqueness in target folder
      const duplicate = existingImages.find(img => img.filename === image.filename && img._id !== args.imageId);
      if (duplicate) {
        throw new Error(`An image named "${image.filename}" already exists in this folder`);
      }

      // Don't count if image is already in this folder
      const otherImages = existingImages.filter(img => img._id !== args.imageId);
      if (otherImages.length >= MAX_IMAGES_PER_FOLDER) {
        throw new Error(`Folder is full (max ${MAX_IMAGES_PER_FOLDER} images)`);
      }
    } else {
      // Moving to root - check filename uniqueness among root images
      const rootImages = await ctx.db
        .query("gallery")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
      
      const duplicate = rootImages.find(img => img.filename === image.filename && img._id !== args.imageId);
      if (duplicate) {
        throw new Error(`An image named "${image.filename}" already exists in uncategorized`);
      }
    }

    await ctx.db.patch(args.imageId, { folderId: args.folderId });
    return { success: true };
  },
});

// ==================== IMAGE OPERATIONS ====================

// Save a new gallery image for the current user (with storage IDs)
export const saveImage = mutation({
  args: {
    filename: v.string(),
    imageStorageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
    folderId: v.optional(v.id("folders")),
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

    // Check if filename already exists in the same folder context
    if (args.folderId) {
      // Validate folder exists and belongs to user
      const folder = await ctx.db.get(args.folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== user._id) {
        throw new Error("Cannot save to another user's folder");
      }

      // Check uniqueness within the target folder and folder limit
      const folderImages = await ctx.db
        .query("gallery")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
        .collect();
      
      const existing = folderImages.find(img => img.filename === args.filename);
      if (existing) {
        throw new Error("An image with this filename already exists in this folder");
      }

      if (folderImages.length >= MAX_IMAGES_PER_FOLDER) {
        throw new Error(`Folder is full (max ${MAX_IMAGES_PER_FOLDER} images)`);
      }
    } else {
      // Check uniqueness among root images (no folder)
      const rootImages = await ctx.db
        .query("gallery")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
      
      const existing = rootImages.find(img => img.filename === args.filename);
      if (existing) {
        throw new Error("An image with this filename already exists");
      }
    }

    const imageId = await ctx.db.insert("gallery", {
      userId: user._id,
      filename: args.filename,
      imageStorageId: args.imageStorageId,
      thumbnailStorageId: args.thumbnailStorageId,
      folderId: args.folderId,
      createdAt: Date.now(),
    });

    return imageId;
  },
});

// Get all gallery images for the current user with URLs
export const getMyImages = query({
  args: {
    limit: v.optional(v.number()),
    folderId: v.optional(v.union(v.id("folders"), v.null())), // null = root only, undefined = all
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const limit = args.limit ?? 100;

    let images;
    if (args.folderId === null) {
      // Get only root images (no folder)
      const allImages = await ctx.db
        .query("gallery")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
      images = allImages.filter(img => !img.folderId).slice(0, limit);
    } else if (args.folderId !== undefined) {
      // Get images in specific folder
      images = await ctx.db
        .query("gallery")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId as Id<"folders">))
        .order("desc")
        .take(limit);
    } else {
      // Get all images
      images = await ctx.db
        .query("gallery")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    }

    // Get folders map for folder names
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const folderMap = new Map(folders.map(f => [f._id, f.name]));

    // Get URLs for each image
    const imagesWithUrls = await Promise.all(
      images.map(async (img) => {
        const imageUrl = await ctx.storage.getUrl(img.imageStorageId);
        const thumbnailUrl = await ctx.storage.getUrl(img.thumbnailStorageId);
        return {
          ...img,
          imageUrl,
          thumbnailUrl,
          folderName: img.folderId ? folderMap.get(img.folderId) : null,
        };
      })
    );

    return imagesWithUrls;
  },
});

// Get a single gallery image by filename (supports folder/filename syntax)
export const getImageByFilename = query({
  args: {
    filename: v.string(), // Can be "filename" or "folder/filename"
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    // Check if filename contains folder path
    const slashIndex = args.filename.indexOf("/");
    let image;
    let folderName: string | null = null;

    if (slashIndex > 0) {
      // Folder/filename format
      folderName = args.filename.slice(0, slashIndex);
      const filename = args.filename.slice(slashIndex + 1);

      // Find the folder
      const folder = await ctx.db
        .query("folders")
        .withIndex("by_user_name", (q) => 
          q.eq("userId", user._id).eq("name", folderName!)
        )
        .first();

      if (!folder) return null;

      // Find image in that folder with matching filename
      const folderImages = await ctx.db
        .query("gallery")
        .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
        .collect();

      image = folderImages.find(img => img.filename === filename);
    } else {
      // Just filename - search by filename
      image = await ctx.db
        .query("gallery")
        .withIndex("by_user_filename", (q) => 
          q.eq("userId", user._id).eq("filename", args.filename)
        )
        .first();

      // If found and has a folder, get folder name
      if (image?.folderId) {
        const folder = await ctx.db.get(image.folderId);
        folderName = folder?.name ?? null;
      }
    }

    if (!image) return null;

    const imageUrl = await ctx.storage.getUrl(image.imageStorageId);
    const thumbnailUrl = await ctx.storage.getUrl(image.thumbnailStorageId);

    return {
      ...image,
      imageUrl,
      thumbnailUrl,
      folderName,
      fullPath: folderName ? `${folderName}/${image.filename}` : image.filename,
    };
  },
});

// Search gallery images and folders (for autocomplete) with URLs
export const searchImages = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return { images: [], folders: [] };
    }

    const limit = args.limit ?? 10;
    const searchLower = args.searchTerm.toLowerCase();

    // Check if searching within a folder (e.g., "folder/")
    const slashIndex = args.searchTerm.indexOf("/");
    
    // Get folders map
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const folderMap = new Map(allFolders.map(f => [f._id, f.name]));

    let filteredImages: any[] = [];
    let filteredFolders: any[] = [];

    if (slashIndex > 0) {
      // Searching within a folder: "folderName/searchTerm"
      const folderName = args.searchTerm.slice(0, slashIndex).toLowerCase();
      const fileSearch = args.searchTerm.slice(slashIndex + 1).toLowerCase();
      
      const targetFolder = allFolders.find(f => f.name.toLowerCase() === folderName);
      if (targetFolder) {
        const folderImages = await ctx.db
          .query("gallery")
          .withIndex("by_folder", (q) => q.eq("folderId", targetFolder._id))
          .collect();
        
        filteredImages = folderImages
          .filter(img => img.filename.toLowerCase().includes(fileSearch))
          .slice(0, limit);
      }
    } else {
      // Search all images and folders
      const allImages = await ctx.db
        .query("gallery")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      // Filter images by filename
      filteredImages = allImages
        .filter((img) => img.filename.toLowerCase().includes(searchLower))
        .slice(0, limit);

      // Filter folders by name
      filteredFolders = allFolders
        .filter((folder) => folder.name.toLowerCase().includes(searchLower))
        .slice(0, limit);
    }

    // Get URLs for filtered images and add folder names
    const imagesWithUrls = await Promise.all(
      filteredImages.map(async (img) => {
        const imageUrl = await ctx.storage.getUrl(img.imageStorageId);
        const thumbnailUrl = await ctx.storage.getUrl(img.thumbnailStorageId);
        const folderName = img.folderId ? folderMap.get(img.folderId) : null;
        return {
          _id: img._id,
          filename: img.filename,
          folderId: img.folderId,
          folderName,
          imageUrl,
          thumbnailUrl,
          // Full reference path for mention
          fullPath: folderName ? `${folderName}/${img.filename}` : img.filename,
        };
      })
    );

    // Get image counts for folders
    const foldersWithCounts = await Promise.all(
      filteredFolders.map(async (folder) => {
        const images = await ctx.db
          .query("gallery")
          .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
          .collect();
        return {
          _id: folder._id,
          name: folder.name,
          imageCount: images.length,
          isFull: images.length >= MAX_IMAGES_PER_FOLDER,
        };
      })
    );

    return { images: imagesWithUrls, folders: foldersWithCounts };
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

    // Check if new filename already exists in the same folder context
    if (image.folderId) {
      // Check uniqueness within the same folder
      const folderImages = await ctx.db
        .query("gallery")
        .withIndex("by_folder", (q) => q.eq("folderId", image.folderId))
        .collect();
      
      const existing = folderImages.find(img => img.filename === args.newFilename && img._id !== args.imageId);
      if (existing) {
        throw new Error("An image with this filename already exists in this folder");
      }
    } else {
      // Check uniqueness among root images
      const rootImages = await ctx.db
        .query("gallery")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
      
      const existing = rootImages.find(img => img.filename === args.newFilename && img._id !== args.imageId);
      if (existing) {
        throw new Error("An image with this filename already exists");
      }
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

    // Delete the files from storage
    await ctx.storage.delete(image.imageStorageId);
    await ctx.storage.delete(image.thumbnailStorageId);

    // Delete the database record
    await ctx.db.delete(args.imageId);
    return { success: true };
  },
});
