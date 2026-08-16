import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { __verificationTestOnly } from "./storageReferenceLedgerVerification";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/!(*.*.*)*.*s");
type Harness = TestConvex<typeof schema>;
type Source = "generations" | "gallery" | "characters" | "durable_outputs" | "video_generations";
const sources: Source[] = ["generations", "gallery", "characters", "durable_outputs", "video_generations"];
const tables: Record<Source, string> = {
  generations: "generations", gallery: "gallery", characters: "characters",
  durable_outputs: "durableGenerationOutputs", video_generations: "videoGenerations",
};

type Status = {
  runKey: string;
  phase: string;
  backfillCheckpoints: Array<{ source: Source; status: string; pagesCompleted: number }>;
  verificationCheckpoints: Array<{ direction: string; source: Source; status: string }>;
  nextStep: { kind: string; source?: Source; direction?: string };
  authoritative: false;
  physicalDeletionEnabled: false;
};
type Advance = { kind: string; source?: Source; authoritative: false; physicalDeletionEnabled: false };
const status = makeFunctionReference<"query", { runKey: string }, Status>(
  "storageReferenceLedgerOperations:getStorageReferenceLedgerOperationStatus",
);
const advance = makeFunctionReference<"action", { runKey: string }, Advance>(
  "storageReferenceLedgerOperations:advanceStorageReferenceLedgerOperation",
);

async function completedBackfills(t: Harness, insertionOrder = [...sources].reverse()) {
  await t.run(async (ctx) => {
    for (const source of insertionOrder) await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", {
      checkpointKey: `historical_backfill_v1:${source}`, version: "historical_backfill_v1", source,
      sourceTable: tables[source], status: "completed", pagesCompleted: 0, documentsScanned: 0,
      documentsInserted: 0, documentsReplayed: 0, occurrencesInserted: 0, startedAt: 1,
      updatedAt: 2, completedAt: 2,
    });
  });
}

async function emptyRunAfterCutoff(t: Harness, runKey: string) {
  await completedBackfills(t);
  expect((await t.action(advance, { runKey })).kind).toBe("verification_initialized");
  expect((await t.action(advance, { runKey })).kind).toBe("ledger_cutoffs_captured");
}

async function verificationSnapshot(t: Harness) {
  return await t.run(async (ctx) => ({
    runs: await ctx.db.query("storageReferenceLedgerVerificationRuns").collect(),
    scopes: await ctx.db.query("storageReferenceLedgerVerificationScopes").collect(),
    checkpoints: await ctx.db.query("storageReferenceLedgerVerificationCheckpoints").collect(),
    evidence: await ctx.db.query("storageReferenceLedgerVerificationEvidencePages").collect(),
    failures: await ctx.db.query("storageReferenceLedgerVerificationFailures").collect(),
    commitments: await ctx.db
      .query("storageReferenceLedgerVerificationFinalizationCommitments")
      .collect(),
    attestations: await ctx.db
      .query("storageReferenceLedgerVerificationAttestations")
      .collect(),
  }));
}

describe("storage reference ledger operations", () => {
  it("uses canonical source ordering independent of insertion order", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (const source of [...sources].reverse().slice(0, 3)) await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", {
        checkpointKey: `historical_backfill_v1:${source}`, version: "historical_backfill_v1", source,
        sourceTable: tables[source], status: "completed", pagesCompleted: 0, documentsScanned: 0,
        documentsInserted: 0, documentsReplayed: 0, occurrencesInserted: 0, startedAt: 1, updatedAt: 2, completedAt: 2,
      });
    });
    const result = await t.query(status, { runKey: "order-1" });
    expect(result.backfillCheckpoints.map((row) => row.source)).toEqual(sources);
    expect(result.nextStep).toEqual({ kind: "backfill_page", source: "generations" });
  });

  it("one explicit advancement creates only the selected backfill checkpoint", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(advance, { runKey: "single-page" });
    expect(result.kind).toBe("backfill_page");
    expect(result.source).toBe("generations");
    const rows = await t.run((ctx) => ctx.db.query("storageReferenceLedgerBackfillCheckpoints").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("generations");
    expect(rows[0].status).toBe("completed");
  });

  it("blocked state is a read-only stable no-op", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) => ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", {
      checkpointKey: "historical_backfill_v1:generations", version: "historical_backfill_v1",
      source: "generations", sourceTable: "generations", status: "blocked", pagesCompleted: 0,
      documentsScanned: 0, documentsInserted: 0, documentsReplayed: 0, occurrencesInserted: 0,
      blockedReason: "CONFLICT", startedAt: 1, updatedAt: 2,
    }));
    const before = await t.run((ctx) => ctx.db.query("storageReferenceLedgerBackfillCheckpoints").collect());
    expect((await t.action(advance, { runKey: "blocked-1" })).kind).toBe("blocked");
    expect((await t.action(advance, { runKey: "blocked-1" })).kind).toBe("blocked");
    const after = await t.run((ctx) => ctx.db.query("storageReferenceLedgerBackfillCheckpoints").collect());
    expect(after).toEqual(before);
  });

  it("keeps a source-scan verification block with five scopes a stable read-only no-op", async () => {
    const t = convexTest(schema, modules);
    await completedBackfills(t);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["unledgered-avatar"])));
    await t.run((ctx) => ctx.db.insert("characters", {
      userId: "owner", name: "Unledgered", appearance: {}, avatarStorageId: storageId, createdAt: 1,
    }));
    expect((await t.action(advance, { runKey: "source-block" })).kind).toBe("verification_initialized");
    expect(await t.action(advance, { runKey: "source-block" })).toMatchObject({
      kind: "blocked", scope: "verification", source: "characters",
    });
    const before = await verificationSnapshot(t);
    expect(before.scopes).toHaveLength(5);
    expect((await t.query(status, { runKey: "source-block" })).nextStep).toEqual({ kind: "blocked" });
    expect((await t.query(status, { runKey: "source-block" })).nextStep).toEqual({ kind: "blocked" });
    expect((await t.action(advance, { runKey: "source-block" })).kind).toBe("blocked");
    expect((await t.action(advance, { runKey: "source-block" })).kind).toBe("blocked");
    expect(await verificationSnapshot(t)).toEqual(before);
  });

  it("initializes one exact run, then resumes at cutoff capture", async () => {
    const t = convexTest(schema, modules);
    await completedBackfills(t);
    expect((await t.action(advance, { runKey: "independent:A" })).kind).toBe("verification_initialized");
    const resumed = await t.query(status, { runKey: "independent:A" });
    expect(resumed.verificationCheckpoints.map((row) => [row.direction, row.source])).toEqual([
      ...sources.map((source) => ["source_to_ledger", source]),
      ...sources.map((source) => ["ledger_to_source", source]),
    ]);
    expect(resumed.nextStep.kind).toBe("capture_ledger_cutoffs");
    expect((await t.query(status, { runKey: "independent:B" })).nextStep.kind).toBe("verification_initialize");
    expect((await t.action(advance, { runKey: "independent:A" })).kind).toBe("ledger_cutoffs_captured");
    expect((await t.query(status, { runKey: "independent:A" })).nextStep.kind).toBe("finalize");
  });

  it.each(["", " leading", "trailing ", "slash/key", "é", "a".repeat(129)])(
    "rejects noncanonical run key %j before mutation", async (runKey) => {
      const t = convexTest(schema, modules);
      await expect(t.action(advance, { runKey })).rejects.toThrow("INVALID_STORAGE_REFERENCE_LEDGER_OPERATION_RUN_KEY");
      await expect(t.query(status, { runKey })).rejects.toThrow(
        "INVALID_STORAGE_REFERENCE_LEDGER_OPERATION_RUN_KEY",
      );
      expect(await t.run((ctx) => ctx.db.query("storageReferenceLedgerBackfillCheckpoints").collect())).toEqual([]);
    },
  );

  it("accepts the maximum-length canonical run key", async () => {
    const t = convexTest(schema, modules);
    expect(
      (await t.query(status, { runKey: "a".repeat(128) })).nextStep,
    ).toEqual({ kind: "backfill_page", source: "generations" });
  });

  it("fails closed on duplicate natural-key rows", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const base = { checkpointKey: "historical_backfill_v1:generations", version: "historical_backfill_v1" as const,
        source: "generations" as const, sourceTable: "generations", status: "completed" as const,
        pagesCompleted: 0, documentsScanned: 0, documentsInserted: 0, documentsReplayed: 0,
        occurrencesInserted: 0, startedAt: 1, updatedAt: 2, completedAt: 2 };
      await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", base);
      await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", base);
    });
    await expect(t.query(status, { runKey: "duplicate" })).rejects.toThrow("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
  });

  it("fails closed when ledger scan is selected before every source checkpoint completed", async () => {
    const t = convexTest(schema, modules);
    await emptyRunAfterCutoff(t, "incomplete-source");
    await t.run(async (ctx) => {
      const checkpoint = (await ctx.db.query("storageReferenceLedgerVerificationCheckpoints")
        .filter((q) => q.and(q.eq(q.field("direction"), "source_to_ledger"), q.eq(q.field("source"), "generations"))).unique())!;
      await ctx.db.patch(checkpoint._id, { status: "running", completedAt: undefined });
    });
    await expect(t.query(status, { runKey: "incomplete-source" })).rejects.toThrow(
      "STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT",
    );
  });

  it("accepts a blocked post-cutoff run with exactly ten validated scopes", async () => {
    const t = convexTest(schema, modules);
    await emptyRunAfterCutoff(t, "post-cutoff-block");
    await t.run(async (ctx) => {
      const run = (await ctx.db.query("storageReferenceLedgerVerificationRuns").unique())!;
      const checkpoint = (await ctx.db.query("storageReferenceLedgerVerificationCheckpoints")
        .filter((q) => q.and(q.eq(q.field("direction"), "ledger_to_source"), q.eq(q.field("source"), "characters"))).unique())!;
      await ctx.db.patch(checkpoint._id, {
        status: "blocked", blockedCode: "SOURCE_LEDGER_MISMATCH", completedAt: undefined,
      });
      await ctx.db.patch(run._id, { phase: "blocked" });
    });
    const before = await verificationSnapshot(t);
    expect(before.scopes).toHaveLength(10);
    expect((await t.query(status, { runKey: "post-cutoff-block" })).nextStep).toEqual({ kind: "blocked" });
    expect((await t.action(advance, { runKey: "post-cutoff-block" })).kind).toBe("blocked");
    expect(await verificationSnapshot(t)).toEqual(before);
  });

  it("rejects completed terminal coordinates unless every checkpoint is completed", async () => {
    const t = convexTest(schema, modules);
    await emptyRunAfterCutoff(t, "completed-incomplete");
    await t.run(async (ctx) => {
      const run = (await ctx.db.query("storageReferenceLedgerVerificationRuns").unique())!;
      const checkpoint = (await ctx.db.query("storageReferenceLedgerVerificationCheckpoints")
        .filter((q) => q.and(q.eq(q.field("direction"), "ledger_to_source"), q.eq(q.field("source"), "characters"))).unique())!;
      await ctx.db.patch(checkpoint._id, { status: "running", completedAt: undefined });
      await ctx.db.patch(run._id, {
        phase: "completed", completedAt: 3, finalizationCheckpointOrdinal: 10,
        finalizationPageOrdinal: 0, finalizationPreviousFingerprint: "0".repeat(64),
        finalizationBatchOrdinal: 1, finalizationPreviousCommitmentFingerprint: "a".repeat(64),
      });
    });
    await expect(t.query(status, { runKey: "completed-incomplete" })).rejects.toThrow(
      "STORAGE_REFERENCE_LEDGER_VERIFICATION_CHECKPOINT_CORRUPT",
    );
  });

  it.each([
    { name: "past checkpoint end", checkpointOrdinal: 0, pageOrdinal: 1, previous: "0".repeat(64), code: "VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED" },
    { name: "non-genesis checkpoint start", checkpointOrdinal: 0, pageOrdinal: 0, previous: "f".repeat(64), code: "VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED" },
    { name: "non-genesis terminal run", checkpointOrdinal: 10, pageOrdinal: 0, previous: "f".repeat(64), code: "STORAGE_REFERENCE_LEDGER_VERIFICATION_RUN_CORRUPT" },
  ])("rejects $name finalization coordinates", async ({ checkpointOrdinal, pageOrdinal, previous, code }) => {
    const t = convexTest(schema, modules);
    await emptyRunAfterCutoff(t, `coordinate-${checkpointOrdinal}-${pageOrdinal}-${previous[0]}`);
    await t.run(async (ctx) => {
      const run = (await ctx.db.query("storageReferenceLedgerVerificationRuns").unique())!;
      await ctx.db.patch(run._id, {
        phase: "finalizing", finalizationCheckpointOrdinal: checkpointOrdinal,
        finalizationPageOrdinal: pageOrdinal, finalizationPreviousFingerprint: previous,
        finalizationBatchOrdinal: 0, finalizationPreviousCommitmentFingerprint: "0".repeat(64),
      });
    });
    await expect(t.query(status, { runKey: `coordinate-${checkpointOrdinal}-${pageOrdinal}-${previous[0]}` }))
      .rejects.toThrow(code);
  });

  it("rejects impossible intermediate and mismatched terminal checkpoint coordinates", async () => {
    for (const [runKey, pageOrdinal, previous] of [
      ["coordinate-intermediate", 1, "a".repeat(64)],
      ["coordinate-terminal-mismatch", 2, "a".repeat(64)],
    ] as const) {
      const t = convexTest(schema, modules);
      await emptyRunAfterCutoff(t, runKey);
      await t.run(async (ctx) => {
        const run = (await ctx.db.query("storageReferenceLedgerVerificationRuns").unique())!;
        const checkpoint = (await ctx.db.query("storageReferenceLedgerVerificationCheckpoints")
          .filter((q) => q.and(q.eq(q.field("direction"), "source_to_ledger"), q.eq(q.field("source"), "generations"))).unique())!;
        await ctx.db.patch(checkpoint._id, {
          nextPageOrdinal: 2, pagesCompleted: 2, previousPageFingerprint: "b".repeat(64),
        });
        await ctx.db.patch(run._id, {
          phase: "finalizing", finalizationCheckpointOrdinal: 0, finalizationPageOrdinal: pageOrdinal,
          finalizationPreviousFingerprint: previous, finalizationBatchOrdinal: 1,
          finalizationPreviousCommitmentFingerprint: "c".repeat(64),
        });
      });
      await expect(t.query(status, { runKey })).rejects.toThrow(
        "VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED",
      );
    }
  });

  it("accepts a legitimate bounded mid-checkpoint finalization cursor", async () => {
    const t = convexTest(schema, modules);
    await emptyRunAfterCutoff(t, "coordinate-valid-intermediate");
    await t.run(async (ctx) => {
      const run = (await ctx.db.query("storageReferenceLedgerVerificationRuns").unique())!;
      const checkpoint = (await ctx.db
        .query("storageReferenceLedgerVerificationCheckpoints")
        .filter((query) =>
          query.and(
            query.eq(query.field("direction"), "source_to_ledger"),
            query.eq(query.field("source"), "generations"),
          ),
        )
        .unique())!;
      const payloadJson = "[]";
      const pageFingerprint = __verificationTestOnly.canonicalHash([
        "0".repeat(64),
        JSON.parse(payloadJson),
      ]);
      await ctx.db.patch(checkpoint._id, {
        nextPageOrdinal: 2,
        pagesCompleted: 2,
        previousPageFingerprint: "b".repeat(64),
      });
      await ctx.db.insert("storageReferenceLedgerVerificationEvidencePages", {
        evidenceKey: `${run._id}:source_to_ledger:generations:0`,
        runId: run._id,
        checkpointId: checkpoint._id,
        direction: "source_to_ledger",
        source: "generations",
        pageOrdinal: 0,
        previousFingerprint: "0".repeat(64),
        pageFingerprint,
        payloadJson,
        createdAt: 1,
      });
      const commitment = {
        runId: run._id,
        batchOrdinal: 0,
        startCheckpointOrdinal: 0,
        startPageOrdinal: 0,
        endCheckpointOrdinal: 0,
        endPageOrdinal: 1,
        previousFingerprint: "0".repeat(64),
        endFingerprint: pageFingerprint,
        evidencePageFingerprints: [pageFingerprint],
      };
      const batchFingerprint = __verificationTestOnly.canonicalHash([
        "source_ledger_verification_v1",
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
      ]);
      await ctx.db.insert(
        "storageReferenceLedgerVerificationFinalizationCommitments",
        {
          batchKey: `${run._id}:0`,
          ...commitment,
          batchFingerprint,
          createdAt: 1,
        },
      );
      await ctx.db.patch(run._id, {
        phase: "finalizing",
        finalizationCheckpointOrdinal: 0,
        finalizationPageOrdinal: 1,
        finalizationPreviousFingerprint: pageFingerprint,
        finalizationBatchOrdinal: 1,
        finalizationPreviousCommitmentFingerprint: batchFingerprint,
      });
    });
    expect(
      await t.query(status, { runKey: "coordinate-valid-intermediate" }),
    ).toMatchObject({ phase: "finalizing", nextStep: { kind: "finalize" } });
  });

  it("replays completed finalization and detects attestation tampering", async () => {
    const t = convexTest(schema, modules);
    await completedBackfills(t);
    await t.action(advance, { runKey: "terminal-replay" });
    await t.action(advance, { runKey: "terminal-replay" });
    expect((await t.action(advance, { runKey: "terminal-replay" })).kind).toBe("completed_replay_validated");
    expect((await t.action(advance, { runKey: "terminal-replay" })).kind).toBe("completed_replay_validated");
    await t.run(async (ctx) => {
      const attestation = await ctx.db.query("storageReferenceLedgerVerificationAttestations").unique();
      await ctx.db.patch(attestation!._id, { manifestFingerprint: "f".repeat(64) });
    });
    await expect(t.action(advance, { runKey: "terminal-replay" })).rejects.toThrow(
      "STORAGE_REFERENCE_LEDGER_VERIFICATION_ATTESTATION_CORRUPT",
    );
  });
});
