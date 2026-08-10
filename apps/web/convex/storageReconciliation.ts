import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";

const MAX_PAGE_ROWS = 100;
const MAX_ARRAY_REFERENCES = 16;
const MINIMUM_AGE_MS = 60 * 60 * 1000;
const MAXIMUM_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const sourceValidator = v.union(
  v.literal("generations"),
  v.literal("gallery"),
  v.literal("characters"),
  v.literal("durable_outputs"),
  v.literal("video_generations"),
);

const fieldValidator = v.union(
  v.literal("imageStorageId"),
  v.literal("thumbnailStorageId"),
  v.literal("referenceImageIds"),
  v.literal("avatarStorageId"),
  v.literal("storageId"),
  v.literal("videoStorageId"),
  v.literal("referenceImageStorageIds"),
);

type StorageSource =
  | "generations"
  | "gallery"
  | "characters"
  | "durable_outputs"
  | "video_generations";

type StorageField =
  | "imageStorageId"
  | "thumbnailStorageId"
  | "referenceImageIds"
  | "avatarStorageId"
  | "storageId"
  | "videoStorageId"
  | "referenceImageStorageIds";

type StorageReference = {
  source: StorageSource;
  documentId: string;
  field: StorageField;
  storageId: Id<"_storage">;
};

function assertPageSize(numItems: number) {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > MAX_PAGE_ROWS) {
    throw new Error("INVALID_STORAGE_INVENTORY_PAGE_SIZE");
  }
}

function assertReferenceArray(ids: readonly Id<"_storage">[]) {
  if (ids.length > MAX_ARRAY_REFERENCES) {
    throw new Error("STORAGE_REFERENCE_ARRAY_LIMIT_EXCEEDED");
  }
}

function reference(
  source: StorageSource,
  documentId: string,
  field: StorageField,
  storageId: Id<"_storage"> | undefined,
): StorageReference[] {
  return storageId ? [{ source, documentId, field, storageId }] : [];
}

function references(
  source: StorageSource,
  documentId: string,
  field: StorageField,
  storageIds: readonly Id<"_storage">[] | undefined,
): StorageReference[] {
  const ids = storageIds ?? [];
  assertReferenceArray(ids);
  return ids.map((storageId) => ({ source, documentId, field, storageId }));
}

const referencePageValidator = v.object({
  page: v.array(v.object({
    source: sourceValidator,
    documentId: v.string(),
    field: fieldValidator,
    storageId: v.id("_storage"),
  })),
  continueCursor: v.string(),
  isDone: v.boolean(),
});

/**
 * Pages application references without deciding whether any object is orphaned.
 * The cursor belongs to the selected source table and must not be reused for another source.
 */
export const pageStorageReferences = internalQuery({
  args: { source: sourceValidator, paginationOpts: paginationOptsValidator },
  returns: referencePageValidator,
  handler: async (ctx, args) => {
    assertPageSize(args.paginationOpts.numItems);
    switch (args.source) {
      case "generations": {
        const result = await ctx.db.query("generations").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.flatMap((row) => [
            ...reference("generations", row._id, "imageStorageId", row.imageStorageId),
            ...reference("generations", row._id, "thumbnailStorageId", row.thumbnailStorageId),
            ...references("generations", row._id, "referenceImageIds", row.referenceImageIds),
          ]),
        };
      }
      case "gallery": {
        const result = await ctx.db.query("gallery").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.flatMap((row) => [
            ...reference("gallery", row._id, "imageStorageId", row.imageStorageId),
            ...reference("gallery", row._id, "thumbnailStorageId", row.thumbnailStorageId),
          ]),
        };
      }
      case "characters": {
        const result = await ctx.db.query("characters").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.flatMap((row) =>
            reference("characters", row._id, "avatarStorageId", row.avatarStorageId),
          ),
        };
      }
      case "durable_outputs": {
        const result = await ctx.db.query("durableGenerationOutputs").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.flatMap((row) => [
            ...reference("durable_outputs", row._id, "storageId", row.storageId),
            ...reference("durable_outputs", row._id, "thumbnailStorageId", row.thumbnailStorageId),
          ]),
        };
      }
      case "video_generations": {
        const result = await ctx.db.query("videoGenerations").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.flatMap((row) => [
            ...reference("video_generations", row._id, "videoStorageId", row.videoStorageId),
            ...reference("video_generations", row._id, "thumbnailStorageId", row.thumbnailStorageId),
            ...references(
              "video_generations",
              row._id,
              "referenceImageStorageIds",
              row.referenceImageStorageIds,
            ),
          ]),
        };
      }
    }
  },
});

/**
 * Pages minimal storage metadata and marks only age eligibility for later offline review.
 * Eligibility is not an orphan verdict and this query never mutates storage or application rows.
 */
export const pageStorageObjects = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    minimumAgeMs: v.number(),
  },
  returns: v.object({
    page: v.array(v.object({
      storageId: v.id("_storage"),
      createdAt: v.number(),
      byteSize: v.number(),
      contentType: v.optional(v.string()),
      eligibleForReview: v.boolean(),
    })),
    continueCursor: v.string(),
    isDone: v.boolean(),
    reviewBefore: v.number(),
  }),
  handler: async (ctx, args) => {
    assertPageSize(args.paginationOpts.numItems);
    if (
      !Number.isInteger(args.minimumAgeMs) ||
      args.minimumAgeMs < MINIMUM_AGE_MS ||
      args.minimumAgeMs > MAXIMUM_AGE_MS
    ) {
      throw new Error("INVALID_STORAGE_INVENTORY_MINIMUM_AGE");
    }
    const now = Date.now();
    const reviewBefore = now - args.minimumAgeMs;
    const result = await ctx.db.system.query("_storage").order("asc").paginate(args.paginationOpts);
    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      reviewBefore,
      page: result.page.map((row) => ({
        storageId: row._id,
        createdAt: row._creationTime,
        byteSize: row.size,
        contentType: row.contentType,
        eligibleForReview: row._creationTime <= reviewBefore,
      })),
    };
  },
});
