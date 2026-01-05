import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  generations: defineTable({
    userId: v.string(),
    prompt: v.string(),
    imageStorageId: v.id("_storage"), // Full image in Convex storage
    thumbnailStorageId: v.id("_storage"), // Thumbnail in Convex storage
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    artStyle: v.optional(v.string()),
    createdAt: v.number(),
    // Analytics fields (added for dashboard)
    estimatedCost: v.optional(v.number()), // Cost in USD
    model: v.optional(v.string()), // Model name used for generation
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

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
    encryptedKey: v.string(), // AES-GCM encrypted API key
    iv: v.string(), // Initialization vector for decryption
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
});

