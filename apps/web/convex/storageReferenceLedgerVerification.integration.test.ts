import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { __verificationTestOnly } from "./storageReferenceLedgerVerification";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/!(*.*.*)*.*s");
type Harness = TestConvex<typeof schema>;
type Source =
  | "generations"
  | "gallery"
  | "characters"
  | "durable_outputs"
  | "video_generations";
type PageResult =
  | {
      status: "blocked";
      code: string;
      authoritative: false;
      physicalDeletionEnabled: false;
    }
  | {
      status: "running" | "completed" | "blocked";
      pagesCompleted: number;
      authoritative: false;
      physicalDeletionEnabled: false;
    }
  | {
      status: "running" | "completed" | "blocked";
      pageOrdinal: number;
      pageFingerprint: string;
      rowsScanned: number;
      authoritative: false;
      physicalDeletionEnabled: false;
    };
type FinalizeResult =
  | {
      result: "passed";
      manifestFingerprint: string;
      authoritative: false;
      physicalDeletionEnabled: false;
    }
  | { result: "blocked"; authoritative: false; physicalDeletionEnabled: false }
  | {
      result: "running";
      checkpointOrdinal: number;
      pageOrdinal: number;
      evidencePagesValidated: number;
      authoritative: false;
      physicalDeletionEnabled: false;
    };

const init = makeFunctionReference<
  "mutation",
  { runKey: string },
  {
    runKey: string;
    phase: "source_scan";
    authoritative: false;
    physicalDeletionEnabled: false;
  }
>(
  "storageReferenceLedgerVerification:initializeStorageReferenceLedgerVerification",
);
const page = makeFunctionReference<
  "mutation",
  {
    runKey: string;
    direction: "source_to_ledger" | "ledger_to_source";
    source: Source;
    pageSize: number;
  },
  PageResult
>(
  "storageReferenceLedgerVerification:runStorageReferenceLedgerVerificationPage",
);
const cutoffs = makeFunctionReference<
  "mutation",
  { runKey: string },
  {
    phase:
      | "source_scan"
      | "ledger_cutoff"
      | "ledger_scan"
      | "finalizing"
      | "completed"
      | "blocked";
    authoritative: false;
    physicalDeletionEnabled: false;
  }
>(
  "storageReferenceLedgerVerification:captureStorageReferenceLedgerVerificationCutoffs",
);
const finalize = makeFunctionReference<
  "mutation",
  { runKey: string },
  FinalizeResult
>(
  "storageReferenceLedgerVerification:finalizeStorageReferenceLedgerVerification",
);
const sources: Source[] = [
  "generations",
  "gallery",
  "characters",
  "durable_outputs",
  "video_generations",
];
const tables: Record<Source, string> = {
  generations: "generations",
  gallery: "gallery",
  characters: "characters",
  durable_outputs: "durableGenerationOutputs",
  video_generations: "videoGenerations",
};

async function prerequisites(t: Harness) {
  await t.run(async (ctx) => {
    for (const source of sources)
      await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", {
        checkpointKey: `historical_backfill_v1:${source}`,
        version: "historical_backfill_v1",
        source,
        sourceTable: tables[source],
        status: "completed",
        pagesCompleted: 1,
        documentsScanned: 0,
        documentsInserted: 0,
        documentsReplayed: 0,
        occurrencesInserted: 0,
        startedAt: 1,
        updatedAt: 2,
        completedAt: 2,
      });
  });
}

async function drain(
  t: Harness,
  runKey: string,
  direction: "source_to_ledger" | "ledger_to_source",
  source: Source,
): Promise<PageResult> {
  let result = await t.mutation(page, {
    runKey,
    direction,
    source,
    pageSize: 16,
  });
  while (result.status === "running") {
    result = await t.mutation(page, {
      runKey,
      direction,
      source,
      pageSize: 16,
    });
  }
  return result;
}

async function completeDirection(
  t: Harness,
  runKey: string,
  direction: "source_to_ledger" | "ledger_to_source",
): Promise<void> {
  for (const source of sources) {
    expect((await drain(t, runKey, direction, source)).status).toBe(
      "completed",
    );
  }
}

async function drainWithPageSize(
  t: Harness,
  runKey: string,
  direction: "source_to_ledger" | "ledger_to_source",
  pageSize: number,
): Promise<void> {
  for (const source of sources) {
    let result = await t.mutation(page, { runKey, direction, source, pageSize });
    while (result.status === "running")
      result = await t.mutation(page, { runKey, direction, source, pageSize });
    expect(result.status).toBe("completed");
  }
}

async function seedCharacterPairs(t: Harness, count: number): Promise<void> {
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["bounded-finalization"])),
  );
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      const documentId = await ctx.db.insert("characters", {
        userId: "owner",
        name: `Bounded ${index}`,
        appearance: {},
        avatarStorageId: storageId,
        createdAt: index + 1,
      });
      await ctx.db.insert("storageReferenceLedger", {
        referenceKey: JSON.stringify([
          "characters",
          documentId,
          "avatarStorageId",
          0,
        ]),
        storageId,
        source: "characters",
        documentId,
        field: "avatarStorageId",
        position: 0,
        ownerId: "owner",
        origin: "historical_backfill_v1",
        createdAt: index + 1,
        updatedAt: index + 1,
      });
    }
  });
}

async function completeRun(t: Harness, runKey: string): Promise<FinalizeResult> {
  await t.mutation(init, { runKey });
  await completeDirection(t, runKey, "source_to_ledger");
  await t.mutation(cutoffs, { runKey });
  await completeDirection(t, runKey, "ledger_to_source");
  let result = await t.mutation(finalize, { runKey });
  while (result.result === "running")
    result = await t.mutation(finalize, { runKey });
  return result;
}

describe("resumable storage-reference ledger verification", () => {
  it("bounds finalization to 16 evidence pages per call and completes across calls", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    await seedCharacterPairs(t, 18);
    await t.mutation(init, { runKey: "bounded-finalize" });
    await drainWithPageSize(t, "bounded-finalize", "source_to_ledger", 1);
    await t.mutation(cutoffs, { runKey: "bounded-finalize" });
    await drainWithPageSize(t, "bounded-finalize", "ledger_to_source", 1);

    const results: FinalizeResult[] = [];
    let result = await t.mutation(finalize, { runKey: "bounded-finalize" });
    results.push(result);
    while (result.result === "running") {
      expect(result.evidencePagesValidated).toBeLessThanOrEqual(16);
      result = await t.mutation(finalize, { runKey: "bounded-finalize" });
      results.push(result);
    }
    expect(results.length).toBeGreaterThan(1);
    expect(results[0]).toMatchObject({
      result: "running",
      evidencePagesValidated: 16,
      checkpointOrdinal: 2,
      pageOrdinal: 16,
    });
    expect(result).toMatchObject({ result: "passed", authoritative: false });
    expect(await t.mutation(finalize, { runKey: "bounded-finalize" })).toEqual(
      result,
    );
    const attestations = await t.run((ctx) =>
      ctx.db.query("storageReferenceLedgerVerificationAttestations").collect(),
    );
    expect(attestations).toHaveLength(1);
    expect(attestations[0]).toMatchObject({
      attestationKind: "observed_pairs_passed",
      authoritative: false,
    });
  });

  it("detects middle-chain tampering without advancing finalization past it", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    await seedCharacterPairs(t, 18);
    await t.mutation(init, { runKey: "middle-tamper" });
    await drainWithPageSize(t, "middle-tamper", "source_to_ledger", 1);
    await t.mutation(cutoffs, { runKey: "middle-tamper" });
    await drainWithPageSize(t, "middle-tamper", "ledger_to_source", 1);

    expect(await t.mutation(finalize, { runKey: "middle-tamper" })).toMatchObject({
      result: "running",
      checkpointOrdinal: 2,
      pageOrdinal: 16,
    });
    await t.run(async (ctx) => {
      const run = (await ctx.db
        .query("storageReferenceLedgerVerificationRuns")
        .withIndex("by_run_key", (query) => query.eq("runKey", "middle-tamper"))
        .unique())!;
      const checkpoint = (await ctx.db
        .query("storageReferenceLedgerVerificationCheckpoints")
        .withIndex("by_run_direction_source", (query) =>
          query
            .eq("runId", run._id)
            .eq("direction", "source_to_ledger")
            .eq("source", "characters"),
        )
        .unique())!;
      const evidence = (await ctx.db
        .query("storageReferenceLedgerVerificationEvidencePages")
        .withIndex("by_checkpoint_page", (query) =>
          query.eq("checkpointId", checkpoint._id).eq("pageOrdinal", 17),
        )
        .unique())!;
      await ctx.db.patch(evidence._id, { payloadJson: "[]" });
    });
    await expect(
      t.mutation(finalize, { runKey: "middle-tamper" }),
    ).rejects.toThrow("VERIFICATION_EVIDENCE_TAMPERED");
    const run = await t.run((ctx) =>
      ctx.db
        .query("storageReferenceLedgerVerificationRuns")
        .withIndex("by_run_key", (query) => query.eq("runKey", "middle-tamper"))
        .unique(),
    );
    expect(run).toMatchObject({
      phase: "finalizing",
      finalizationCheckpointOrdinal: 2,
      finalizationPageOrdinal: 16,
    });
  });

  it("chains multipage evidence in both directions and emits only a non-authoritative passed attestation", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["avatar"])),
    );
    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        const id = await ctx.db.insert("characters", {
          userId: "owner",
          name: `C${i}`,
          appearance: {},
          avatarStorageId: storageId,
          createdAt: i,
        });
        await ctx.db.insert("storageReferenceLedger", {
          referenceKey: JSON.stringify([
            "characters",
            id,
            "avatarStorageId",
            0,
          ]),
          storageId,
          source: "characters",
          documentId: id,
          field: "avatarStorageId",
          position: 0,
          ownerId: "owner",
          origin: "historical_backfill_v1",
          createdAt: 10 + i,
          updatedAt: 10 + i,
        });
      }
    });
    expect(await t.mutation(init, { runKey: "happy" })).toMatchObject({
      phase: "source_scan",
      authoritative: false,
      physicalDeletionEnabled: false,
    });
    expect(
      await t.mutation(page, {
        runKey: "happy",
        direction: "source_to_ledger",
        source: "characters",
        pageSize: 1,
      }),
    ).toMatchObject({ status: "running", rowsScanned: 1 });
    let sourceResult = await t.mutation(page, {
      runKey: "happy",
      direction: "source_to_ledger",
      source: "characters",
      pageSize: 2,
    });
    while (sourceResult.status === "running")
      sourceResult = await t.mutation(page, {
        runKey: "happy",
        direction: "source_to_ledger",
        source: "characters",
        pageSize: 2,
      });
    await t.mutation(cutoffs, { runKey: "happy" });
    let ledgerResult = await t.mutation(page, {
      runKey: "happy",
      direction: "ledger_to_source",
      source: "characters",
      pageSize: 2,
    });
    while (ledgerResult.status === "running")
      ledgerResult = await t.mutation(page, {
        runKey: "happy",
        direction: "ledger_to_source",
        source: "characters",
        pageSize: 2,
      });
    const passed = await t.mutation(finalize, { runKey: "happy" });
    expect(passed).toMatchObject({
      result: "passed",
      authoritative: false,
      physicalDeletionEnabled: false,
    });
    if (passed.result === "passed") {
      expect(passed.manifestFingerprint).toMatch(/^[0-9a-f]{64}$/);
    }
    const snapshot = await t.run(async (ctx) => ({
      scopes: await ctx.db
        .query("storageReferenceLedgerVerificationScopes")
        .collect(),
      checkpoints: await ctx.db
        .query("storageReferenceLedgerVerificationCheckpoints")
        .collect(),
      evidence: await ctx.db
        .query("storageReferenceLedgerVerificationEvidencePages")
        .collect(),
      attestations: await ctx.db
        .query("storageReferenceLedgerVerificationAttestations")
        .collect(),
      ledger: await ctx.db.query("storageReferenceLedger").collect(),
      storage: await ctx.db.system.query("_storage").collect(),
    }));
    expect(snapshot.scopes).toHaveLength(10);
    expect(snapshot.checkpoints).toHaveLength(10);
    expect(snapshot.evidence.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.attestations).toHaveLength(1);
    expect(snapshot.ledger).toHaveLength(3);
    expect(snapshot.storage).toHaveLength(1);
  });

  it("detects a ledger-only row, appends one failure, and never advances the checkpoint", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(init, { runKey: "corrupt" });
    await t.run((ctx) =>
      ctx.db.insert("storageReferenceLedger", {
        referenceKey: JSON.stringify([
          "characters",
          "not-a-character-id",
          "avatarStorageId",
          0,
        ]),
        storageId,
        source: "characters",
        documentId: "not-a-character-id",
        field: "avatarStorageId",
        position: 0,
        ownerId: "owner",
        origin: "historical_backfill_v1",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await t.mutation(cutoffs, { runKey: "corrupt" });
    const result = await t.mutation(page, {
      runKey: "corrupt",
      direction: "ledger_to_source",
      source: "characters",
      pageSize: 16,
    });
    expect(result).toMatchObject({
      status: "blocked",
      code: "LEDGER_ONLY_ROW",
      authoritative: false,
      physicalDeletionEnabled: false,
    });
    const state = await t.run(async (ctx) => {
      const run = (await ctx.db
        .query("storageReferenceLedgerVerificationRuns")
        .first())!;
      return {
        failures: await ctx.db
          .query("storageReferenceLedgerVerificationFailures")
          .collect(),
        cp: await ctx.db
          .query("storageReferenceLedgerVerificationCheckpoints")
          .withIndex("by_run_status", (q) =>
            q.eq("runId", run._id).eq("status", "blocked"),
          )
          .first(),
      };
    });
    expect(state.failures).toHaveLength(1);
    expect(state.cp).toMatchObject({
      pagesCompleted: 0,
      nextPageOrdinal: 0,
      previousPageFingerprint: "0".repeat(64),
    });
  });

  it("excludes seed rows and complete-document rows after the ledger cutoff", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["cutoff"])),
    );
    const documentId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("characters", {
        userId: "owner",
        name: "Before cutoff",
        appearance: {},
        avatarStorageId: storageId,
        createdAt: 1,
      });
      await ctx.db.insert("storageReferenceLedger", {
        referenceKey: JSON.stringify(["characters", id, "avatarStorageId", 0]),
        storageId,
        source: "characters",
        documentId: id,
        field: "avatarStorageId",
        position: 0,
        ownerId: "owner",
        origin: "historical_backfill_v1",
        createdAt: 1,
        updatedAt: 1,
      });
      return id;
    });
    await t.mutation(init, { runKey: "cutoff" });
    await completeDirection(t, "cutoff", "source_to_ledger");
    await t.mutation(cutoffs, { runKey: "cutoff" });

    await t.run(async (ctx) => {
      await ctx.db.insert("storageReferenceLedger", {
        referenceKey: JSON.stringify([
          "characters",
          documentId,
          "avatarStorageId",
          0,
        ]),
        storageId,
        source: "characters",
        documentId,
        field: "avatarStorageId",
        position: 0,
        ownerId: "tampered-after-cutoff",
        origin: "historical_backfill_v1",
        createdAt: 2,
        updatedAt: 2,
      });
      await ctx.db.insert("storageReferenceLedger", {
        referenceKey: JSON.stringify([
          "characters",
          "ledger-only-after-cutoff",
          "avatarStorageId",
          0,
        ]),
        storageId,
        source: "characters",
        documentId: "ledger-only-after-cutoff",
        field: "avatarStorageId",
        position: 0,
        ownerId: "owner",
        origin: "historical_backfill_v1",
        createdAt: 2,
        updatedAt: 2,
      });
    });

    expect(
      await drain(t, "cutoff", "ledger_to_source", "characters"),
    ).toMatchObject({
      status: "completed",
      rowsScanned: 1,
    });
  });

  it("records the exact second document and seed row when its comparison fails", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    const expectedStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["expected"])),
    );
    const wrongStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["wrong"])),
    );
    const ids = await t.run(async (ctx) => {
      const inserted: Array<{ documentId: string; ledgerRowId: string }> = [];
      for (const name of ["first", "second"]) {
        const documentId = await ctx.db.insert("characters", {
          userId: "owner",
          name,
          appearance: {},
          avatarStorageId: expectedStorageId,
          createdAt: 1,
        });
        const ledgerRowId = await ctx.db.insert("storageReferenceLedger", {
          referenceKey: JSON.stringify([
            "characters",
            documentId,
            "avatarStorageId",
            0,
          ]),
          storageId: expectedStorageId,
          source: "characters",
          documentId,
          field: "avatarStorageId",
          position: 0,
          ownerId: "owner",
          origin: "historical_backfill_v1",
          createdAt: 1,
          updatedAt: 1,
        });
        inserted.push({ documentId, ledgerRowId });
      }
      return inserted;
    });
    await t.mutation(init, { runKey: "second-offender" });
    await completeDirection(t, "second-offender", "source_to_ledger");
    await t.mutation(cutoffs, { runKey: "second-offender" });
    await t.run((ctx) =>
      ctx.db.patch(ctx.db.normalizeId("characters", ids[1].documentId)!, {
        avatarStorageId: wrongStorageId,
      }),
    );

    expect(
      await t.mutation(page, {
        runKey: "second-offender",
        direction: "ledger_to_source",
        source: "characters",
        pageSize: 16,
      }),
    ).toMatchObject({ status: "blocked", code: "SOURCE_LEDGER_MISMATCH" });
    const state = await t.run(async (ctx) => ({
      failure: await ctx.db
        .query("storageReferenceLedgerVerificationFailures")
        .unique(),
    }));
    expect(state.failure).toMatchObject({
      documentId: ids[1].documentId,
      ledgerRowId: ids[1].ledgerRowId,
      pageOrdinal: 0,
    });
    expect(state.failure?.checkpointId).toBeDefined();
    const checkpoint = await t.run((ctx) =>
      ctx.db.get(state.failure!.checkpointId),
    );
    expect(checkpoint).toMatchObject({
      blockedDocumentId: ids[1].documentId,
      blockedLedgerRowId: ids[1].ledgerRowId,
      pagesCompleted: 0,
      nextPageOrdinal: 0,
      previousPageFingerprint: "0".repeat(64),
    });
    expect(
      await t.mutation(page, {
        runKey: "second-offender",
        direction: "ledger_to_source",
        source: "characters",
        pageSize: 16,
      }),
    ).toMatchObject({ status: "blocked", pagesCompleted: 0 });
    expect(
      await t.run(
        async (ctx) =>
          (
            await ctx.db
              .query("storageReferenceLedgerVerificationFailures")
              .collect()
          ).length,
      ),
    ).toBe(1);
  });

  it("identifies the first excess ledger row on document overflow", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(init, { runKey: "overflow-identity" });
    const ledgerRowIds = await t.run(async (ctx) => {
      const ids: string[] = [];
      for (let index = 0; index < 2; index += 1)
        ids.push(
          await ctx.db.insert("storageReferenceLedger", {
            referenceKey: JSON.stringify([
              "characters",
              "missing-character",
              "avatarStorageId",
              0,
            ]),
            storageId,
            source: "characters",
            documentId: "missing-character",
            field: "avatarStorageId",
            position: 0,
            ownerId: "owner",
            origin: "historical_backfill_v1",
            createdAt: index,
            updatedAt: index,
          }),
        );
      return ids;
    });
    await t.mutation(cutoffs, { runKey: "overflow-identity" });
    expect(
      await t.mutation(page, {
        runKey: "overflow-identity",
        direction: "ledger_to_source",
        source: "characters",
        pageSize: 16,
      }),
    ).toMatchObject({ status: "blocked", code: "LEDGER_DOCUMENT_OVERFLOW" });
    expect(
      await t.run((ctx) =>
        ctx.db.query("storageReferenceLedgerVerificationFailures").unique(),
      ),
    ).toMatchObject({
      documentId: "missing-character",
      ledgerRowId: ledgerRowIds[1],
    });
  });

  it("matches deterministic SHA-256 known vectors", () => {
    expect(__verificationTestOnly.sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(__verificationTestOnly.sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(
      __verificationTestOnly.sha256(
        "The quick brown fox jumps over the lazy dog",
      ),
    ).toBe("d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592");
  });

  it("excludes later equal-timestamp rows at the inclusive terminal ID", () => {
    const rows = [
      { _id: "a", _creationTime: 10 },
      { _id: "b", _creationTime: 10 },
      { _id: "c", _creationTime: 10 },
    ];
    expect(
      __verificationTestOnly.inclusiveTerminalRows(rows, 10, "b"),
    ).toEqual({ rows: rows.slice(0, 2), reachedTerminal: true });
    expect(
      __verificationTestOnly.inclusiveTerminalRows(
        [rows[0], rows[2]],
        10,
        "b",
      ),
    ).toEqual({ rows: [rows[0]], reachedTerminal: true });
  });

  it("rejects duplicate and incomplete backfill checkpoints", async () => {
    const duplicate = convexTest(schema, modules);
    await prerequisites(duplicate);
    await duplicate.run(async (ctx) => {
      await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", {
        checkpointKey: "duplicate",
        version: "historical_backfill_v1",
        source: "characters",
        sourceTable: "characters",
        status: "completed",
        pagesCompleted: 0,
        documentsScanned: 0,
        documentsInserted: 0,
        documentsReplayed: 0,
        occurrencesInserted: 0,
        startedAt: 1,
        updatedAt: 2,
        completedAt: 2,
      });
    });
    await expect(
      duplicate.mutation(init, { runKey: "duplicate" }),
    ).rejects.toThrow("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");

    const incomplete = convexTest(schema, modules);
    await prerequisites(incomplete);
    await incomplete.run(async (ctx) => {
      const checkpoint = await ctx.db
        .query("storageReferenceLedgerBackfillCheckpoints")
        .withIndex("by_checkpoint_key", (query) =>
          query.eq("checkpointKey", "historical_backfill_v1:characters"),
        )
        .unique();
      await ctx.db.patch(checkpoint!._id, {
        status: "running",
        completedAt: undefined,
      });
    });
    await expect(
      incomplete.mutation(init, { runKey: "incomplete" }),
    ).rejects.toThrow("STORAGE_REFERENCE_LEDGER_BACKFILL_INCOMPLETE");
  });

  it("detects tampered evidence during finalization", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["tampered"])),
    );
    await t.run(async (ctx) => {
      const documentId = await ctx.db.insert("characters", {
        userId: "owner",
        name: "Tamper target",
        appearance: {},
        avatarStorageId: storageId,
        createdAt: 1,
      });
      await ctx.db.insert("storageReferenceLedger", {
        referenceKey: JSON.stringify([
          "characters",
          documentId,
          "avatarStorageId",
          0,
        ]),
        storageId,
        source: "characters",
        documentId,
        field: "avatarStorageId",
        position: 0,
        ownerId: "owner",
        origin: "historical_backfill_v1",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    await t.mutation(init, { runKey: "tampered" });
    await completeDirection(t, "tampered", "source_to_ledger");
    await t.mutation(cutoffs, { runKey: "tampered" });
    await completeDirection(t, "tampered", "ledger_to_source");
    await t.run(async (ctx) => {
      const evidence = await ctx.db
        .query("storageReferenceLedgerVerificationEvidencePages")
        .first();
      expect(evidence).not.toBeNull();
      await ctx.db.patch(evidence!._id, { payloadJson: "[]" });
    });
    await expect(t.mutation(finalize, { runKey: "tampered" })).rejects.toThrow(
      "VERIFICATION_EVIDENCE_TAMPERED",
    );
  });

  it("rebuilds and exactly validates a completed attestation on replay", async () => {
    const t = convexTest(schema, modules);
    await prerequisites(t);
    await seedCharacterPairs(t, 1);
    expect(await completeRun(t, "attestation-replay")).toMatchObject({
      result: "passed",
    });
    await t.run(async (ctx) => {
      const attestation = (await ctx.db
        .query("storageReferenceLedgerVerificationAttestations")
        .unique())!;
      await ctx.db.patch(attestation._id, { scopeManifestJson: "[]" });
    });
    await expect(
      t.mutation(finalize, { runKey: "attestation-replay" }),
    ).rejects.toThrow(
      "STORAGE_REFERENCE_LEDGER_VERIFICATION_ATTESTATION_CORRUPT",
    );
  });

  it("rejects duplicate and corrupted immutable finalization commitments", async () => {
    const duplicate = convexTest(schema, modules);
    await prerequisites(duplicate);
    await seedCharacterPairs(duplicate, 18);
    await duplicate.mutation(init, { runKey: "commitment-duplicate" });
    await drainWithPageSize(
      duplicate,
      "commitment-duplicate",
      "source_to_ledger",
      1,
    );
    await duplicate.mutation(cutoffs, { runKey: "commitment-duplicate" });
    await drainWithPageSize(
      duplicate,
      "commitment-duplicate",
      "ledger_to_source",
      1,
    );
    expect(
      await duplicate.mutation(finalize, { runKey: "commitment-duplicate" }),
    ).toMatchObject({ result: "running" });
    await duplicate.run(async (ctx) => {
      const commitment = (await ctx.db
        .query("storageReferenceLedgerVerificationFinalizationCommitments")
        .unique())!;
      const { _id: ignoredId, _creationTime: ignoredTime, ...fields } = commitment;
      void ignoredId;
      void ignoredTime;
      await ctx.db.insert(
        "storageReferenceLedgerVerificationFinalizationCommitments",
        { ...fields, batchKey: "duplicate" },
      );
    });
    await expect(
      duplicate.mutation(finalize, { runKey: "commitment-duplicate" }),
    ).rejects.toThrow("VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED");

    const corrupted = convexTest(schema, modules);
    await prerequisites(corrupted);
    await seedCharacterPairs(corrupted, 18);
    await corrupted.mutation(init, { runKey: "commitment-corrupt" });
    await drainWithPageSize(
      corrupted,
      "commitment-corrupt",
      "source_to_ledger",
      1,
    );
    await corrupted.mutation(cutoffs, { runKey: "commitment-corrupt" });
    await drainWithPageSize(
      corrupted,
      "commitment-corrupt",
      "ledger_to_source",
      1,
    );
    await corrupted.mutation(finalize, { runKey: "commitment-corrupt" });
    await corrupted.run(async (ctx) => {
      const commitment = (await ctx.db
        .query("storageReferenceLedgerVerificationFinalizationCommitments")
        .unique())!;
      await ctx.db.patch(commitment._id, { endFingerprint: "f".repeat(64) });
    });
    await expect(
      corrupted.mutation(finalize, { runKey: "commitment-corrupt" }),
    ).rejects.toThrow("VERIFICATION_FINALIZATION_COMMITMENT_TAMPERED");
  });
});
