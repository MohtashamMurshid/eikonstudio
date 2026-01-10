import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  generations: defineTable({
    userId: v.string(),
    prompt: v.string(),
    imageStorageId: v.optional(v.id("_storage")), // Full image in Convex storage (optional until completed)
    thumbnailStorageId: v.optional(v.id("_storage")), // Thumbnail in Convex storage (optional until completed)
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    artStyle: v.optional(v.string()),
    createdAt: v.number(),
    // Analytics fields (added for dashboard)
    estimatedCost: v.optional(v.number()), // Cost in USD
    model: v.optional(v.string()), // Model name used for generation
    // Background generation status (optional for backward compatibility with existing records)
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    )),
    errorMessage: v.optional(v.string()), // Error message if generation failed
    // Reference images for image-editing mode (stored as base64 data URLs or storage IDs)
    referenceImageIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status", ["userId", "status"]),

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

  // User custom skills for /skillname slash commands
  skills: defineTable({
    userId: v.string(),
    name: v.string(), // Skill name (lowercase, no spaces)
    description: v.string(), // Short description
    promptText: v.string(), // The prompt text to append
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  // Video generations
  videoGenerations: defineTable({
    userId: v.string(),
    prompt: v.string(),
    videoStorageId: v.id("_storage"), // Full MP4 video in Convex storage
    thumbnailStorageId: v.id("_storage"), // Poster frame (first frame) in Convex storage
    mode: v.union(
      v.literal("text-to-video"),
      v.literal("image-to-video"),
      v.literal("frame-to-video") // First & last frame mode
    ),
    aspectRatio: v.string(), // "16:9" or "9:16"
    resolution: v.string(), // "720p" or "1080p"
    duration: v.optional(v.number()), // Video duration in seconds (typically 8)
    referenceImageStorageIds: v.optional(v.array(v.id("_storage"))), // Up to 3 reference images
    createdAt: v.number(),
    estimatedCost: v.optional(v.number()), // Cost in USD
    model: v.optional(v.string()), // Model name used for generation (e.g., "veo-3.1-generate-preview")
    hasAudio: v.optional(v.boolean()), // Whether the video has audio
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),
});

