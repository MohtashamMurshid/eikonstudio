import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import {
  storageReferenceFieldValidator as fieldValidator,
  storageReferenceSourceValidator as sourceValidator,
  type StorageReferenceField as StorageField,
  type StorageReferenceSource as StorageSource,
} from "./storageReferenceContract";

const MAX_PAGE_ROWS = 100;
const MINIMUM_AGE_MS = 60 * 60 * 1000;


type ReferenceGroup = {
  field: StorageField;
  storageIds: Id<"_storage">[];
};

type ReferenceDocument = {
  source: StorageSource;
  documentId: string;
  references: ReferenceGroup[];
};

function assertPageSize(numItems: number) {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > MAX_PAGE_ROWS) {
    throw new Error("INVALID_STORAGE_INVENTORY_PAGE_SIZE");
  }
}

function group(field: StorageField, storageIds: readonly Id<"_storage">[] | undefined): ReferenceGroup[] {
  return storageIds && storageIds.length > 0 ? [{ field, storageIds: [...storageIds] }] : [];
}

function scalar(field: StorageField, storageId: Id<"_storage"> | undefined): ReferenceGroup[] {
  return storageId ? group(field, [storageId]) : [];
}

function document(
  source: StorageSource,
  documentId: string,
  references: ReferenceGroup[],
): ReferenceDocument {
  return { source, documentId, references };
}

const referenceDocumentValidator = v.object({
  source: sourceValidator,
  documentId: v.string(),
  references: v.array(v.object({
    field: fieldValidator,
    storageIds: v.array(v.id("_storage")),
  })),
});

/**
 * Pages compact application reference documents without deciding whether any object is orphaned.
 * Convex scopes every cursor to the exact selected source query and reports split-page signals.
 */
export const pageStorageReferences = internalQuery({
  args: { source: sourceValidator, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(referenceDocumentValidator),
  handler: async (ctx, args) => {
    assertPageSize(args.paginationOpts.numItems);
    switch (args.source) {
      case "generations": {
        const result = await ctx.db.query("generations").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.map((row) => document("generations", row._id, [
            ...scalar("imageStorageId", row.imageStorageId),
            ...scalar("thumbnailStorageId", row.thumbnailStorageId),
            ...group("referenceImageIds", row.referenceImageIds),
          ])),
        };
      }
      case "gallery": {
        const result = await ctx.db.query("gallery").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.map((row) => document("gallery", row._id, [
            ...scalar("imageStorageId", row.imageStorageId),
            ...scalar("thumbnailStorageId", row.thumbnailStorageId),
          ])),
        };
      }
      case "characters": {
        const result = await ctx.db.query("characters").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.map((row) => document(
            "characters",
            row._id,
            scalar("avatarStorageId", row.avatarStorageId),
          )),
        };
      }
      case "durable_outputs": {
        const result = await ctx.db.query("durableGenerationOutputs").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.map((row) => document("durable_outputs", row._id, [
            ...scalar("storageId", row.storageId),
            ...scalar("thumbnailStorageId", row.thumbnailStorageId),
          ])),
        };
      }
      case "video_generations": {
        const result = await ctx.db.query("videoGenerations").order("asc").paginate(args.paginationOpts);
        return {
          ...result,
          page: result.page.map((row) => document("video_generations", row._id, [
            ...scalar("videoStorageId", row.videoStorageId),
            ...scalar("thumbnailStorageId", row.thumbnailStorageId),
            ...group("referenceImageStorageIds", row.referenceImageStorageIds),
          ])),
        };
      }
    }
  },
});

const storageObjectValidator = v.object({
  storageId: v.id("_storage"),
  createdAt: v.number(),
  byteSize: v.number(),
  contentType: v.optional(v.string()),
  eligibleForReview: v.boolean(),
});

/**
 * Pages minimal storage metadata and marks only age eligibility for later offline review.
 * Pass the first page's server-derived reviewBefore into later pages for a stable run cutoff.
 */
export const pageStorageObjects = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    minimumAgeMs: v.number(),
    reviewBefore: v.optional(v.number()),
  },
  returns: v.object({
    result: paginationResultValidator(storageObjectValidator),
    reviewBefore: v.number(),
  }),
  handler: async (ctx, args) => {
    assertPageSize(args.paginationOpts.numItems);
    if (!Number.isSafeInteger(args.minimumAgeMs) || args.minimumAgeMs < MINIMUM_AGE_MS) {
      throw new Error("INVALID_STORAGE_INVENTORY_MINIMUM_AGE");
    }
    const now = Date.now();
    const latestReviewBefore = Math.max(0, now - args.minimumAgeMs);
    if (
      args.reviewBefore !== undefined &&
      (!Number.isSafeInteger(args.reviewBefore) || args.reviewBefore < 0 || args.reviewBefore > latestReviewBefore)
    ) {
      throw new Error("INVALID_STORAGE_INVENTORY_REVIEW_BEFORE");
    }
    const reviewBefore = args.reviewBefore ?? latestReviewBefore;
    const result = await ctx.db.system.query("_storage").order("asc").paginate(args.paginationOpts);
    return {
      reviewBefore,
      result: {
        ...result,
        page: result.page.map((row) => ({
          storageId: row._id,
          createdAt: row._creationTime,
          byteSize: row.size,
          contentType: row.contentType,
          eligibleForReview: row._creationTime <= reviewBefore,
        })),
      },
    };
  },
});
