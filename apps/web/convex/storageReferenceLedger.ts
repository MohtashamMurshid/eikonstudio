import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalQuery } from "./_generated/server";
import {
  STORAGE_REFERENCE_SOURCE_FIELDS,
  type StorageReferenceField,
  type StorageReferenceSource,
} from "./storageReferenceContract";

const MAX_REFERENCES_PER_DOCUMENT = 64;

type ReferenceInput = {
  field: StorageReferenceField;
  storageIds: readonly Id<"_storage">[] | undefined;
};

type ReplaceDocumentReferencesArgs = {
  source: StorageReferenceSource;
  documentId: string;
  ownerId: string;
  references: readonly ReferenceInput[];
};

function referenceKey(
  source: StorageReferenceSource,
  documentId: string,
  field: StorageReferenceField,
  storageId: Id<"_storage">,
) {
  return JSON.stringify([source, documentId, field, storageId]);
}

async function ensureCollectingState(ctx: MutationCtx, now: number) {
  const state = await ctx.db
    .query("storageReferenceLedgerState")
    .withIndex("by_state_key", (q) => q.eq("stateKey", "global"))
    .unique();
  if (!state) {
    await ctx.db.insert("storageReferenceLedgerState", {
      stateKey: "global",
      status: "collecting",
      startedAt: now,
    });
  }
}

/**
 * Atomically replaces the complete deduplicated storage-reference set for one
 * application document. This dual-write ledger is not deletion authority until
 * a later historical backfill and verification milestone marks it ready.
 */
export async function replaceDocumentStorageReferences(
  ctx: MutationCtx,
  args: ReplaceDocumentReferencesArgs,
) {
  const allowedFields = new Set<StorageReferenceField>(STORAGE_REFERENCE_SOURCE_FIELDS[args.source]);
  const desired = new Map<string, { field: StorageReferenceField; storageId: Id<"_storage"> }>();
  for (const reference of args.references) {
    if (!allowedFields.has(reference.field)) throw new Error("INVALID_STORAGE_REFERENCE_LEDGER_FIELD");
    for (const storageId of reference.storageIds ?? []) {
      const key = referenceKey(args.source, args.documentId, reference.field, storageId);
      desired.set(key, { field: reference.field, storageId });
      if (desired.size > MAX_REFERENCES_PER_DOCUMENT) {
        throw new Error("STORAGE_REFERENCE_LEDGER_DOCUMENT_OVERFLOW");
      }
    }
  }

  const existing = await ctx.db
    .query("storageReferenceLedger")
    .withIndex("by_source_document", (q) => q.eq("source", args.source).eq("documentId", args.documentId))
    .take(MAX_REFERENCES_PER_DOCUMENT + 1);
  if (existing.length > MAX_REFERENCES_PER_DOCUMENT) {
    throw new Error("STORAGE_REFERENCE_LEDGER_DOCUMENT_OVERFLOW");
  }

  const now = Date.now();
  await ensureCollectingState(ctx, now);
  const existingByKey = new Map(existing.map((row) => [row.referenceKey, row]));
  for (const row of existing) {
    if (!desired.has(row.referenceKey)) await ctx.db.delete(row._id);
  }
  for (const [key, reference] of desired) {
    const row = existingByKey.get(key);
    if (!row) {
      await ctx.db.insert("storageReferenceLedger", {
        referenceKey: key,
        storageId: reference.storageId,
        source: args.source,
        documentId: args.documentId,
        field: reference.field,
        ownerId: args.ownerId,
        createdAt: now,
        updatedAt: now,
      });
    } else if (
      row.ownerId !== args.ownerId ||
      row.storageId !== reference.storageId ||
      row.field !== reference.field
    ) {
      await ctx.db.patch(row._id, {
        storageId: reference.storageId,
        field: reference.field,
        ownerId: args.ownerId,
        updatedAt: now,
      });
    }
  }
}

export async function removeDocumentStorageReferences(
  ctx: MutationCtx,
  source: StorageReferenceSource,
  documentId: string,
  ownerId: string,
) {
  await replaceDocumentStorageReferences(ctx, { source, documentId, ownerId, references: [] });
}

/** Read-only observability; authoritative deliberately remains false in this slice. */
export const getStorageReferenceLedgerReadiness = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("uninitialized"), v.literal("collecting"), v.literal("verified")),
    authoritative: v.literal(false),
    startedAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    verificationFingerprint: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("storageReferenceLedgerState")
      .withIndex("by_state_key", (q) => q.eq("stateKey", "global"))
      .unique();
    return state
      ? {
          status: state.status,
          authoritative: false as const,
          startedAt: state.startedAt,
          verifiedAt: state.verifiedAt,
          verificationFingerprint: state.verificationFingerprint,
        }
      : { status: "uninitialized" as const, authoritative: false as const };
  },
});
