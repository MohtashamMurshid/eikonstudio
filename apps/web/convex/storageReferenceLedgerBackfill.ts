import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  applyBackfilledDocumentStorageReferences,
  preflightBackfillDocumentStorageReferences,
} from "./storageReferenceLedger";
import {
  storageReferenceSourceValidator,
  type StorageReferenceField,
  type StorageReferenceSource,
} from "./storageReferenceContract";

const MAX_BACKFILL_PAGE_ROWS = 16;
const BACKFILL_VERSION = "historical_backfill_v1" as const;

const SOURCE_TABLES = {
  generations: "generations",
  gallery: "gallery",
  characters: "characters",
  durable_outputs: "durableGenerationOutputs",
  video_generations: "videoGenerations",
} as const;

type ReferenceInput = {
  field: StorageReferenceField;
  storageIds: readonly Id<"_storage">[] | undefined;
};

type SourceDocument = {
  documentId: string;
  ownerId: string;
  references: ReferenceInput[];
};

function assertPageSize(pageSize: number) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_BACKFILL_PAGE_ROWS) {
    throw new Error("INVALID_STORAGE_REFERENCE_LEDGER_BACKFILL_PAGE_SIZE");
  }
}

function scalar(field: StorageReferenceField, storageId: Id<"_storage"> | undefined): ReferenceInput {
  return { field, storageIds: storageId ? [storageId] : [] };
}

function array(field: StorageReferenceField, storageIds: readonly Id<"_storage">[] | undefined): ReferenceInput {
  return { field, storageIds: storageIds ?? [] };
}

async function latestCommittedDocument(ctx: MutationCtx, source: StorageReferenceSource) {
  switch (source) {
    case "generations": return await ctx.db.query("generations").order("desc").first();
    case "gallery": return await ctx.db.query("gallery").order("desc").first();
    case "characters": return await ctx.db.query("characters").order("desc").first();
    case "durable_outputs": return await ctx.db.query("durableGenerationOutputs").order("desc").first();
    case "video_generations": return await ctx.db.query("videoGenerations").order("desc").first();
  }
}

async function sourcePage(
  ctx: MutationCtx,
  source: StorageReferenceSource,
  cutoffAt: number,
  cursor: string | null,
  pageSize: number,
) {
  const paginationOpts = { cursor, numItems: pageSize };
  switch (source) {
    case "generations": {
      const result = await ctx.db.query("generations")
        .filter((q) => q.lte(q.field("_creationTime"), cutoffAt))
        .order("asc")
        .paginate(paginationOpts);
      return {
        result,
        documents: result.page.map((row): SourceDocument => ({
          documentId: row._id,
          ownerId: row.userId,
          references: [
            scalar("imageStorageId", row.imageStorageId),
            scalar("thumbnailStorageId", row.thumbnailStorageId),
            array("referenceImageIds", row.referenceImageIds),
          ],
        })),
      };
    }
    case "gallery": {
      const result = await ctx.db.query("gallery")
        .filter((q) => q.lte(q.field("_creationTime"), cutoffAt))
        .order("asc")
        .paginate(paginationOpts);
      return {
        result,
        documents: result.page.map((row): SourceDocument => ({
          documentId: row._id,
          ownerId: row.userId,
          references: [scalar("imageStorageId", row.imageStorageId), scalar("thumbnailStorageId", row.thumbnailStorageId)],
        })),
      };
    }
    case "characters": {
      const result = await ctx.db.query("characters")
        .filter((q) => q.lte(q.field("_creationTime"), cutoffAt))
        .order("asc")
        .paginate(paginationOpts);
      return {
        result,
        documents: result.page.map((row): SourceDocument => ({
          documentId: row._id,
          ownerId: row.userId,
          references: [scalar("avatarStorageId", row.avatarStorageId)],
        })),
      };
    }
    case "durable_outputs": {
      const result = await ctx.db.query("durableGenerationOutputs")
        .filter((q) => q.lte(q.field("_creationTime"), cutoffAt))
        .order("asc")
        .paginate(paginationOpts);
      return {
        result,
        documents: result.page.map((row): SourceDocument => ({
          documentId: row._id,
          ownerId: row.ownerId,
          references: [scalar("storageId", row.storageId), scalar("thumbnailStorageId", row.thumbnailStorageId)],
        })),
      };
    }
    case "video_generations": {
      const result = await ctx.db.query("videoGenerations")
        .filter((q) => q.lte(q.field("_creationTime"), cutoffAt))
        .order("asc")
        .paginate(paginationOpts);
      return {
        result,
        documents: result.page.map((row): SourceDocument => ({
          documentId: row._id,
          ownerId: row.userId,
          references: [
            scalar("videoStorageId", row.videoStorageId),
            scalar("thumbnailStorageId", row.thumbnailStorageId),
            array("referenceImageStorageIds", row.referenceImageStorageIds),
          ],
        })),
      };
    }
  }
}

const statusValidator = v.union(v.literal("running"), v.literal("completed"), v.literal("blocked"));

async function readCheckpoint(ctx: MutationCtx | QueryCtx, source: StorageReferenceSource) {
  const checkpointKey = `${BACKFILL_VERSION}:${source}`;
  const byKey = await ctx.db
    .query("storageReferenceLedgerBackfillCheckpoints")
    .withIndex("by_checkpoint_key", (q) => q.eq("checkpointKey", checkpointKey))
    .take(2);
  const bySource = await ctx.db
    .query("storageReferenceLedgerBackfillCheckpoints")
    .withIndex("by_source_version", (q) => q.eq("source", source).eq("version", BACKFILL_VERSION))
    .take(2);
  if (
    byKey.length > 1 ||
    bySource.length > 1 ||
    byKey.length !== bySource.length ||
    (byKey[0] && bySource[0] && byKey[0]._id !== bySource[0]._id)
  ) {
    throw new Error("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  }
  const checkpoint = byKey[0];
  if (
    checkpoint &&
    (checkpoint.checkpointKey !== checkpointKey ||
      checkpoint.version !== BACKFILL_VERSION ||
      checkpoint.source !== source ||
      checkpoint.sourceTable !== SOURCE_TABLES[source] ||
      (checkpoint.status === "running" &&
        (!checkpoint.cutoffDocumentId || !Number.isFinite(checkpoint.cutoffCreationTime))))
  ) {
    throw new Error("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  }
  return checkpoint;
}

export const runStorageReferenceLedgerBackfillPage = internalMutation({
  args: {
    source: storageReferenceSourceValidator,
    pageSize: v.number(),
  },
  returns: v.object({
    source: storageReferenceSourceValidator,
    status: statusValidator,
    cutoffDocumentId: v.optional(v.string()),
    lastDocumentId: v.optional(v.string()),
    pagesCompleted: v.number(),
    documentsScanned: v.number(),
    documentsInserted: v.number(),
    documentsReplayed: v.number(),
    occurrencesInserted: v.number(),
    pageDocuments: v.number(),
    pageOccurrencesInserted: v.number(),
    pageReplayed: v.number(),
    blockedDocumentId: v.optional(v.string()),
    blockedReason: v.optional(v.string()),
    authoritative: v.literal(false),
    physicalDeletionEnabled: v.literal(false),
  }),
  handler: async (ctx, args) => {
    assertPageSize(args.pageSize);
    const now = Date.now();
    let checkpoint = await readCheckpoint(ctx, args.source);
    if (!checkpoint) {
      const cutoffDocument = await latestCommittedDocument(ctx, args.source);
      const checkpointKey = `${BACKFILL_VERSION}:${args.source}`;
      const checkpointId = await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", {
        checkpointKey,
        version: BACKFILL_VERSION,
        source: args.source,
        sourceTable: SOURCE_TABLES[args.source],
        status: cutoffDocument ? "running" : "completed",
        cutoffDocumentId: cutoffDocument?._id,
        cutoffCreationTime: cutoffDocument?._creationTime,
        pagesCompleted: 0,
        documentsScanned: 0,
        documentsInserted: 0,
        documentsReplayed: 0,
        occurrencesInserted: 0,
        startedAt: now,
        updatedAt: now,
        completedAt: cutoffDocument ? undefined : now,
      });
      checkpoint = (await ctx.db.get(checkpointId))!;
    }

    const base = {
      source: args.source,
      cutoffDocumentId: checkpoint.cutoffDocumentId,
      lastDocumentId: checkpoint.lastDocumentId,
      pagesCompleted: checkpoint.pagesCompleted,
      documentsScanned: checkpoint.documentsScanned,
      documentsInserted: checkpoint.documentsInserted,
      documentsReplayed: checkpoint.documentsReplayed,
      occurrencesInserted: checkpoint.occurrencesInserted,
      authoritative: false as const,
      physicalDeletionEnabled: false as const,
    };
    if (checkpoint.status !== "running") {
      return {
        ...base,
        status: checkpoint.status,
        pageDocuments: 0,
        pageOccurrencesInserted: 0,
        pageReplayed: 0,
        blockedDocumentId: checkpoint.blockedDocumentId,
        blockedReason: checkpoint.blockedReason,
      };
    }

    if (!checkpoint.cutoffDocumentId || !Number.isFinite(checkpoint.cutoffCreationTime)) {
      throw new Error("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
    }
    const page = await sourcePage(
      ctx,
      args.source,
      checkpoint.cutoffCreationTime!,
      checkpoint.cursor ?? null,
      args.pageSize,
    );
    const prepared: Awaited<ReturnType<typeof preflightBackfillDocumentStorageReferences>>[] = [];
    let blockedDocumentId: string | undefined;
    try {
      for (const document of page.documents) {
        blockedDocumentId = document.documentId;
        prepared.push(await preflightBackfillDocumentStorageReferences(ctx, {
          source: args.source,
          ...document,
        }));
      }
    } catch (error) {
      const blockedReason = error instanceof Error ? error.message : "STORAGE_REFERENCE_LEDGER_BACKFILL_UNKNOWN_ERROR";
      await ctx.db.patch(checkpoint._id, {
        status: "blocked",
        blockedDocumentId,
        blockedReason,
        updatedAt: now,
      });
      return {
        ...base,
        status: "blocked" as const,
        pageDocuments: 0,
        pageOccurrencesInserted: 0,
        pageReplayed: 0,
        blockedDocumentId,
        blockedReason,
      };
    }

    let pageOccurrencesInserted = 0;
    let pageReplayed = 0;
    for (const document of prepared) {
      const result = await applyBackfilledDocumentStorageReferences(ctx, document);
      pageOccurrencesInserted += result.inserted;
      pageReplayed += result.replayed ? 1 : 0;
    }

    const status = page.result.isDone ? "completed" as const : "running" as const;
    const next = {
      pagesCompleted: checkpoint.pagesCompleted + 1,
      documentsScanned: checkpoint.documentsScanned + page.documents.length,
      documentsInserted: checkpoint.documentsInserted + (page.documents.length - pageReplayed),
      documentsReplayed: checkpoint.documentsReplayed + pageReplayed,
      occurrencesInserted: checkpoint.occurrencesInserted + pageOccurrencesInserted,
    };
    await ctx.db.patch(checkpoint._id, {
      status,
      lastDocumentId: page.documents.at(-1)?.documentId ?? checkpoint.lastDocumentId,
      cursor: page.result.isDone ? undefined : page.result.continueCursor,
      ...next,
      updatedAt: now,
      completedAt: page.result.isDone ? now : undefined,
    });
    return {
      source: args.source,
      status,
      cutoffDocumentId: checkpoint.cutoffDocumentId,
      lastDocumentId: page.documents.at(-1)?.documentId ?? checkpoint.lastDocumentId,
      ...next,
      pageDocuments: page.documents.length,
      pageOccurrencesInserted,
      pageReplayed,
      authoritative: false as const,
      physicalDeletionEnabled: false as const,
    };
  },
});

export const getStorageReferenceLedgerBackfillStatus = internalQuery({
  args: { source: storageReferenceSourceValidator },
  returns: v.union(v.null(), v.object({
    source: storageReferenceSourceValidator,
    status: statusValidator,
    cutoffDocumentId: v.optional(v.string()),
    lastDocumentId: v.optional(v.string()),
    pagesCompleted: v.number(),
    documentsScanned: v.number(),
    documentsInserted: v.number(),
    documentsReplayed: v.number(),
    occurrencesInserted: v.number(),
    blockedDocumentId: v.optional(v.string()),
    blockedReason: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    authoritative: v.literal(false),
    physicalDeletionEnabled: v.literal(false),
  })),
  handler: async (ctx, args) => {
    const checkpoint = await readCheckpoint(ctx, args.source);
    return checkpoint ? {
      source: checkpoint.source,
      status: checkpoint.status,
      cutoffDocumentId: checkpoint.cutoffDocumentId,
      lastDocumentId: checkpoint.lastDocumentId,
      pagesCompleted: checkpoint.pagesCompleted,
      documentsScanned: checkpoint.documentsScanned,
      documentsInserted: checkpoint.documentsInserted,
      documentsReplayed: checkpoint.documentsReplayed,
      occurrencesInserted: checkpoint.occurrencesInserted,
      blockedDocumentId: checkpoint.blockedDocumentId,
      blockedReason: checkpoint.blockedReason,
      startedAt: checkpoint.startedAt,
      updatedAt: checkpoint.updatedAt,
      completedAt: checkpoint.completedAt,
      authoritative: false as const,
      physicalDeletionEnabled: false as const,
    } : null;
  },
});
