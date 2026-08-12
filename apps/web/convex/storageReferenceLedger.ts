import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalQuery } from "./_generated/server";
import {
  STORAGE_REFERENCE_SOURCE_FIELDS,
  STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS,
  storageReferenceFieldLimit,
  type StorageReferenceField,
  type StorageReferenceSource,
} from "./storageReferenceContract";

type ReferenceInput = {
  field: StorageReferenceField;
  storageIds: readonly Id<"_storage">[] | undefined;
};

type DocumentReferencesArgs = {
  source: StorageReferenceSource;
  documentId: string;
  ownerId: string;
  references: readonly ReferenceInput[];
};

type FieldReferencesArgs = {
  source: StorageReferenceSource;
  documentId: string;
  ownerId: string;
  field: StorageReferenceField;
  storageIds: readonly Id<"_storage">[] | undefined;
};

function referenceKey(
  source: StorageReferenceSource,
  documentId: string,
  field: StorageReferenceField,
  position: number,
) {
  return JSON.stringify([source, documentId, field, position]);
}

function fieldOccurrences(
  source: StorageReferenceSource,
  documentId: string,
  field: StorageReferenceField,
  storageIds: readonly Id<"_storage">[] | undefined,
) {
  const limit = storageReferenceFieldLimit(source, field);
  if (limit === undefined) throw new Error("INVALID_STORAGE_REFERENCE_LEDGER_FIELD");
  const ids = storageIds ?? [];
  if (ids.length > limit) throw new Error("STORAGE_REFERENCE_LEDGER_DOCUMENT_OVERFLOW");
  return ids.map((storageId, position) => ({
    referenceKey: referenceKey(source, documentId, field, position),
    storageId,
    field,
    position,
  }));
}

function validateLedgerRows(
  rows: Doc<"storageReferenceLedger">[],
  source: StorageReferenceSource,
  documentId: string,
  ownerId: string,
  expectedField?: StorageReferenceField,
) {
  const keys = new Set<string>();
  const positions = new Set<string>();
  const positionsByField = new Map<StorageReferenceField, number[]>();
  for (const row of rows) {
    const limit = storageReferenceFieldLimit(source, row.field);
    const positionKey = `${row.field}:${row.position}`;
    if (
      row.source !== source ||
      row.documentId !== documentId ||
      row.ownerId !== ownerId ||
      (expectedField !== undefined && row.field !== expectedField) ||
      limit === undefined ||
      !Number.isInteger(row.position) ||
      row.position < 0 ||
      row.position >= limit ||
      row.referenceKey !== referenceKey(source, documentId, row.field, row.position) ||
      (row.origin !== "transactional_dual_write_v1" && row.origin !== "historical_backfill_v1") ||
      keys.has(row.referenceKey) ||
      positions.has(positionKey)
    ) {
      throw new Error("STORAGE_REFERENCE_LEDGER_CORRUPT");
    }
    keys.add(row.referenceKey);
    positions.add(positionKey);
    positionsByField.set(row.field, [...(positionsByField.get(row.field) ?? []), row.position]);
  }
  for (const fieldPositions of positionsByField.values()) {
    fieldPositions.sort((left, right) => left - right);
    if (fieldPositions.some((position, index) => position !== index)) {
      throw new Error("STORAGE_REFERENCE_LEDGER_CORRUPT");
    }
  }
}

async function ensureCollectingState(ctx: MutationCtx, now: number) {
  const states = await ctx.db
    .query("storageReferenceLedgerState")
    .withIndex("by_state_key", (q) => q.eq("stateKey", "global"))
    .take(2);
  if (states.length > 1) throw new Error("STORAGE_REFERENCE_LEDGER_STATE_CORRUPT");
  if (states.length === 0) {
    await ctx.db.insert("storageReferenceLedgerState", {
      stateKey: "global",
      status: "collecting",
      startedAt: now,
    });
  }
}

function completeOccurrences(args: DocumentReferencesArgs) {
  const expectedFields = STORAGE_REFERENCE_SOURCE_FIELDS[args.source];
  const providedFields = args.references.map((reference) => reference.field);
  if (
    providedFields.length !== expectedFields.length ||
    new Set(providedFields).size !== providedFields.length ||
    expectedFields.some((field) => !providedFields.includes(field))
  ) {
    throw new Error("INVALID_STORAGE_REFERENCE_LEDGER_SNAPSHOT");
  }
  const occurrences = args.references.flatMap((reference) =>
    fieldOccurrences(args.source, args.documentId, reference.field, reference.storageIds)
  );
  if (occurrences.length > STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS[args.source]) {
    throw new Error("STORAGE_REFERENCE_LEDGER_DOCUMENT_OVERFLOW");
  }
  return occurrences;
}

async function readDocumentLedgerRows(ctx: MutationCtx, source: StorageReferenceSource, documentId: string) {
  const limit = STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS[source];
  const rows = await ctx.db
    .query("storageReferenceLedger")
    .withIndex("by_source_document", (q) => q.eq("source", source).eq("documentId", documentId))
    .take(limit + 1);
  if (rows.length > limit) throw new Error("STORAGE_REFERENCE_LEDGER_CORRUPT");
  return rows;
}

/** Inserts the complete storage-reference snapshot for a newly inserted source document. */
export async function insertDocumentStorageReferences(ctx: MutationCtx, args: DocumentReferencesArgs) {
  const occurrences = completeOccurrences(args);
  const existing = await readDocumentLedgerRows(ctx, args.source, args.documentId);
  if (existing.length !== 0) throw new Error("STORAGE_REFERENCE_LEDGER_ALREADY_EXISTS");

  const now = Date.now();
  await ensureCollectingState(ctx, now);
  for (const occurrence of occurrences) {
    await ctx.db.insert("storageReferenceLedger", {
      ...occurrence,
      source: args.source,
      documentId: args.documentId,
      ownerId: args.ownerId,
      origin: "transactional_dual_write_v1",
      createdAt: now,
      updatedAt: now,
    });
  }
}

/** Preflights one historical snapshot without writing, for whole-page atomic validation. */
export async function preflightBackfillDocumentStorageReferences(ctx: MutationCtx, args: DocumentReferencesArgs) {
  const occurrences = completeOccurrences(args);
  const existing = await readDocumentLedgerRows(ctx, args.source, args.documentId);
  if (existing.length > 0) {
    validateLedgerRows(existing, args.source, args.documentId, args.ownerId);
    const existingByKey = new Map(existing.map((row) => [row.referenceKey, row]));
    if (
      existing.length !== occurrences.length ||
      occurrences.some((occurrence) => existingByKey.get(occurrence.referenceKey)?.storageId !== occurrence.storageId)
    ) {
      throw new Error("STORAGE_REFERENCE_LEDGER_BACKFILL_CONFLICT");
    }
    return { args, occurrences, inserted: 0, replayed: true };
  }
  return { args, occurrences, inserted: occurrences.length, replayed: false };
}

/** Applies a previously preflighted historical snapshot in the same transaction. */
export async function applyBackfilledDocumentStorageReferences(
  ctx: MutationCtx,
  prepared: Awaited<ReturnType<typeof preflightBackfillDocumentStorageReferences>>,
) {
  if (prepared.replayed) return { inserted: 0, replayed: true };
  const now = Date.now();
  await ensureCollectingState(ctx, now);
  for (const occurrence of prepared.occurrences) {
    await ctx.db.insert("storageReferenceLedger", {
      ...occurrence,
      source: prepared.args.source,
      documentId: prepared.args.documentId,
      ownerId: prepared.args.ownerId,
      origin: "historical_backfill_v1",
      createdAt: now,
      updatedAt: now,
    });
  }
  return { inserted: prepared.occurrences.length, replayed: false };
}

/** Historical backfill is insert-only and exact-replay-safe. */
export async function backfillDocumentStorageReferences(ctx: MutationCtx, args: DocumentReferencesArgs) {
  return await applyBackfilledDocumentStorageReferences(
    ctx,
    await preflightBackfillDocumentStorageReferences(ctx, args),
  );
}

/** Replaces only the storage field actually patched; unrelated historical fields remain untouched. */
export async function replaceStorageFieldReferences(ctx: MutationCtx, args: FieldReferencesArgs) {
  const desired = fieldOccurrences(args.source, args.documentId, args.field, args.storageIds);
  const limit = storageReferenceFieldLimit(args.source, args.field)!;
  const existing = await ctx.db
    .query("storageReferenceLedger")
    .withIndex("by_source_document_field", (q) =>
      q.eq("source", args.source).eq("documentId", args.documentId).eq("field", args.field)
    )
    .take(limit + 1);
  if (existing.length > limit) throw new Error("STORAGE_REFERENCE_LEDGER_CORRUPT");
  validateLedgerRows(existing, args.source, args.documentId, args.ownerId, args.field);

  const now = Date.now();
  await ensureCollectingState(ctx, now);
  const existingByPosition = new Map(existing.map((row) => [row.position, row]));
  for (const row of existing) {
    if (row.position >= desired.length) await ctx.db.delete(row._id);
  }
  for (const occurrence of desired) {
    const row = existingByPosition.get(occurrence.position);
    if (!row) {
      await ctx.db.insert("storageReferenceLedger", {
        ...occurrence,
        source: args.source,
        documentId: args.documentId,
        ownerId: args.ownerId,
        origin: "transactional_dual_write_v1",
        createdAt: now,
        updatedAt: now,
      });
    } else if (row.storageId !== occurrence.storageId) {
      await ctx.db.patch(row._id, {
        storageId: occurrence.storageId,
        updatedAt: now,
      });
    }
  }
}

/** Missing rows are valid while non-authoritative; malformed existing rows fail closed. */
export async function removeDocumentStorageReferences(
  ctx: MutationCtx,
  source: StorageReferenceSource,
  documentId: string,
  ownerId: string,
) {
  const limit = STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS[source];
  const existing = await ctx.db
    .query("storageReferenceLedger")
    .withIndex("by_source_document", (q) => q.eq("source", source).eq("documentId", documentId))
    .take(limit + 1);
  if (existing.length > limit) throw new Error("STORAGE_REFERENCE_LEDGER_CORRUPT");
  validateLedgerRows(existing, source, documentId, ownerId);
  await ensureCollectingState(ctx, Date.now());
  for (const row of existing) await ctx.db.delete(row._id);
}

/** Read-only observability; this slice cannot represent or enable authority. */
export const getStorageReferenceLedgerReadiness = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("uninitialized"), v.literal("collecting")),
    authoritative: v.literal(false),
    physicalDeletionEnabled: v.literal(false),
    startedAt: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    const states = await ctx.db
      .query("storageReferenceLedgerState")
      .withIndex("by_state_key", (q) => q.eq("stateKey", "global"))
      .take(2);
    if (states.length > 1) throw new Error("STORAGE_REFERENCE_LEDGER_STATE_CORRUPT");
    return states[0]
      ? {
          status: "collecting" as const,
          authoritative: false as const,
          physicalDeletionEnabled: false as const,
          startedAt: states[0].startedAt,
        }
      : {
          status: "uninitialized" as const,
          authoritative: false as const,
          physicalDeletionEnabled: false as const,
        };
  },
});
