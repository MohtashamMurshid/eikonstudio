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

export const STORAGE_REFERENCE_SOURCE_FIELD_LIMITS = {
  generations: { imageStorageId: 1, thumbnailStorageId: 1, referenceImageIds: 4 },
  gallery: { imageStorageId: 1, thumbnailStorageId: 1 },
  characters: { avatarStorageId: 1 },
  durable_outputs: { storageId: 1, thumbnailStorageId: 1 },
  video_generations: { videoStorageId: 1, thumbnailStorageId: 1, referenceImageStorageIds: 3 },
} as const satisfies Record<StorageReferenceSource, Partial<Record<StorageReferenceField, number>>>;

export const STORAGE_REFERENCE_SOURCE_FIELDS = Object.fromEntries(
  Object.entries(STORAGE_REFERENCE_SOURCE_FIELD_LIMITS).map(([source, fields]) => [source, Object.keys(fields)]),
) as unknown as Record<StorageReferenceSource, readonly StorageReferenceField[]>;

export const STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS = Object.fromEntries(
  Object.entries(STORAGE_REFERENCE_SOURCE_FIELD_LIMITS).map(([source, fields]) => [
    source,
    Object.values(fields).reduce((total, limit) => total + limit, 0),
  ]),
) as Record<StorageReferenceSource, number>;

export function storageReferenceFieldLimit(source: StorageReferenceSource, field: StorageReferenceField) {
  return (STORAGE_REFERENCE_SOURCE_FIELD_LIMITS[source] as Partial<Record<StorageReferenceField, number>>)[field];
}
