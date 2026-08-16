import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalAction, internalQuery } from "./_generated/server";
import { __verificationTestOnly } from "./storageReferenceLedgerVerification";
import {
  storageReferenceSourceValidator,
  type StorageReferenceSource,
} from "./storageReferenceContract";

const PAGE_SIZE = 16;
const BACKFILL_VERSION = "historical_backfill_v1" as const;
const VERIFICATION_VERSION = "source_ledger_verification_v1" as const;
const GENESIS_FINGERPRINT = "0".repeat(64);
const RUN_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

const SOURCES: readonly StorageReferenceSource[] = [
  "generations",
  "gallery",
  "characters",
  "durable_outputs",
  "video_generations",
];
const DIRECTIONS = ["source_to_ledger", "ledger_to_source"] as const;
type Direction = (typeof DIRECTIONS)[number];

const SOURCE_TABLES = {
  generations: "generations",
  gallery: "gallery",
  characters: "characters",
  durable_outputs: "durableGenerationOutputs",
  video_generations: "videoGenerations",
} as const satisfies Record<StorageReferenceSource, string>;

const safety = {
  authoritative: v.literal(false),
  physicalDeletionEnabled: v.literal(false),
} as const;
const directionValidator = v.union(
  v.literal("source_to_ledger"),
  v.literal("ledger_to_source"),
);
const checkpointStatusValidator = v.union(
  v.literal("absent"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("blocked"),
);
const phaseValidator = v.union(
  v.literal("not_initialized"),
  v.literal("source_scan"),
  v.literal("ledger_scan"),
  v.literal("finalizing"),
  v.literal("completed"),
  v.literal("blocked"),
);

const backfillSummaryValidator = v.object({
  source: storageReferenceSourceValidator,
  status: checkpointStatusValidator,
  pagesCompleted: v.number(),
  documentsScanned: v.number(),
  documentsInserted: v.number(),
  documentsReplayed: v.number(),
  occurrencesInserted: v.number(),
  blockedDocumentId: v.optional(v.string()),
  blockedReason: v.optional(v.string()),
});
const verificationSummaryValidator = v.object({
  direction: directionValidator,
  source: storageReferenceSourceValidator,
  status: v.union(v.literal("running"), v.literal("completed"), v.literal("blocked")),
  pagesCompleted: v.number(),
  rowsScanned: v.number(),
  documentsCompared: v.number(),
  previousPageFingerprint: v.string(),
  blockedCode: v.optional(v.string()),
  blockedDocumentId: v.optional(v.string()),
  blockedLedgerRowId: v.optional(v.string()),
});
const nextStepValidator = v.union(
  v.object({ kind: v.literal("backfill_page"), source: storageReferenceSourceValidator }),
  v.object({ kind: v.literal("verification_initialize") }),
  v.object({ kind: v.literal("verification_page"), direction: directionValidator, source: storageReferenceSourceValidator }),
  v.object({ kind: v.literal("capture_ledger_cutoffs") }),
  v.object({ kind: v.literal("finalize") }),
  v.object({ kind: v.literal("blocked") }),
);
const statusValidator = v.object({
  runKey: v.string(),
  phase: phaseValidator,
  backfillCheckpoints: v.array(backfillSummaryValidator),
  verificationCheckpoints: v.array(verificationSummaryValidator),
  nextStep: nextStepValidator,
  contractFingerprint: v.optional(v.string()),
  finalizationCheckpointOrdinal: v.optional(v.number()),
  finalizationPageOrdinal: v.optional(v.number()),
  finalizationBatchOrdinal: v.optional(v.number()),
  ...safety,
});

function corrupt(code: string): never {
  throw new Error(code);
}
function assertRunKey(runKey: string): void {
  if (!RUN_KEY.test(runKey)) corrupt("INVALID_STORAGE_REFERENCE_LEDGER_OPERATION_RUN_KEY");
}
function nonnegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
function finite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}
function exactUnique<T extends { _id: string }>(
  natural: readonly T[], relationship: readonly T[], code: string,
): T | undefined {
  if (natural.length > 1 || relationship.length > 1 || natural.length !== relationship.length ||
      (natural[0] && relationship[0] && natural[0]._id !== relationship[0]._id)) corrupt(code);
  return natural[0];
}

async function backfillCheckpoint(ctx: QueryCtx, source: StorageReferenceSource) {
  const key = `${BACKFILL_VERSION}:${source}`;
  const [byKey, bySource] = await Promise.all([
    ctx.db.query("storageReferenceLedgerBackfillCheckpoints")
      .withIndex("by_checkpoint_key", (q) => q.eq("checkpointKey", key)).take(2),
    ctx.db.query("storageReferenceLedgerBackfillCheckpoints")
      .withIndex("by_source_version", (q) => q.eq("source", source).eq("version", BACKFILL_VERSION)).take(2),
  ]);
  const row = exactUnique(byKey, bySource, "STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  if (!row) return undefined;
  const counters = [row.pagesCompleted, row.documentsScanned, row.documentsInserted,
    row.documentsReplayed, row.occurrencesInserted];
  if (row.checkpointKey !== key || row.version !== BACKFILL_VERSION || row.source !== source ||
      row.sourceTable !== SOURCE_TABLES[source] || counters.some((n) => !nonnegativeInteger(n)) ||
      !finite(row.startedAt) || !finite(row.updatedAt))
    corrupt("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  if (row.status === "running" && (!row.cutoffDocumentId || !finite(row.cutoffCreationTime) ||
      row.completedAt !== undefined || row.blockedReason !== undefined || row.blockedDocumentId !== undefined))
    corrupt("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  if (row.status === "completed" && (!finite(row.completedAt) || row.cursor !== undefined ||
      row.blockedReason !== undefined || row.blockedDocumentId !== undefined))
    corrupt("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  if (row.status === "blocked" && (!row.blockedReason || row.completedAt !== undefined))
    corrupt("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  return row;
}

async function verificationRun(ctx: QueryCtx, runKey: string) {
  const [byKey, byVersion] = await Promise.all([
    ctx.db.query("storageReferenceLedgerVerificationRuns")
      .withIndex("by_run_key", (q) => q.eq("runKey", runKey)).take(2),
    ctx.db.query("storageReferenceLedgerVerificationRuns")
      .withIndex("by_version_run_key", (q) => q.eq("version", VERIFICATION_VERSION).eq("runKey", runKey)).take(2),
  ]);
  const run = exactUnique(byKey, byVersion, "STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  if (!run) return undefined;
  if (run.runKey !== runKey || run.version !== VERIFICATION_VERSION ||
      run.contractFingerprint !== __verificationTestOnly.contractFingerprint ||
      run.authoritative !== false || run.physicalDeletionEnabled !== false ||
      !finite(run.startedAt) || !finite(run.updatedAt) || run.phase === "ledger_cutoff")
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  const coordinates = [run.finalizationCheckpointOrdinal, run.finalizationPageOrdinal,
    run.finalizationBatchOrdinal];
  if (coordinates.some((n) => n !== undefined && !nonnegativeInteger(n)) ||
      (run.finalizationCheckpointOrdinal !== undefined && run.finalizationCheckpointOrdinal > 10) ||
      (run.finalizationPreviousFingerprint !== undefined && !FINGERPRINT.test(run.finalizationPreviousFingerprint)) ||
      (run.finalizationPreviousCommitmentFingerprint !== undefined && !FINGERPRINT.test(run.finalizationPreviousCommitmentFingerprint)))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  const finalizationValues = [...coordinates, run.finalizationPreviousFingerprint,
    run.finalizationPreviousCommitmentFingerprint];
  const hasFinalization = finalizationValues.some((value) => value !== undefined);
  if ((run.phase === "source_scan" || run.phase === "ledger_scan" || run.phase === "blocked") && hasFinalization)
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  if ((run.phase === "finalizing" || run.phase === "completed") &&
      finalizationValues.some((value) => value === undefined)) corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  if (run.phase === "finalizing" && run.finalizationCheckpointOrdinal === 10)
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  if (run.phase === "completed" &&
      (run.finalizationCheckpointOrdinal !== 10 || run.finalizationPageOrdinal !== 0))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  if (run.phase === "completed" && !finite(run.completedAt)) corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  if (run.phase !== "completed" && run.completedAt !== undefined) corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
  return run;
}

async function scope(ctx: QueryCtx, runId: Id<"storageReferenceLedgerVerificationRuns">,
  direction: Direction, source: StorageReferenceSource) {
  const key = `${runId}:${direction}:${source}`;
  const [byKey, byRelation] = await Promise.all([
    ctx.db.query("storageReferenceLedgerVerificationScopes").withIndex("by_scope_key", (q) => q.eq("scopeKey", key)).take(2),
    ctx.db.query("storageReferenceLedgerVerificationScopes").withIndex("by_run_direction_source", (q) => q.eq("runId", runId).eq("direction", direction).eq("source", source)).take(2),
  ]);
  const row = exactUnique(byKey, byRelation, "STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");
  if (!row || row.scopeKey !== key || row.runId !== runId || row.direction !== direction || row.source !== source ||
      row.sourceTable !== SOURCE_TABLES[source] || row.empty !== (row.cutoffDocumentId === undefined) ||
      row.empty !== (row.cutoffCreationTime === undefined) || (!row.empty && !finite(row.cutoffCreationTime)))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");
  return row;
}

async function verificationCheckpoint(ctx: QueryCtx, runId: Id<"storageReferenceLedgerVerificationRuns">,
  direction: Direction, source: StorageReferenceSource) {
  const key = `${runId}:${direction}:${source}`;
  const [byKey, byRelation] = await Promise.all([
    ctx.db.query("storageReferenceLedgerVerificationCheckpoints").withIndex("by_checkpoint_key", (q) => q.eq("checkpointKey", key)).take(2),
    ctx.db.query("storageReferenceLedgerVerificationCheckpoints").withIndex("by_run_direction_source", (q) => q.eq("runId", runId).eq("direction", direction).eq("source", source)).take(2),
  ]);
  const row = exactUnique(byKey, byRelation, "STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  if (!row || row.checkpointKey !== key || row.runId !== runId || row.direction !== direction || row.source !== source ||
      [row.nextPageOrdinal, row.pagesCompleted, row.rowsScanned, row.documentsCompared].some((n) => !nonnegativeInteger(n)) ||
      row.nextPageOrdinal !== row.pagesCompleted || !FINGERPRINT.test(row.previousPageFingerprint) ||
      !finite(row.startedAt) || !finite(row.updatedAt)) corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  if (row.status === "completed" && (!finite(row.completedAt) || row.cursor !== undefined || row.blockedCode !== undefined))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  if (row.status === "running" && (row.completedAt !== undefined || row.blockedCode !== undefined ||
      row.blockedDocumentId !== undefined || row.blockedLedgerRowId !== undefined))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  if (row.status === "blocked" && (!row.blockedCode || row.completedAt !== undefined))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  return row;
}

type CheckedRun = NonNullable<Awaited<ReturnType<typeof verificationRun>>>;

async function validateFinalizationCommitment(
  ctx: QueryCtx,
  run: CheckedRun,
): Promise<void> {
  const batchOrdinal = run.finalizationBatchOrdinal!;
  const expectedFingerprint = run.finalizationPreviousCommitmentFingerprint!;
  if (batchOrdinal === 0) {
    if (
      expectedFingerprint !== GENESIS_FINGERPRINT ||
      run.finalizationCheckpointOrdinal !== 0 ||
      run.finalizationPageOrdinal !== 0 ||
      run.finalizationPreviousFingerprint !== GENESIS_FINGERPRINT
    ) {
      corrupt("VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED");
    }
    return;
  }
  const expectedOrdinal = batchOrdinal - 1;
  const batchKey = `${run._id}:${expectedOrdinal}`;
  const [byKey, byRunBatch] = await Promise.all([
    ctx.db
      .query("storageReferenceLedgerVerificationFinalizationCommitments")
      .withIndex("by_batch_key", (query) => query.eq("batchKey", batchKey))
      .take(2),
    ctx.db
      .query("storageReferenceLedgerVerificationFinalizationCommitments")
      .withIndex("by_run_batch", (query) =>
        query.eq("runId", run._id).eq("batchOrdinal", expectedOrdinal),
      )
      .take(2),
  ]);
  const commitment = exactUnique(
    byKey,
    byRunBatch,
    "VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED",
  );
  if (
    !commitment ||
    commitment.batchKey !== batchKey ||
    commitment.runId !== run._id ||
    commitment.batchOrdinal !== expectedOrdinal ||
    commitment.batchFingerprint !== expectedFingerprint ||
    commitment.endCheckpointOrdinal !== run.finalizationCheckpointOrdinal ||
    commitment.endPageOrdinal !== run.finalizationPageOrdinal ||
    commitment.endFingerprint !== run.finalizationPreviousFingerprint ||
    commitment.evidencePageFingerprints.length > 16 ||
    (commitment.evidencePageFingerprints.length === 0 &&
      commitment.startCheckpointOrdinal === commitment.endCheckpointOrdinal &&
      commitment.startPageOrdinal === commitment.endPageOrdinal) ||
    commitment.batchFingerprint !==
      __verificationTestOnly.canonicalHash([
        VERIFICATION_VERSION,
        "finalization_batch",
        commitment.runId,
        commitment.batchOrdinal,
        commitment.startCheckpointOrdinal,
        commitment.startPageOrdinal,
        commitment.endCheckpointOrdinal,
        commitment.endPageOrdinal,
        commitment.previousFingerprint,
        commitment.endFingerprint,
        commitment.evidencePageFingerprints,
      ])
  ) {
    corrupt("VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED");
  }
}

async function checkedVerificationState(ctx: QueryCtx, run: CheckedRun,
  backfills: readonly NonNullable<Awaited<ReturnType<typeof backfillCheckpoint>>>[]) {
  const storedScopes = await ctx.db.query("storageReferenceLedgerVerificationScopes")
    .withIndex("by_run", (q) => q.eq("runId", run._id)).take(11);
  const storedCheckpoints = await ctx.db.query("storageReferenceLedgerVerificationCheckpoints")
    .withIndex("by_run_status", (q) => q.eq("runId", run._id)).take(11);
  if (storedCheckpoints.length !== 10) corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  const scopeCount = storedScopes.length;
  if (scopeCount !== 5 && scopeCount !== 10)
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");
  if (run.phase === "source_scan" && scopeCount !== 5)
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");
  if (run.phase !== "source_scan" && run.phase !== "blocked" && scopeCount !== 10)
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");

  const summaries = [];
  for (const direction of DIRECTIONS) for (const sourceName of SOURCES) {
    const checkpoint = await verificationCheckpoint(ctx, run._id, direction, sourceName);
    const scopeRow = direction === "source_to_ledger" || scopeCount === 10
      ? await scope(ctx, run._id, direction, sourceName) : undefined;
    if (direction === "source_to_ledger") {
      const backfill = backfills[SOURCES.indexOf(sourceName)];
      if (!scopeRow || scopeRow.backfillCheckpointId !== backfill._id ||
          scopeRow.backfillVersion !== BACKFILL_VERSION || scopeRow.backfillCompletedAt !== backfill.completedAt)
        corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");
    } else if (scopeRow && (scopeRow.backfillCheckpointId !== undefined || scopeRow.backfillVersion !== undefined ||
        scopeRow.backfillCompletedAt !== undefined)) corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_SCOPE_CORRUPT");
    summaries.push(checkpoint);
  }
  const blocked = summaries.some((row) => row.status === "blocked");
  if ((run.phase === "blocked") !== blocked) corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_BLOCKED_STATE_CORRUPT");
  if ((run.phase === "finalizing" || run.phase === "completed") && summaries.some((row) => row.status !== "completed"))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  if ((run.phase === "ledger_scan" || run.phase === "finalizing" || run.phase === "completed") &&
      summaries.slice(0, 5).some((row) => row.status !== "completed"))
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  if (
    (run.phase === "source_scan" ||
      (run.phase === "blocked" && scopeCount === 5)) &&
    summaries.slice(5).some(
      (row) =>
        row.status !== "running" ||
        row.pagesCompleted !== 0 ||
        row.previousPageFingerprint !== GENESIS_FINGERPRINT,
    )
  ) {
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  }
  if (
    run.phase === "blocked" &&
    scopeCount === 10 &&
    summaries.slice(0, 5).some((row) => row.status !== "completed")
  ) {
    corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT");
  }
  if (run.phase === "finalizing" || run.phase === "completed") {
    await validateFinalizationCommitment(ctx, run);
    const checkpointOrdinal = run.finalizationCheckpointOrdinal!;
    const pageOrdinal = run.finalizationPageOrdinal!;
    const previousFingerprint = run.finalizationPreviousFingerprint!;
    if (checkpointOrdinal === 10) {
      if (pageOrdinal !== 0 || previousFingerprint !== GENESIS_FINGERPRINT ||
          summaries.some((row) => row.status !== "completed"))
        corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
    } else {
      const checkpoint = summaries[checkpointOrdinal];
      if (
        pageOrdinal > checkpoint.pagesCompleted ||
        (pageOrdinal === 0 && previousFingerprint !== GENESIS_FINGERPRINT) ||
        (pageOrdinal === checkpoint.pagesCompleted &&
          previousFingerprint !== checkpoint.previousPageFingerprint)
      ) {
        corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
      }
      if (pageOrdinal > 0 && pageOrdinal < checkpoint.pagesCompleted) {
        const expectedPageOrdinal = pageOrdinal - 1;
        const evidenceKey = `${run._id}:${checkpoint.direction}:${checkpoint.source}:${expectedPageOrdinal}`;
        const [byEvidenceKey, byCheckpointPage] = await Promise.all([
          ctx.db
            .query("storageReferenceLedgerVerificationEvidencePages")
            .withIndex("by_evidence_key", (query) =>
              query.eq("evidenceKey", evidenceKey),
            )
            .take(2),
          ctx.db
            .query("storageReferenceLedgerVerificationEvidencePages")
            .withIndex("by_checkpoint_page", (query) =>
              query
                .eq("checkpointId", checkpoint._id)
                .eq("pageOrdinal", expectedPageOrdinal),
            )
            .take(2),
        ]);
        const precedingEvidence = exactUnique(
          byEvidenceKey,
          byCheckpointPage,
          "STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT",
        );
        let recomputedFingerprint: string;
        try {
          recomputedFingerprint = __verificationTestOnly.canonicalHash([
            precedingEvidence?.previousFingerprint,
            JSON.parse(precedingEvidence?.payloadJson ?? ""),
          ]);
        } catch {
          corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
        }
        if (
          !precedingEvidence ||
          precedingEvidence.evidenceKey !== evidenceKey ||
          precedingEvidence.runId !== run._id ||
          precedingEvidence.checkpointId !== checkpoint._id ||
          precedingEvidence.direction !== checkpoint.direction ||
          precedingEvidence.source !== checkpoint.source ||
          precedingEvidence.pageOrdinal !== expectedPageOrdinal ||
          precedingEvidence.pageFingerprint !== previousFingerprint ||
          precedingEvidence.pageFingerprint !== recomputedFingerprint
        ) {
          corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
        }
      }
    }
  }
  return summaries;
}

type OperationStatus = {
  runKey: string;
  phase: "not_initialized" | "source_scan" | "ledger_scan" | "finalizing" | "completed" | "blocked";
  backfillCheckpoints: Array<{ source: StorageReferenceSource; status: "absent" | "running" | "completed" | "blocked"; pagesCompleted: number; documentsScanned: number; documentsInserted: number; documentsReplayed: number; occurrencesInserted: number; blockedDocumentId?: string; blockedReason?: string }>;
  verificationCheckpoints: Array<{ direction: Direction; source: StorageReferenceSource; status: "running" | "completed" | "blocked"; pagesCompleted: number; rowsScanned: number; documentsCompared: number; previousPageFingerprint: string; blockedCode?: string; blockedDocumentId?: string; blockedLedgerRowId?: string }>;
  nextStep: { kind: "backfill_page"; source: StorageReferenceSource } | { kind: "verification_initialize" } | { kind: "verification_page"; direction: Direction; source: StorageReferenceSource } | { kind: "capture_ledger_cutoffs" } | { kind: "finalize" } | { kind: "blocked" };
  contractFingerprint?: string; finalizationCheckpointOrdinal?: number; finalizationPageOrdinal?: number; finalizationBatchOrdinal?: number;
  authoritative: false; physicalDeletionEnabled: false;
};

export const getStorageReferenceLedgerOperationStatus = internalQuery({
  args: { runKey: v.string() }, returns: statusValidator,
  handler: async (ctx, { runKey }): Promise<OperationStatus> => {
    assertRunKey(runKey);
    const backfillRows = await Promise.all(SOURCES.map((sourceName) => backfillCheckpoint(ctx, sourceName)));
    const backfillCheckpoints = backfillRows.map((row, index) => ({
      source: SOURCES[index], status: row?.status ?? "absent" as const,
      pagesCompleted: row?.pagesCompleted ?? 0, documentsScanned: row?.documentsScanned ?? 0,
      documentsInserted: row?.documentsInserted ?? 0, documentsReplayed: row?.documentsReplayed ?? 0,
      occurrencesInserted: row?.occurrencesInserted ?? 0, blockedDocumentId: row?.blockedDocumentId,
      blockedReason: row?.blockedReason,
    }));
    const blockedBackfill = backfillRows.some((row) => row?.status === "blocked");
    const nextBackfill = backfillRows.findIndex((row) => !row || row.status === "running");
    if (blockedBackfill || nextBackfill >= 0) return {
      runKey, phase: blockedBackfill ? "blocked" : "not_initialized", backfillCheckpoints,
      verificationCheckpoints: [], nextStep: blockedBackfill ? { kind: "blocked" } : { kind: "backfill_page", source: SOURCES[nextBackfill] },
      authoritative: false, physicalDeletionEnabled: false,
    };
    if (backfillRows.some((row) => row?.status !== "completed")) corrupt("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
    const completedBackfills = backfillRows as NonNullable<(typeof backfillRows)[number]>[];
    const run = await verificationRun(ctx, runKey);
    if (!run) return { runKey, phase: "not_initialized", backfillCheckpoints, verificationCheckpoints: [],
      nextStep: { kind: "verification_initialize" }, authoritative: false, physicalDeletionEnabled: false };
    const phase = run.phase;
    if (phase === "ledger_cutoff") corrupt("STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT");
    const rows = await checkedVerificationState(ctx, run, completedBackfills);
    const verificationCheckpoints = rows.map((row) => ({ direction: row.direction, source: row.source,
      status: row.status, pagesCompleted: row.pagesCompleted, rowsScanned: row.rowsScanned,
      documentsCompared: row.documentsCompared, previousPageFingerprint: row.previousPageFingerprint,
      blockedCode: row.blockedCode, blockedDocumentId: row.blockedDocumentId, blockedLedgerRowId: row.blockedLedgerRowId }));
    let nextStep: OperationStatus["nextStep"];
    if (run.phase === "blocked") nextStep = { kind: "blocked" };
    else if (run.phase === "source_scan") {
      const next = rows.slice(0, 5).find((row) => row.status === "running");
      nextStep = next ? { kind: "verification_page", direction: "source_to_ledger", source: next.source } : { kind: "capture_ledger_cutoffs" };
    } else if (run.phase === "ledger_scan") {
      const next = rows.slice(5).find((row) => row.status === "running");
      nextStep = next ? { kind: "verification_page", direction: "ledger_to_source", source: next.source } : { kind: "finalize" };
    } else nextStep = { kind: "finalize" };
    return { runKey, phase, backfillCheckpoints, verificationCheckpoints, nextStep,
      contractFingerprint: run.contractFingerprint, finalizationCheckpointOrdinal: run.finalizationCheckpointOrdinal,
      finalizationPageOrdinal: run.finalizationPageOrdinal, finalizationBatchOrdinal: run.finalizationBatchOrdinal,
      authoritative: false, physicalDeletionEnabled: false };
  },
});

type BackfillResult = { source: StorageReferenceSource; status: "running" | "completed" | "blocked"; pagesCompleted: number; pageDocuments: number; pageOccurrencesInserted: number; pageReplayed: number; blockedReason?: string; authoritative: false; physicalDeletionEnabled: false };
type PageResult =
  | { status: "blocked"; code: string; authoritative: false; physicalDeletionEnabled: false }
  | { status: "running" | "completed" | "blocked"; pagesCompleted: number; authoritative: false; physicalDeletionEnabled: false }
  | { status: "running" | "completed" | "blocked"; pageOrdinal: number; pageFingerprint: string; rowsScanned: number; authoritative: false; physicalDeletionEnabled: false };
type FinalizeResult = { result: "passed"; manifestFingerprint: string; authoritative: false; physicalDeletionEnabled: false } | { result: "blocked"; authoritative: false; physicalDeletionEnabled: false } | { result: "running"; checkpointOrdinal: number; pageOrdinal: number; evidencePagesValidated: number; authoritative: false; physicalDeletionEnabled: false };
const statusReference = makeFunctionReference<"query", { runKey: string }, OperationStatus>("storageReferenceLedgerOperations:getStorageReferenceLedgerOperationStatus");
const backfillReference = makeFunctionReference<"mutation", { source: StorageReferenceSource; pageSize: number }, BackfillResult>("storageReferenceLedgerBackfill:runStorageReferenceLedgerBackfillPage");
const initializeReference = makeFunctionReference<"mutation", { runKey: string }, { runKey: string; phase: "source_scan"; authoritative: false; physicalDeletionEnabled: false }>("storageReferenceLedgerVerification:initializeStorageReferenceLedgerVerification");
const pageReference = makeFunctionReference<"mutation", { runKey: string; direction: Direction; source: StorageReferenceSource; pageSize: number }, PageResult>("storageReferenceLedgerVerification:runStorageReferenceLedgerVerificationPage");
const cutoffReference = makeFunctionReference<"mutation", { runKey: string }, { phase: "source_scan" | "ledger_cutoff" | "ledger_scan" | "finalizing" | "completed" | "blocked"; authoritative: false; physicalDeletionEnabled: false }>("storageReferenceLedgerVerification:captureStorageReferenceLedgerVerificationCutoffs");
const finalizeReference = makeFunctionReference<"mutation", { runKey: string }, FinalizeResult>("storageReferenceLedgerVerification:finalizeStorageReferenceLedgerVerification");

const advanceValidator = v.union(
  v.object({ kind: v.literal("backfill_page"), source: storageReferenceSourceValidator, status: v.union(v.literal("running"), v.literal("completed")), pagesCompleted: v.number(), pageDocuments: v.number(), pageOccurrencesInserted: v.number(), pageReplayed: v.number(), ...safety }),
  v.object({ kind: v.literal("verification_initialized"), runKey: v.string(), ...safety }),
  v.object({ kind: v.literal("source_page"), result: v.literal("processed_page"), source: storageReferenceSourceValidator, status: v.union(v.literal("running"), v.literal("completed")), pageOrdinal: v.number(), pageFingerprint: v.string(), rowsScanned: v.number(), ...safety }),
  v.object({ kind: v.literal("source_page"), result: v.literal("completed_race_replay"), source: storageReferenceSourceValidator, status: v.union(v.literal("running"), v.literal("completed")), pagesCompleted: v.number(), ...safety }),
  v.object({ kind: v.literal("ledger_cutoffs_captured"), phase: phaseValidator, ...safety }),
  v.object({ kind: v.literal("ledger_page"), result: v.literal("processed_page"), source: storageReferenceSourceValidator, status: v.union(v.literal("running"), v.literal("completed")), pageOrdinal: v.number(), pageFingerprint: v.string(), rowsScanned: v.number(), ...safety }),
  v.object({ kind: v.literal("ledger_page"), result: v.literal("completed_race_replay"), source: storageReferenceSourceValidator, status: v.union(v.literal("running"), v.literal("completed")), pagesCompleted: v.number(), ...safety }),
  v.object({ kind: v.literal("finalization_batch"), checkpointOrdinal: v.number(), pageOrdinal: v.number(), evidencePagesValidated: v.number(), ...safety }),
  v.object({ kind: v.literal("completed_replay_validated"), manifestFingerprint: v.string(), ...safety }),
  v.object({ kind: v.literal("blocked"), scope: v.union(v.literal("backfill"), v.literal("verification")), source: v.optional(storageReferenceSourceValidator), code: v.string(), ...safety }),
);

export const advanceStorageReferenceLedgerOperation = internalAction({
  args: { runKey: v.string() }, returns: advanceValidator,
  handler: async (ctx, { runKey }) => {
    assertRunKey(runKey);
    const status = await ctx.runQuery(statusReference, { runKey });
    const step = status.nextStep;
    if (step.kind === "blocked") {
      const backfill = status.backfillCheckpoints.find((row) => row.status === "blocked");
      const verification = status.verificationCheckpoints.find((row) => row.status === "blocked");
      return { kind: "blocked" as const, scope: backfill ? "backfill" as const : "verification" as const,
        source: backfill?.source ?? verification?.source,
        code: backfill?.blockedReason ?? verification?.blockedCode ?? "STORAGE_REFERENCE_LEDGER_OPERATION_BLOCKED",
        authoritative: false as const, physicalDeletionEnabled: false as const };
    }
    if (step.kind === "backfill_page") {
      const result = await ctx.runMutation(backfillReference, { source: step.source, pageSize: PAGE_SIZE });
      if (result.status === "blocked") return { kind: "blocked" as const, scope: "backfill" as const, source: step.source,
        code: result.blockedReason ?? "STORAGE_REFERENCE_LEDGER_BACKFILL_BLOCKED", authoritative: false as const, physicalDeletionEnabled: false as const };
      return { kind: "backfill_page" as const, source: step.source, status: result.status, pagesCompleted: result.pagesCompleted,
        pageDocuments: result.pageDocuments, pageOccurrencesInserted: result.pageOccurrencesInserted, pageReplayed: result.pageReplayed,
        authoritative: false as const, physicalDeletionEnabled: false as const };
    }
    if (step.kind === "verification_initialize") { await ctx.runMutation(initializeReference, { runKey });
      return { kind: "verification_initialized" as const, runKey, authoritative: false as const, physicalDeletionEnabled: false as const }; }
    if (step.kind === "capture_ledger_cutoffs") { const result = await ctx.runMutation(cutoffReference, { runKey });
      if (result.phase === "blocked") return { kind: "blocked" as const, scope: "verification" as const,
        code: "STORAGE_REFERENCE_LEDGER_VERIFICATION_BLOCKED", authoritative: false as const, physicalDeletionEnabled: false as const };
      return { kind: "ledger_cutoffs_captured" as const, phase: result.phase === "ledger_cutoff" ? "ledger_scan" as const : result.phase,
        authoritative: false as const, physicalDeletionEnabled: false as const }; }
    if (step.kind === "verification_page") { const result = await ctx.runMutation(pageReference, { runKey, direction: step.direction, source: step.source, pageSize: PAGE_SIZE });
      if (result.status === "blocked") return { kind: "blocked" as const, scope: "verification" as const, source: step.source,
        code: "code" in result ? result.code : "STORAGE_REFERENCE_LEDGER_VERIFICATION_BLOCKED", authoritative: false as const, physicalDeletionEnabled: false as const };
      if ("pagesCompleted" in result) return { kind: step.direction === "source_to_ledger" ? "source_page" as const : "ledger_page" as const,
        result: "completed_race_replay" as const, source: step.source, status: result.status, pagesCompleted: result.pagesCompleted,
        authoritative: false as const, physicalDeletionEnabled: false as const };
      return { kind: step.direction === "source_to_ledger" ? "source_page" as const : "ledger_page" as const, source: step.source,
        result: "processed_page" as const, status: result.status, pageOrdinal: result.pageOrdinal, pageFingerprint: result.pageFingerprint,
        rowsScanned: result.rowsScanned, authoritative: false as const, physicalDeletionEnabled: false as const }; }
    const result = await ctx.runMutation(finalizeReference, { runKey });
    if (result.result === "blocked") return { kind: "blocked" as const, scope: "verification" as const,
      code: "STORAGE_REFERENCE_LEDGER_VERIFICATION_BLOCKED", authoritative: false as const, physicalDeletionEnabled: false as const };
    if (result.result === "running") return { kind: "finalization_batch" as const, checkpointOrdinal: result.checkpointOrdinal,
      pageOrdinal: result.pageOrdinal, evidencePagesValidated: result.evidencePagesValidated, authoritative: false as const, physicalDeletionEnabled: false as const };
    return { kind: "completed_replay_validated" as const, manifestFingerprint: result.manifestFingerprint,
      authoritative: false as const, physicalDeletionEnabled: false as const };
  },
});
