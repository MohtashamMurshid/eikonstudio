import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  STORAGE_REFERENCE_SOURCE_FIELDS,
  STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS,
  storageReferenceFieldLimit,
  storageReferenceSourceValidator,
  type StorageReferenceField,
  type StorageReferenceSource,
} from "./storageReferenceContract";

const VERSION = "source_ledger_verification_v1" as const;
const BACKFILL_VERSION = "historical_backfill_v1" as const;
const MAX_VERIFICATION_PAGE_ROWS = 16;
const MAX_FINALIZATION_EVIDENCE_PAGES = 16;
const GENESIS_FINGERPRINT = "0".repeat(64);

const SOURCES: readonly StorageReferenceSource[] = [
  "generations",
  "gallery",
  "characters",
  "durable_outputs",
  "video_generations",
];

const DIRECTIONS = ["source_to_ledger", "ledger_to_source"] as const;
type Direction = (typeof DIRECTIONS)[number];
type DatabaseContext = MutationCtx | QueryCtx;
type VerificationRun = Doc<"storageReferenceLedgerVerificationRuns">;
type VerificationScope = Doc<"storageReferenceLedgerVerificationScopes">;
type VerificationCheckpoint =
  Doc<"storageReferenceLedgerVerificationCheckpoints">;
type LedgerRow = Doc<"storageReferenceLedger">;

class VerificationComparisonError extends Error {
  constructor(
    readonly code: string,
    readonly documentId: string,
    readonly ledgerRowId?: string,
  ) {
    super(code);
    this.name = "VerificationComparisonError";
  }
}

const SOURCE_TABLES = {
  generations: "generations",
  gallery: "gallery",
  characters: "characters",
  durable_outputs: "durableGenerationOutputs",
  video_generations: "videoGenerations",
} as const satisfies Record<StorageReferenceSource, string>;

type ReferenceInput = {
  field: StorageReferenceField;
  storageIds: readonly Id<"_storage">[];
};

type SourceDocument = {
  documentId: string;
  creationTime: number;
  ownerId: string;
  references: ReferenceInput[];
};

type VerificationPage = {
  page: readonly SourceDocument[] | readonly LedgerRow[];
  continueCursor: string;
  isDone: boolean;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  splitCursor?: string | null;
};

type ExpectedTuple = readonly [
  string,
  Id<"_storage">,
  StorageReferenceField,
  number,
  string,
];
type ActualTuple = readonly [
  string,
  Id<"_storage">,
  StorageReferenceField,
  number,
  string,
  Id<"storageReferenceLedger">,
  LedgerRow["origin"],
  number,
  number,
];

const directionValidator = v.union(
  v.literal("source_to_ledger"),
  v.literal("ledger_to_source"),
);
const checkpointStatusValidator = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("blocked"),
);
const runPhaseValidator = v.union(
  v.literal("source_scan"),
  v.literal("ledger_cutoff"),
  v.literal("ledger_scan"),
  v.literal("finalizing"),
  v.literal("completed"),
  v.literal("blocked"),
);

const safetyReturnValidator = {
  authoritative: v.literal(false),
  physicalDeletionEnabled: v.literal(false),
} as const;

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

// Pinned, dependency-free SHA-256. Callers hash canonical JSON arrays only.
function sha256(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const message: number[] = [...bytes, 0x80];
  while (message.length % 64 !== 56) message.push(0);

  const bitLength = bytes.length * 8;
  for (let shift = 56; shift >= 0; shift -= 8) {
    message.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  }

  const constants: number[] = [];
  for (let candidate = 2; constants.length < 64; candidate += 1) {
    let prime = true;
    for (let divisor = 2; divisor * divisor <= candidate; divisor += 1) {
      if (candidate % divisor === 0) {
        prime = false;
        break;
      }
    }
    if (prime) constants.push(Math.floor((candidate ** (1 / 3) % 1) * 2 ** 32));
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];

  for (let offset = 0; offset < message.length; offset += 64) {
    const words = new Array<number>(64);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] =
        (message[start] << 24) |
        (message[start + 1] << 16) |
        (message[start + 2] << 8) |
        message[start + 3] |
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const first = words[index - 15];
      const second = words[index - 2];
      const sigma0 =
        rotateRight(first, 7) ^ rotateRight(first, 18) ^ (first >>> 3);
      const sigma1 =
        rotateRight(second, 17) ^ rotateRight(second, 19) ^ (second >>> 10);
      words[index] =
        (words[index - 16] + sigma0 + words[index - 7] + sigma1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 =
        (h + sum1 + choice + constants[index] + words[index]) | 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) | 0;
    }

    for (const [index, value] of [a, b, c, d, e, f, g, h].entries()) {
      hash[index] = (hash[index] + value) | 0;
    }
  }

  return hash
    .map((word) => (word >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function canonicalHash(value: readonly unknown[]): string {
  return sha256(JSON.stringify(value));
}

const contractFingerprint = canonicalHash([
  VERSION,
  ...SOURCES.map((source) => [
    source,
    SOURCE_TABLES[source],
    ...STORAGE_REFERENCE_SOURCE_FIELDS[source].map((field) => [
      field,
      storageReferenceFieldLimit(source, field),
    ]),
  ]),
]);

function assertPageSize(pageSize: number): void {
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_VERIFICATION_PAGE_ROWS
  ) {
    throw new Error("INVALID_STORAGE_REFERENCE_LEDGER_VERIFICATION_PAGE_SIZE");
  }
}

function assertStablePage(page: VerificationPage): void {
  if (page.pageStatus != null || page.splitCursor != null) {
    throw new Error("VERIFICATION_UNSUPPORTED_PAGINATION_STATE");
  }
}

function inclusiveTerminalRows<T extends { _id: string; _creationTime: number }>(
  rows: readonly T[],
  cutoffCreationTime: number,
  cutoffDocumentId: string,
): { rows: T[]; reachedTerminal: boolean } {
  const terminalIndex = rows.findIndex((row) => row._id === cutoffDocumentId);
  if (terminalIndex >= 0) {
    return { rows: rows.slice(0, terminalIndex + 1), reachedTerminal: true };
  }
  const bounded = rows.filter(
    (row) => row._creationTime <= cutoffCreationTime,
  );
  return {
    rows: bounded,
    reachedTerminal: bounded.length !== rows.length,
  };
}

function referenceKey(
  source: StorageReferenceSource,
  documentId: string,
  field: StorageReferenceField,
  position: number,
): string {
  return JSON.stringify([source, documentId, field, position]);
}

function scalar(
  field: StorageReferenceField,
  storageId: Id<"_storage"> | undefined,
): ReferenceInput {
  return { field, storageIds: storageId ? [storageId] : [] };
}

function array(
  field: StorageReferenceField,
  storageIds: readonly Id<"_storage">[] | undefined,
): ReferenceInput {
  return { field, storageIds: storageIds ?? [] };
}

function comparisonError(
  code: string,
  documentId: string,
  ledgerRowId?: string,
): never {
  throw new VerificationComparisonError(code, documentId, ledgerRowId);
}

function assertSameUniqueRow<T extends { _id: string }>(
  byNaturalKey: readonly T[],
  byRelationship: readonly T[],
  errorCode: string,
): T | undefined {
  if (
    byNaturalKey.length > 1 ||
    byRelationship.length > 1 ||
    byNaturalKey.length !== byRelationship.length ||
    (byNaturalKey[0] &&
      byRelationship[0] &&
      byNaturalKey[0]._id !== byRelationship[0]._id)
  ) {
    throw new Error(errorCode);
  }
  return byNaturalKey[0];
}

async function readRun(
  ctx: DatabaseContext,
  runKey: string,
): Promise<VerificationRun | undefined> {
  const byKey = await ctx.db
    .query("storageReferenceLedgerVerificationRuns")
    .withIndex("by_run_key", (query) => query.eq("runKey", runKey))
    .take(2);
  const byVersionAndKey = await ctx.db
    .query("storageReferenceLedgerVerificationRuns")
    .withIndex("by_version_run_key", (query) =>
      query.eq("version", VERSION).eq("runKey", runKey),
    )
    .take(2);
  return assertSameUniqueRow(
    byKey,
    byVersionAndKey,
    "STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT",
  );
}

async function readScope(
  ctx: DatabaseContext,
  runId: Id<"storageReferenceLedgerVerificationRuns">,
  direction: Direction,
  source: StorageReferenceSource,
): Promise<VerificationScope> {
  const scopeKey = `${runId}:${direction}:${source}`;
  const byKey = await ctx.db
    .query("storageReferenceLedgerVerificationScopes")
    .withIndex("by_scope_key", (query) => query.eq("scopeKey", scopeKey))
    .take(2);
  const byRelationship = await ctx.db
    .query("storageReferenceLedgerVerificationScopes")
    .withIndex("by_run_direction_source", (query) =>
      query.eq("runId", runId).eq("direction", direction).eq("source", source),
    )
    .take(2);
  const scope = assertSameUniqueRow(
    byKey,
    byRelationship,
    "STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT",
  );
  if (
    !scope ||
    scope.scopeKey !== scopeKey ||
    scope.sourceTable !== SOURCE_TABLES[source] ||
    scope.empty !== (scope.cutoffCreationTime === undefined) ||
    scope.empty !== (scope.cutoffDocumentId === undefined)
  ) {
    throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");
  }
  return scope;
}

async function readCheckpoint(
  ctx: DatabaseContext,
  runId: Id<"storageReferenceLedgerVerificationRuns">,
  direction: Direction,
  source: StorageReferenceSource,
): Promise<VerificationCheckpoint> {
  const checkpointKey = `${runId}:${direction}:${source}`;
  const byKey = await ctx.db
    .query("storageReferenceLedgerVerificationCheckpoints")
    .withIndex("by_checkpoint_key", (query) =>
      query.eq("checkpointKey", checkpointKey),
    )
    .take(2);
  const byRelationship = await ctx.db
    .query("storageReferenceLedgerVerificationCheckpoints")
    .withIndex("by_run_direction_source", (query) =>
      query.eq("runId", runId).eq("direction", direction).eq("source", source),
    )
    .take(2);
  const checkpoint = assertSameUniqueRow(
    byKey,
    byRelationship,
    "STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT",
  );
  if (!checkpoint || checkpoint.checkpointKey !== checkpointKey) {
    throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  }
  return checkpoint;
}

async function readCompletedBackfillCheckpoint(
  ctx: MutationCtx,
  source: StorageReferenceSource,
): Promise<Doc<"storageReferenceLedgerBackfillCheckpoints">> {
  const checkpointKey = `${BACKFILL_VERSION}:${source}`;
  const byKey = await ctx.db
    .query("storageReferenceLedgerBackfillCheckpoints")
    .withIndex("by_checkpoint_key", (query) =>
      query.eq("checkpointKey", checkpointKey),
    )
    .take(2);
  const bySource = await ctx.db
    .query("storageReferenceLedgerBackfillCheckpoints")
    .withIndex("by_source_version", (query) =>
      query.eq("source", source).eq("version", BACKFILL_VERSION),
    )
    .take(2);
  const checkpoint = assertSameUniqueRow(
    byKey,
    bySource,
    "STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT",
  );
  if (
    !checkpoint ||
    checkpoint.checkpointKey !== checkpointKey ||
    checkpoint.sourceTable !== SOURCE_TABLES[source] ||
    checkpoint.status !== "completed" ||
    checkpoint.completedAt === undefined ||
    checkpoint.cursor !== undefined ||
    checkpoint.blockedDocumentId !== undefined ||
    checkpoint.blockedReason !== undefined
  ) {
    throw new Error("STORAGE_REFERENCE_LEDGER_BACKFILL_INCOMPLETE");
  }
  return checkpoint;
}

async function latestSourceDocument(
  ctx: MutationCtx,
  source: StorageReferenceSource,
) {
  switch (source) {
    case "generations":
      return await ctx.db.query("generations").order("desc").first();
    case "gallery":
      return await ctx.db.query("gallery").order("desc").first();
    case "characters":
      return await ctx.db.query("characters").order("desc").first();
    case "durable_outputs":
      return await ctx.db
        .query("durableGenerationOutputs")
        .order("desc")
        .first();
    case "video_generations":
      return await ctx.db.query("videoGenerations").order("desc").first();
  }
}

async function readSourceDocument(
  ctx: MutationCtx,
  source: StorageReferenceSource,
  documentId: string,
): Promise<SourceDocument | undefined> {
  switch (source) {
    case "generations": {
      const id = ctx.db.normalizeId("generations", documentId);
      const row = id ? await ctx.db.get(id) : null;
      return row
        ? {
            documentId: row._id,
            creationTime: row._creationTime,
            ownerId: row.userId,
            references: [
              scalar("imageStorageId", row.imageStorageId),
              scalar("thumbnailStorageId", row.thumbnailStorageId),
              array("referenceImageIds", row.referenceImageIds),
            ],
          }
        : undefined;
    }
    case "gallery": {
      const id = ctx.db.normalizeId("gallery", documentId);
      const row = id ? await ctx.db.get(id) : null;
      return row
        ? {
            documentId: row._id,
            creationTime: row._creationTime,
            ownerId: row.userId,
            references: [
              scalar("imageStorageId", row.imageStorageId),
              scalar("thumbnailStorageId", row.thumbnailStorageId),
            ],
          }
        : undefined;
    }
    case "characters": {
      const id = ctx.db.normalizeId("characters", documentId);
      const row = id ? await ctx.db.get(id) : null;
      return row
        ? {
            documentId: row._id,
            creationTime: row._creationTime,
            ownerId: row.userId,
            references: [scalar("avatarStorageId", row.avatarStorageId)],
          }
        : undefined;
    }
    case "durable_outputs": {
      const id = ctx.db.normalizeId("durableGenerationOutputs", documentId);
      const row = id ? await ctx.db.get(id) : null;
      return row
        ? {
            documentId: row._id,
            creationTime: row._creationTime,
            ownerId: row.ownerId,
            references: [
              scalar("storageId", row.storageId),
              scalar("thumbnailStorageId", row.thumbnailStorageId),
            ],
          }
        : undefined;
    }
    case "video_generations": {
      const id = ctx.db.normalizeId("videoGenerations", documentId);
      const row = id ? await ctx.db.get(id) : null;
      return row
        ? {
            documentId: row._id,
            creationTime: row._creationTime,
            ownerId: row.userId,
            references: [
              scalar("videoStorageId", row.videoStorageId),
              scalar("thumbnailStorageId", row.thumbnailStorageId),
              array("referenceImageStorageIds", row.referenceImageStorageIds),
            ],
          }
        : undefined;
    }
  }
}

async function readSourcePage(
  ctx: MutationCtx,
  source: StorageReferenceSource,
  cutoffCreationTime: number,
  cutoffDocumentId: string,
  cursor: string | null,
  pageSize: number,
): Promise<VerificationPage & { page: readonly SourceDocument[] }> {
  const pagination = { cursor, numItems: pageSize };
  const inclusiveTerminalPage = <T extends { _id: string; _creationTime: number }>(
    result: { page: T[]; isDone: boolean },
  ) => {
    const bounded = inclusiveTerminalRows(
      result.page,
      cutoffCreationTime,
      cutoffDocumentId,
    );
    return {
      page: bounded.rows,
      isDone: result.isDone || bounded.reachedTerminal,
    };
  };
  switch (source) {
    case "generations": {
      const result = await ctx.db
        .query("generations")
        .withIndex("by_creation_time", (query) =>
          query.lte("_creationTime", cutoffCreationTime),
        )
        .order("asc")
        .paginate(pagination);
      const bounded = inclusiveTerminalPage(result);
      return {
        ...result,
        isDone: bounded.isDone,
        page: bounded.page.map((row) => ({
          documentId: row._id,
          creationTime: row._creationTime,
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
      const result = await ctx.db
        .query("gallery")
        .withIndex("by_creation_time", (query) =>
          query.lte("_creationTime", cutoffCreationTime),
        )
        .order("asc")
        .paginate(pagination);
      const bounded = inclusiveTerminalPage(result);
      return {
        ...result,
        isDone: bounded.isDone,
        page: bounded.page.map((row) => ({
          documentId: row._id,
          creationTime: row._creationTime,
          ownerId: row.userId,
          references: [
            scalar("imageStorageId", row.imageStorageId),
            scalar("thumbnailStorageId", row.thumbnailStorageId),
          ],
        })),
      };
    }
    case "characters": {
      const result = await ctx.db
        .query("characters")
        .withIndex("by_creation_time", (query) =>
          query.lte("_creationTime", cutoffCreationTime),
        )
        .order("asc")
        .paginate(pagination);
      const bounded = inclusiveTerminalPage(result);
      return {
        ...result,
        isDone: bounded.isDone,
        page: bounded.page.map((row) => ({
          documentId: row._id,
          creationTime: row._creationTime,
          ownerId: row.userId,
          references: [scalar("avatarStorageId", row.avatarStorageId)],
        })),
      };
    }
    case "durable_outputs": {
      const result = await ctx.db
        .query("durableGenerationOutputs")
        .withIndex("by_creation_time", (query) =>
          query.lte("_creationTime", cutoffCreationTime),
        )
        .order("asc")
        .paginate(pagination);
      const bounded = inclusiveTerminalPage(result);
      return {
        ...result,
        isDone: bounded.isDone,
        page: bounded.page.map((row) => ({
          documentId: row._id,
          creationTime: row._creationTime,
          ownerId: row.ownerId,
          references: [
            scalar("storageId", row.storageId),
            scalar("thumbnailStorageId", row.thumbnailStorageId),
          ],
        })),
      };
    }
    case "video_generations": {
      const result = await ctx.db
        .query("videoGenerations")
        .withIndex("by_creation_time", (query) =>
          query.lte("_creationTime", cutoffCreationTime),
        )
        .order("asc")
        .paginate(pagination);
      const bounded = inclusiveTerminalPage(result);
      return {
        ...result,
        isDone: bounded.isDone,
        page: bounded.page.map((row) => ({
          documentId: row._id,
          creationTime: row._creationTime,
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

async function readLedgerPage(
  ctx: MutationCtx,
  source: StorageReferenceSource,
  cutoffCreationTime: number,
  cutoffDocumentId: string,
  cursor: string | null,
  pageSize: number,
): Promise<VerificationPage & { page: readonly LedgerRow[] }> {
  const result = await ctx.db
    .query("storageReferenceLedger")
    .withIndex("by_source_creation", (query) =>
      query.eq("source", source).lte("_creationTime", cutoffCreationTime),
    )
    .order("asc")
    .paginate({ cursor, numItems: pageSize });
  const bounded = inclusiveTerminalRows(
    result.page,
    cutoffCreationTime,
    cutoffDocumentId,
  );
  return {
    ...result,
    page: bounded.rows,
    isDone: result.isDone || bounded.reachedTerminal,
  };
}

async function readDocumentLedgerRows(
  ctx: MutationCtx,
  source: StorageReferenceSource,
  documentId: string,
  cutoffCreationTime?: number,
): Promise<LedgerRow[]> {
  const limit = STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS[source];
  const query = ctx.db
    .query("storageReferenceLedger")
    .withIndex("by_source_document", (builder) =>
      builder.eq("source", source).eq("documentId", documentId),
    );
  const rows =
    cutoffCreationTime === undefined
      ? await query.take(limit + 1)
      : await query
          .filter((builder) =>
            builder.lte(builder.field("_creationTime"), cutoffCreationTime),
          )
          .take(limit + 1);
  if (rows.length > limit)
    comparisonError("LEDGER_DOCUMENT_OVERFLOW", documentId, rows[limit]._id);
  return rows;
}

function compareDocument(
  source: StorageReferenceSource,
  document: SourceDocument | undefined,
  ledgerRows: readonly LedgerRow[],
): { expected: ExpectedTuple[]; actual: ActualTuple[] } {
  const expected =
    document?.references.flatMap((reference) => {
      const limit = storageReferenceFieldLimit(source, reference.field);
      if (limit === undefined || reference.storageIds.length > limit) {
        comparisonError("SOURCE_DOCUMENT_OVERFLOW", document.documentId);
      }
      return reference.storageIds.map(
        (storageId, position): ExpectedTuple => [
          referenceKey(source, document.documentId, reference.field, position),
          storageId,
          reference.field,
          position,
          document.ownerId,
        ],
      );
    }) ?? [];
  if (expected.length > STORAGE_REFERENCE_SOURCE_TOTAL_LIMITS[source]) {
    comparisonError("SOURCE_DOCUMENT_OVERFLOW", document!.documentId);
  }

  const seenKeys = new Set<string>();
  const seenPositions = new Set<string>();
  const positionsByField = new Map<StorageReferenceField, number[]>();
  for (const row of ledgerRows) {
    const limit = storageReferenceFieldLimit(source, row.field);
    const positionKey = `${row.field}:${row.position}`;
    if (
      row.source !== source ||
      row.documentId !== (document?.documentId ?? row.documentId) ||
      limit === undefined ||
      !Number.isInteger(row.position) ||
      row.position < 0 ||
      row.position >= limit ||
      row.referenceKey !==
        referenceKey(source, row.documentId, row.field, row.position) ||
      seenKeys.has(row.referenceKey) ||
      seenPositions.has(positionKey) ||
      (row.origin !== "transactional_dual_write_v1" &&
        row.origin !== "historical_backfill_v1") ||
      !Number.isFinite(row.createdAt) ||
      !Number.isFinite(row.updatedAt) ||
      row.createdAt > row.updatedAt
    ) {
      comparisonError("LEDGER_ROW_CORRUPT", row.documentId, row._id);
    }
    seenKeys.add(row.referenceKey);
    seenPositions.add(positionKey);
    positionsByField.set(row.field, [
      ...(positionsByField.get(row.field) ?? []),
      row.position,
    ]);
  }
  for (const [field, positions] of positionsByField) {
    const sortedPositions = [...positions].sort((left, right) => left - right);
    const gapIndex = sortedPositions.findIndex(
      (position, index) => position !== index,
    );
    if (gapIndex >= 0) {
      const offendingPosition = sortedPositions[gapIndex];
      const offending = ledgerRows.find(
        (row) => row.field === field && row.position === offendingPosition,
      );
      comparisonError(
        "LEDGER_POSITION_GAP",
        offending?.documentId ?? document!.documentId,
        offending?._id,
      );
    }
  }

  const actual = ledgerRows.map(
    (row): ActualTuple => [
      row.referenceKey,
      row.storageId,
      row.field,
      row.position,
      row.ownerId,
      row._id,
      row.origin,
      row.createdAt,
      row.updatedAt,
    ],
  );
  if (!document) {
    if (ledgerRows.length > 0)
      comparisonError(
        "LEDGER_ONLY_ROW",
        ledgerRows[0].documentId,
        ledgerRows[0]._id,
      );
    return { expected, actual };
  }
  if (
    ledgerRows.length !== expected.length ||
    expected.some((tuple) => {
      const row = ledgerRows.find(
        (candidate) => candidate.referenceKey === tuple[0],
      );
      return (
        !row ||
        row.storageId !== tuple[1] ||
        row.field !== tuple[2] ||
        row.position !== tuple[3] ||
        row.ownerId !== tuple[4]
      );
    })
  ) {
    const missingExpected = expected.find(
      (tuple) =>
        !ledgerRows.some((row) => row.referenceKey === tuple[0]),
    );
    const offendingActual = ledgerRows.find((row) => {
      const tuple = expected.find(
        (candidate) => candidate[0] === row.referenceKey,
      );
      return (
        !tuple ||
        row.storageId !== tuple[1] ||
        row.field !== tuple[2] ||
        row.position !== tuple[3] ||
        row.ownerId !== tuple[4]
      );
    });
    comparisonError(
      "SOURCE_LEDGER_MISMATCH",
      document.documentId,
      missingExpected ? undefined : offendingActual?._id,
    );
  }
  return { expected, actual };
}

function errorCode(error: unknown): string {
  if (error instanceof VerificationComparisonError) return error.code;
  return error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "VERIFICATION_UNKNOWN_ERROR";
}

async function recordBlocked(
  ctx: MutationCtx,
  run: VerificationRun,
  checkpoint: VerificationCheckpoint,
  code: string,
  documentId?: string,
  ledgerRowId?: string,
) {
  const failureKey = `${checkpoint._id}:${checkpoint.nextPageOrdinal}:${code}:${documentId ?? ""}:${ledgerRowId ?? ""}`;
  const byKey = await ctx.db
    .query("storageReferenceLedgerVerificationFailures")
    .withIndex("by_failure_key", (query) => query.eq("failureKey", failureKey))
    .take(2);
  const byCheckpoint = await ctx.db
    .query("storageReferenceLedgerVerificationFailures")
    .withIndex("by_checkpoint_page", (query) =>
      query
        .eq("checkpointId", checkpoint._id)
        .eq("pageOrdinal", checkpoint.nextPageOrdinal),
    )
    .take(2);
  const existing = assertSameUniqueRow(
    byKey,
    byCheckpoint,
    "STORAGE_REFERENCE_LEDGER_VERIFICATION_FAILURE_CORRUPT",
  );
  if (!existing) {
    await ctx.db.insert("storageReferenceLedgerVerificationFailures", {
      failureKey,
      runId: run._id,
      checkpointId: checkpoint._id,
      pageOrdinal: checkpoint.nextPageOrdinal,
      code,
      documentId,
      ledgerRowId,
      createdAt: Date.now(),
    });
  }
  const now = Date.now();
  await ctx.db.patch(checkpoint._id, {
    status: "blocked",
    blockedCode: code,
    blockedDocumentId: documentId,
    blockedLedgerRowId: ledgerRowId,
    updatedAt: now,
  });
  await ctx.db.patch(run._id, { phase: "blocked", updatedAt: now });
  return {
    status: "blocked" as const,
    code,
    authoritative: false as const,
    physicalDeletionEnabled: false as const,
  };
}

export const initializeStorageReferenceLedgerVerification = internalMutation({
  args: { runKey: v.string() },
  returns: v.object({
    runKey: v.string(),
    phase: v.literal("source_scan"),
    ...safetyReturnValidator,
  }),
  handler: async (ctx, args) => {
    if (await readRun(ctx, args.runKey))
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_EXISTS");
    const states = await ctx.db
      .query("storageReferenceLedgerState")
      .withIndex("by_state_key", (query) => query.eq("stateKey", "global"))
      .take(2);
    if (states.length > 1 || (states[0] && states[0].status !== "collecting")) {
      throw new Error("STORAGE_REFERENCE_LEDGER_STATE_CORRUPT");
    }

    const bindings = [];
    for (const source of SOURCES) {
      bindings.push({
        source,
        backfill: await readCompletedBackfillCheckpoint(ctx, source),
        cutoff: await latestSourceDocument(ctx, source),
      });
    }

    const now = Date.now();
    const runId = await ctx.db.insert(
      "storageReferenceLedgerVerificationRuns",
      {
        runKey: args.runKey,
        version: VERSION,
        contractFingerprint,
        phase: "source_scan",
        startedAt: now,
        updatedAt: now,
        authoritative: false,
        physicalDeletionEnabled: false,
      },
    );
    for (const { source, backfill, cutoff } of bindings) {
      await ctx.db.insert("storageReferenceLedgerVerificationScopes", {
        scopeKey: `${runId}:source_to_ledger:${source}`,
        runId,
        direction: "source_to_ledger",
        source,
        sourceTable: SOURCE_TABLES[source],
        empty: !cutoff,
        cutoffDocumentId: cutoff?._id,
        cutoffCreationTime: cutoff?._creationTime,
        backfillCheckpointId: backfill._id,
        backfillVersion: BACKFILL_VERSION,
        backfillCompletedAt: backfill.completedAt,
      });
      for (const direction of DIRECTIONS) {
        const completed = direction === "source_to_ledger" && !cutoff;
        await ctx.db.insert("storageReferenceLedgerVerificationCheckpoints", {
          checkpointKey: `${runId}:${direction}:${source}`,
          runId,
          direction,
          source,
          status: completed ? "completed" : "running",
          nextPageOrdinal: 0,
          previousPageFingerprint: GENESIS_FINGERPRINT,
          pagesCompleted: 0,
          rowsScanned: 0,
          documentsCompared: 0,
          startedAt: now,
          updatedAt: now,
          completedAt: completed ? now : undefined,
        });
      }
    }
    return {
      runKey: args.runKey,
      phase: "source_scan" as const,
      authoritative: false as const,
      physicalDeletionEnabled: false as const,
    };
  },
});

export const runStorageReferenceLedgerVerificationPage = internalMutation({
  args: {
    runKey: v.string(),
    direction: directionValidator,
    source: storageReferenceSourceValidator,
    pageSize: v.number(),
  },
  returns: v.union(
    v.object({
      status: v.literal("blocked"),
      code: v.string(),
      ...safetyReturnValidator,
    }),
    v.object({
      status: checkpointStatusValidator,
      pagesCompleted: v.number(),
      ...safetyReturnValidator,
    }),
    v.object({
      status: checkpointStatusValidator,
      pageOrdinal: v.number(),
      pageFingerprint: v.string(),
      rowsScanned: v.number(),
      ...safetyReturnValidator,
    }),
  ),
  handler: async (ctx, args) => {
    assertPageSize(args.pageSize);
    const run = await readRun(ctx, args.runKey);
    if (!run)
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_NOT_FOUND");
    if (
      run.contractFingerprint !== contractFingerprint ||
      run.authoritative !== false ||
      run.physicalDeletionEnabled !== false
    )
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
    const checkpoint = await readCheckpoint(
      ctx,
      run._id,
      args.direction,
      args.source,
    );

    if (
      checkpoint.status !== "running" ||
      run.phase === "completed" ||
      run.phase === "blocked"
    ) {
      return {
        status: checkpoint.status,
        pagesCompleted: checkpoint.pagesCompleted,
        authoritative: false as const,
        physicalDeletionEnabled: false as const,
      };
    }
    const requiredPhase =
      args.direction === "source_to_ledger" ? "source_scan" : "ledger_scan";
    if (run.phase !== requiredPhase)
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_PHASE_MISMATCH");

    let scope: VerificationScope;
    try {
      scope = await readScope(ctx, run._id, args.direction, args.source);
    } catch (error: unknown) {
      return await recordBlocked(ctx, run, checkpoint, errorCode(error));
    }
    if (scope.cutoffCreationTime === undefined) {
      return await recordBlocked(ctx, run, checkpoint, "SCOPE_CUTOFF_MISSING");
    }

    const inputCursor = checkpoint.cursor ?? null;
    const observed: unknown[] = [];
    let currentDocumentId: string | undefined;
    let currentLedgerRowId: string | undefined;
    let result: VerificationPage;
    try {
      if (args.direction === "source_to_ledger") {
        result = await readSourcePage(
          ctx,
          args.source,
          scope.cutoffCreationTime,
          scope.cutoffDocumentId!,
          inputCursor,
          args.pageSize,
        );
        assertStablePage(result);
        for (const document of result.page as readonly SourceDocument[]) {
          currentDocumentId = document.documentId;
          currentLedgerRowId = undefined;
          const ledgerRows = await readDocumentLedgerRows(
            ctx,
            args.source,
            document.documentId,
          );
          const comparison = compareDocument(args.source, document, ledgerRows);
          observed.push([
            document.documentId,
            document.ownerId,
            comparison.expected,
            comparison.actual,
          ]);
        }
      } else {
        result = await readLedgerPage(
          ctx,
          args.source,
          scope.cutoffCreationTime,
          scope.cutoffDocumentId!,
          inputCursor,
          args.pageSize,
        );
        assertStablePage(result);
        for (const seed of result.page as readonly LedgerRow[]) {
          currentDocumentId = seed.documentId;
          currentLedgerRowId = seed._id;
          const document = await readSourceDocument(
            ctx,
            args.source,
            seed.documentId,
          );
          const ledgerRows = await readDocumentLedgerRows(
            ctx,
            args.source,
            seed.documentId,
            scope.cutoffCreationTime,
          );
          const comparison = compareDocument(args.source, document, ledgerRows);
          observed.push([
            seed._id,
            seed.documentId,
            document?.ownerId ?? null,
            comparison.expected,
            comparison.actual,
          ]);
        }
      }
    } catch (error: unknown) {
      const comparison =
        error instanceof VerificationComparisonError ? error : undefined;
      return await recordBlocked(
        ctx,
        run,
        checkpoint,
        errorCode(error),
        comparison?.documentId ?? currentDocumentId,
        comparison?.ledgerRowId ?? currentLedgerRowId,
      );
    }

    const payload = [
      VERSION,
      args.direction,
      args.source,
      [scope.empty, scope.cutoffDocumentId ?? null, scope.cutoffCreationTime],
      inputCursor,
      result.continueCursor,
      result.isDone,
      observed,
      // This page proves only the exact pairs observed by this bounded read.
      // It is not a global point-in-time snapshot and may become stale immediately.
      "exact",
    ];
    const pageFingerprint = canonicalHash([
      checkpoint.previousPageFingerprint,
      payload,
    ]);
    const evidenceKey = `${run._id}:${args.direction}:${args.source}:${checkpoint.nextPageOrdinal}`;
    const evidenceByKey = await ctx.db
      .query("storageReferenceLedgerVerificationEvidencePages")
      .withIndex("by_evidence_key", (query) =>
        query.eq("evidenceKey", evidenceKey),
      )
      .take(2);
    const evidenceByPage = await ctx.db
      .query("storageReferenceLedgerVerificationEvidencePages")
      .withIndex("by_checkpoint_page", (query) =>
        query
          .eq("checkpointId", checkpoint._id)
          .eq("pageOrdinal", checkpoint.nextPageOrdinal),
      )
      .take(2);
    if (evidenceByKey.length > 0 || evidenceByPage.length > 0) {
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_EVIDENCE_EXISTS");
    }

    const now = Date.now();
    await ctx.db.insert("storageReferenceLedgerVerificationEvidencePages", {
      evidenceKey,
      runId: run._id,
      checkpointId: checkpoint._id,
      direction: args.direction,
      source: args.source,
      pageOrdinal: checkpoint.nextPageOrdinal,
      previousFingerprint: checkpoint.previousPageFingerprint,
      pageFingerprint,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
    });
    const status = result.isDone
      ? ("completed" as const)
      : ("running" as const);
    await ctx.db.patch(checkpoint._id, {
      status,
      cursor: result.isDone ? undefined : result.continueCursor,
      nextPageOrdinal: checkpoint.nextPageOrdinal + 1,
      previousPageFingerprint: pageFingerprint,
      pagesCompleted: checkpoint.pagesCompleted + 1,
      rowsScanned: checkpoint.rowsScanned + result.page.length,
      documentsCompared: checkpoint.documentsCompared + observed.length,
      updatedAt: now,
      completedAt: result.isDone ? now : undefined,
    });
    return {
      status,
      pageOrdinal: checkpoint.nextPageOrdinal,
      pageFingerprint,
      rowsScanned: result.page.length,
      authoritative: false as const,
      physicalDeletionEnabled: false as const,
    };
  },
});

export const captureStorageReferenceLedgerVerificationCutoffs =
  internalMutation({
    args: { runKey: v.string() },
    returns: v.object({ phase: runPhaseValidator, ...safetyReturnValidator }),
    handler: async (ctx, args) => {
      const run = await readRun(ctx, args.runKey);
      if (!run)
        throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_NOT_FOUND");
      if (
        run.phase === "completed" ||
        run.phase === "blocked" ||
        run.phase === "ledger_scan"
      ) {
        return {
          phase: run.phase,
          authoritative: false as const,
          physicalDeletionEnabled: false as const,
        };
      }
      if (run.phase !== "source_scan")
        throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_PHASE_MISMATCH");
      for (const source of SOURCES) {
        if (
          (await readCheckpoint(ctx, run._id, "source_to_ledger", source))
            .status !== "completed"
        ) {
          throw new Error("SOURCE_VERIFICATION_INCOMPLETE");
        }
      }

      await ctx.db.patch(run._id, {
        phase: "ledger_cutoff",
        updatedAt: Date.now(),
      });
      for (const source of SOURCES) {
        const scopeKey = `${run._id}:ledger_to_source:${source}`;
        const existing = await ctx.db
          .query("storageReferenceLedgerVerificationScopes")
          .withIndex("by_scope_key", (query) => query.eq("scopeKey", scopeKey))
          .take(2);
        if (existing.length > 0)
          throw new Error("LEDGER_CUTOFF_ALREADY_CAPTURED");
        const cutoff = await ctx.db
          .query("storageReferenceLedger")
          .withIndex("by_source_creation", (query) =>
            query.eq("source", source),
          )
          .order("desc")
          .first();
        await ctx.db.insert("storageReferenceLedgerVerificationScopes", {
          scopeKey,
          runId: run._id,
          direction: "ledger_to_source",
          source,
          sourceTable: SOURCE_TABLES[source],
          empty: !cutoff,
          cutoffDocumentId: cutoff?._id,
          cutoffCreationTime: cutoff?._creationTime,
        });
        const checkpoint = await readCheckpoint(
          ctx,
          run._id,
          "ledger_to_source",
          source,
        );
        if (!cutoff) {
          const now = Date.now();
          await ctx.db.patch(checkpoint._id, {
            status: "completed",
            completedAt: now,
            updatedAt: now,
          });
        }
      }
      await ctx.db.patch(run._id, {
        phase: "ledger_scan",
        updatedAt: Date.now(),
      });
      return {
        phase: "ledger_scan" as const,
        authoritative: false as const,
        physicalDeletionEnabled: false as const,
      };
    },
  });

function finalizationBatchFingerprint(input: {
  runId: string;
  batchOrdinal: number;
  startCheckpointOrdinal: number;
  startPageOrdinal: number;
  endCheckpointOrdinal: number;
  endPageOrdinal: number;
  previousFingerprint: string;
  endFingerprint: string;
  evidencePageFingerprints: readonly string[];
}): string {
  return canonicalHash([
    VERSION,
    "finalization_batch",
    input.runId,
    input.batchOrdinal,
    input.startCheckpointOrdinal,
    input.startPageOrdinal,
    input.endCheckpointOrdinal,
    input.endPageOrdinal,
    input.previousFingerprint,
    input.endFingerprint,
    input.evidencePageFingerprints,
  ]);
}

async function readAndValidatePriorCommitment(
  ctx: DatabaseContext,
  run: VerificationRun,
) {
  const batchOrdinal = run.finalizationBatchOrdinal ?? 0;
  const previousFingerprint =
    run.finalizationPreviousCommitmentFingerprint ?? GENESIS_FINGERPRINT;
  if (batchOrdinal === 0) {
    if (previousFingerprint !== GENESIS_FINGERPRINT)
      throw new Error("VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED");
    return;
  }
  const expectedOrdinal = batchOrdinal - 1;
  const batchKey = `${run._id}:${expectedOrdinal}`;
  const byKey = await ctx.db
    .query("storageReferenceLedgerVerificationFinalizationCommitments")
    .withIndex("by_batch_key", (query) => query.eq("batchKey", batchKey))
    .take(2);
  const byRunBatch = await ctx.db
    .query("storageReferenceLedgerVerificationFinalizationCommitments")
    .withIndex("by_run_batch", (query) =>
      query.eq("runId", run._id).eq("batchOrdinal", expectedOrdinal),
    )
    .take(2);
  const commitment = assertSameUniqueRow(
    byKey,
    byRunBatch,
    "VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED",
  );
  if (
    !commitment ||
    commitment.batchKey !== batchKey ||
    commitment.runId !== run._id ||
    commitment.batchFingerprint !== previousFingerprint ||
    commitment.endCheckpointOrdinal !==
      (run.finalizationCheckpointOrdinal ?? 0) ||
    commitment.endPageOrdinal !== (run.finalizationPageOrdinal ?? 0) ||
    commitment.endFingerprint !==
      (run.finalizationPreviousFingerprint ?? GENESIS_FINGERPRINT) ||
    commitment.evidencePageFingerprints.length >
      MAX_FINALIZATION_EVIDENCE_PAGES ||
    (commitment.evidencePageFingerprints.length === 0 &&
      commitment.startCheckpointOrdinal === commitment.endCheckpointOrdinal &&
      commitment.startPageOrdinal === commitment.endPageOrdinal) ||
    commitment.batchFingerprint !==
      finalizationBatchFingerprint(commitment)
  ) {
    throw new Error("VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED");
  }
}

async function buildCanonicalVerificationManifest(
  ctx: DatabaseContext,
  runId: Id<"storageReferenceLedgerVerificationRuns">,
) {
  const checkpointFingerprints: string[] = [];
  const scopeManifest: unknown[] = [];
  for (const direction of DIRECTIONS) {
    for (const source of SOURCES) {
      const checkpoint = await readCheckpoint(ctx, runId, direction, source);
      const scope = await readScope(ctx, runId, direction, source);
      if (checkpoint.status !== "completed")
        throw new Error("VERIFICATION_CHECKPOINT_INCOMPLETE");
      checkpointFingerprints.push(checkpoint.previousPageFingerprint);
      scopeManifest.push([
        direction,
        source,
        scope.empty,
        scope.cutoffDocumentId ?? null,
        scope.cutoffCreationTime ?? null,
        checkpoint.pagesCompleted,
        checkpoint.rowsScanned,
        checkpoint.documentsCompared,
        checkpoint.previousPageFingerprint,
      ]);
    }
  }
  const scopeManifestJson = JSON.stringify(scopeManifest);
  return {
    checkpointFingerprints,
    scopeManifestJson,
    manifestFingerprint: canonicalHash([
      VERSION,
      contractFingerprint,
      scopeManifest,
      checkpointFingerprints,
    ]),
  };
}

export const finalizeStorageReferenceLedgerVerification = internalMutation({
  args: { runKey: v.string() },
  returns: v.union(
    v.object({
      result: v.literal("passed"),
      manifestFingerprint: v.string(),
      ...safetyReturnValidator,
    }),
    v.object({ result: v.literal("blocked"), ...safetyReturnValidator }),
    v.object({
      result: v.literal("running"),
      checkpointOrdinal: v.number(),
      pageOrdinal: v.number(),
      evidencePagesValidated: v.number(),
      ...safetyReturnValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const run = await readRun(ctx, args.runKey);
    if (!run)
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_NOT_FOUND");
    if (
      run.contractFingerprint !== contractFingerprint ||
      run.authoritative !== false ||
      run.physicalDeletionEnabled !== false
    )
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
    if (run.phase === "blocked")
      return {
        result: "blocked" as const,
        authoritative: false as const,
        physicalDeletionEnabled: false as const,
      };

    const attestationKey = `${run._id}:observed_pairs_passed`;
    const existingByKey = await ctx.db
      .query("storageReferenceLedgerVerificationAttestations")
      .withIndex("by_attestation_key", (query) =>
        query.eq("attestationKey", attestationKey),
      )
      .take(2);
    const existingByRun = await ctx.db
      .query("storageReferenceLedgerVerificationAttestations")
      .withIndex("by_run", (query) => query.eq("runId", run._id))
      .take(2);
    const existing = assertSameUniqueRow(
      existingByKey,
      existingByRun,
      "STORAGE_REFERENCE_LEDGER_VERIFICATION_ATTESTATION_CORRUPT",
    );
    if (run.phase === "completed") {
      if (!existing)
        throw new Error(
          "STORAGE_REFERENCE_LEDGER_VERIFICATION_ATTESTATION_CORRUPT",
        );
      await readAndValidatePriorCommitment(ctx, run);
      const canonical = await buildCanonicalVerificationManifest(ctx, run._id);
      if (
        existing.attestationKey !== attestationKey ||
        existing.runId !== run._id ||
        existing.attestationKind !== "observed_pairs_passed" ||
        existing.result !== "passed" ||
        existing.contractFingerprint !== contractFingerprint ||
        JSON.stringify(existing.checkpointFingerprints) !==
          JSON.stringify(canonical.checkpointFingerprints) ||
        existing.scopeManifestJson !== canonical.scopeManifestJson ||
        existing.manifestFingerprint !== canonical.manifestFingerprint ||
        existing.authoritative !== false ||
        existing.physicalDeletionEnabled !== false
      )
        throw new Error(
          "STORAGE_REFERENCE_LEDGER_VERIFICATION_ATTESTATION_CORRUPT",
        );
      return {
        result: "passed" as const,
        manifestFingerprint: existing.manifestFingerprint,
        authoritative: false as const,
        physicalDeletionEnabled: false as const,
      };
    }
    if (run.phase !== "ledger_scan" && run.phase !== "finalizing")
      throw new Error("STORAGE_REFERENCE_LEDGER_VERIFICATION_PHASE_MISMATCH");

    await readAndValidatePriorCommitment(ctx, run);

    let checkpointOrdinal = run.finalizationCheckpointOrdinal ?? 0;
    let pageOrdinal = run.finalizationPageOrdinal ?? 0;
    let previousFingerprint =
      run.finalizationPreviousFingerprint ?? GENESIS_FINGERPRINT;
    const startCheckpointOrdinal = checkpointOrdinal;
    const startPageOrdinal = pageOrdinal;
    const batchOrdinal = run.finalizationBatchOrdinal ?? 0;
    const previousCommitmentFingerprint =
      run.finalizationPreviousCommitmentFingerprint ?? GENESIS_FINGERPRINT;
    const evidencePageFingerprints: string[] = [];
    let evidencePagesValidated = 0;
    while (
      checkpointOrdinal < DIRECTIONS.length * SOURCES.length &&
      evidencePagesValidated < MAX_FINALIZATION_EVIDENCE_PAGES
    ) {
      const direction = DIRECTIONS[Math.floor(checkpointOrdinal / SOURCES.length)];
      const source = SOURCES[checkpointOrdinal % SOURCES.length];
      const checkpoint = await readCheckpoint(ctx, run._id, direction, source);
      if (checkpoint.status !== "completed")
        throw new Error("VERIFICATION_CHECKPOINT_INCOMPLETE");

      if (pageOrdinal === checkpoint.pagesCompleted) {
        // An exact lookup at the expected end rejects appended/duplicate ordinals
        // without scanning an unbounded chain.
        const trailing = await ctx.db
          .query("storageReferenceLedgerVerificationEvidencePages")
          .withIndex("by_checkpoint_page", (query) =>
            query
              .eq("checkpointId", checkpoint._id)
              .eq("pageOrdinal", pageOrdinal),
          )
          .take(2);
        if (
          trailing.length !== 0 ||
          previousFingerprint !== checkpoint.previousPageFingerprint
        )
          throw new Error("VERIFICATION_EVIDENCE_TAMPERED");
        checkpointOrdinal += 1;
        pageOrdinal = 0;
        previousFingerprint = GENESIS_FINGERPRINT;
        continue;
      }
      if (pageOrdinal > checkpoint.pagesCompleted)
        throw new Error("VERIFICATION_EVIDENCE_TAMPERED");

      const evidenceKey = `${run._id}:${direction}:${source}:${pageOrdinal}`;
      const byKey = await ctx.db
        .query("storageReferenceLedgerVerificationEvidencePages")
        .withIndex("by_evidence_key", (query) => query.eq("evidenceKey", evidenceKey))
        .take(2);
      const byPage = await ctx.db
        .query("storageReferenceLedgerVerificationEvidencePages")
        .withIndex("by_checkpoint_page", (query) =>
          query
            .eq("checkpointId", checkpoint._id)
            .eq("pageOrdinal", pageOrdinal),
        )
        .take(2);
      const evidence = assertSameUniqueRow(
        byKey,
        byPage,
        "VERIFICATION_EVIDENCE_TAMPERED",
      );
      try {
        if (
          !evidence ||
          evidence.runId !== run._id ||
          evidence.checkpointId !== checkpoint._id ||
          evidence.direction !== direction ||
          evidence.source !== source ||
          evidence.pageOrdinal !== pageOrdinal ||
          evidence.previousFingerprint !== previousFingerprint ||
          evidence.pageFingerprint !==
            canonicalHash([
              evidence.previousFingerprint,
              JSON.parse(evidence.payloadJson),
            ])
        )
          throw new Error("VERIFICATION_EVIDENCE_TAMPERED");
      } catch {
        throw new Error("VERIFICATION_EVIDENCE_TAMPERED");
      }
      previousFingerprint = evidence.pageFingerprint;
      evidencePageFingerprints.push(evidence.pageFingerprint);
      pageOrdinal += 1;
      evidencePagesValidated += 1;
    }

    const now = Date.now();
    let nextBatchOrdinal = batchOrdinal;
    let nextCommitmentFingerprint = previousCommitmentFingerprint;
    const advancedCoordinates =
      startCheckpointOrdinal !== checkpointOrdinal ||
      startPageOrdinal !== pageOrdinal;
    if (evidencePageFingerprints.length > 0 || advancedCoordinates) {
      const batchKey = `${run._id}:${batchOrdinal}`;
      const byKey = await ctx.db
        .query("storageReferenceLedgerVerificationFinalizationCommitments")
        .withIndex("by_batch_key", (query) => query.eq("batchKey", batchKey))
        .take(2);
      const byRunBatch = await ctx.db
        .query("storageReferenceLedgerVerificationFinalizationCommitments")
        .withIndex("by_run_batch", (query) =>
          query.eq("runId", run._id).eq("batchOrdinal", batchOrdinal),
        )
        .take(2);
      if (byKey.length > 0 || byRunBatch.length > 0)
        throw new Error("VERIFICATION_FINALIZATION_COMMITMENT_EXISTS");
      const commitment = {
        runId: run._id,
        batchOrdinal,
        startCheckpointOrdinal,
        startPageOrdinal,
        endCheckpointOrdinal: checkpointOrdinal,
        endPageOrdinal: pageOrdinal,
        previousFingerprint: previousCommitmentFingerprint,
        endFingerprint: previousFingerprint,
        evidencePageFingerprints,
      };
      const batchFingerprint = finalizationBatchFingerprint(commitment);
      await ctx.db.insert(
        "storageReferenceLedgerVerificationFinalizationCommitments",
        {
          batchKey,
          ...commitment,
          batchFingerprint,
          createdAt: now,
        },
      );
      nextBatchOrdinal += 1;
      nextCommitmentFingerprint = batchFingerprint;
    }
    if (checkpointOrdinal < DIRECTIONS.length * SOURCES.length) {
      await ctx.db.patch(run._id, {
        phase: "finalizing",
        finalizationCheckpointOrdinal: checkpointOrdinal,
        finalizationPageOrdinal: pageOrdinal,
        finalizationPreviousFingerprint: previousFingerprint,
        finalizationBatchOrdinal: nextBatchOrdinal,
        finalizationPreviousCommitmentFingerprint: nextCommitmentFingerprint,
        updatedAt: now,
      });
      return {
        result: "running" as const,
        checkpointOrdinal,
        pageOrdinal,
        evidencePagesValidated,
        authoritative: false as const,
        physicalDeletionEnabled: false as const,
      };
    }

    const manifest = await buildCanonicalVerificationManifest(ctx, run._id);
    if (existing) throw new Error("VERIFICATION_ATTESTATION_EXISTS");

    await ctx.db.insert("storageReferenceLedgerVerificationAttestations", {
      attestationKey,
      runId: run._id,
      // This names the narrow claim: all recorded bounded observations matched.
      // It does not assert a global snapshot or continuing truth.
      attestationKind: "observed_pairs_passed",
      result: "passed",
      contractFingerprint,
      checkpointFingerprints: manifest.checkpointFingerprints,
      scopeManifestJson: manifest.scopeManifestJson,
      manifestFingerprint: manifest.manifestFingerprint,
      createdAt: now,
      authoritative: false,
      physicalDeletionEnabled: false,
    });
    await ctx.db.patch(run._id, {
      phase: "completed",
      finalizationCheckpointOrdinal: checkpointOrdinal,
      finalizationPageOrdinal: pageOrdinal,
      finalizationPreviousFingerprint: previousFingerprint,
      finalizationBatchOrdinal: nextBatchOrdinal,
      finalizationPreviousCommitmentFingerprint: nextCommitmentFingerprint,
      updatedAt: now,
      completedAt: now,
    });
    return {
      result: "passed" as const,
      manifestFingerprint: manifest.manifestFingerprint,
      authoritative: false as const,
      physicalDeletionEnabled: false as const,
    };
  },
});

export const getStorageReferenceLedgerVerificationStatus = internalQuery({
  args: { runKey: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      runKey: v.string(),
      phase: runPhaseValidator,
      contractFingerprint: v.string(),
      ...safetyReturnValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const run = await readRun(ctx, args.runKey);
    return run
      ? {
          runKey: run.runKey,
          phase: run.phase,
          contractFingerprint: run.contractFingerprint,
          authoritative: false as const,
          physicalDeletionEnabled: false as const,
        }
      : null;
  },
});

export const __verificationTestOnly = {
  sha256,
  canonicalHash,
  contractFingerprint,
  inclusiveTerminalRows,
};
