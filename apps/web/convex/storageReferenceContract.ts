import { v } from "convex/values";

export const storageReferenceSourceValidator = v.union(
  v.literal("generations"),
  v.literal("gallery"),
  v.literal("characters"),
  v.literal("durable_outputs"),
  v.literal("video_generations"),
);

export const storageReferenceFieldValidator = v.union(
  v.literal("imageStorageId"),
  v.literal("thumbnailStorageId"),
  v.literal("referenceImageIds"),
  v.literal("avatarStorageId"),
  v.literal("storageId"),
  v.literal("videoStorageId"),
  v.literal("referenceImageStorageIds"),
);

export type StorageReferenceSource =
  | "generations"
  | "gallery"
  | "characters"
  | "durable_outputs"
  | "video_generations";

export type StorageReferenceField =
  | "imageStorageId"
  | "thumbnailStorageId"
  | "referenceImageIds"
  | "avatarStorageId"
  | "storageId"
  | "videoStorageId"
  | "referenceImageStorageIds";

export const STORAGE_REFERENCE_SOURCE_FIELDS = {
  generations: ["imageStorageId", "thumbnailStorageId", "referenceImageIds"],
  gallery: ["imageStorageId", "thumbnailStorageId"],
  characters: ["avatarStorageId"],
  durable_outputs: ["storageId", "thumbnailStorageId"],
  video_generations: ["videoStorageId", "thumbnailStorageId", "referenceImageStorageIds"],
} as const satisfies Record<StorageReferenceSource, readonly StorageReferenceField[]>;
