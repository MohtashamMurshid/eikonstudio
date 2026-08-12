import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

vi.mock("./auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth")>();
  return {
    ...actual,
    authComponent: new Proxy(actual.authComponent, {
      get(target, property, receiver) {
        if (property === "safeGetAuthUser") {
          return async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
            const identity = await ctx.auth.getUserIdentity();
            return identity ? { _id: identity.subject } : null;
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/!(*.*.*)*.*s");
type Harness = TestConvex<typeof schema>;
type Source = "generations" | "gallery" | "characters" | "durable_outputs" | "video_generations";
type Result = {
  source: Source;
  status: "running" | "completed" | "blocked";
  cutoffDocumentId?: string;
  lastDocumentId?: string;
  pagesCompleted: number;
  documentsScanned: number;
  documentsInserted: number;
  documentsReplayed: number;
  occurrencesInserted: number;
  pageDocuments: number;
  pageOccurrencesInserted: number;
  pageReplayed: number;
  blockedDocumentId?: string;
  blockedReason?: string;
  authoritative: false;
  physicalDeletionEnabled: false;
};
const runPage = makeFunctionReference<"mutation", { source: Source; pageSize: number }, Result>(
  "storageReferenceLedgerBackfill:runStorageReferenceLedgerBackfillPage",
);

async function store(t: Harness, value: string, type = "image/png") {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([value], { type })));
}

async function ledger(t: Harness) {
  return await t.run(async (ctx) => ctx.db.query("storageReferenceLedger").collect());
}

describe("historical storage-reference ledger backfill", () => {
  it("backfills every source with exact ordered occurrences and remains non-authoritative", async () => {
    const t = convexTest(schema, modules);
    const [a, b, c] = await Promise.all([store(t, "a"), store(t, "b"), store(t, "c")]);
    const documents = await t.run(async (ctx) => {
      const generation = await ctx.db.insert("generations", {
        userId: "owner",
        prompt: "historical generation",
        imageStorageId: a,
        thumbnailStorageId: b,
        referenceImageIds: [a, a, c],
        mode: "image-editing",
        aspectRatio: "square",
        imageSize: "2K",
        createdAt: Date.now(),
        status: "completed",
      });
      const gallery = await ctx.db.insert("gallery", {
        userId: "owner",
        filename: "historical-gallery",
        imageStorageId: a,
        thumbnailStorageId: b,
        createdAt: Date.now(),
      });
      const character = await ctx.db.insert("characters", {
        userId: "owner",
        name: "Historical Character",
        appearance: {},
        avatarStorageId: c,
        createdAt: Date.now(),
      });
      const jobId = await ctx.db.insert("durableGenerationJobs", {
        ownerId: "owner",
        jobKey: "job_key",
        generationKey: "generation_key",
        idempotencyKey: "idempotency_key",
        requestFingerprint: "fingerprint",
        provider: "openai",
        credentialHandle: "credential",
        modelId: "gpt-image-2",
        requestMetadataJson: "{}",
        status: "completed",
        revision: 1,
        submissionState: "accepted",
        providerRequestId: "request",
        cancellationRequested: false,
        leaseEpoch: 0,
        maxAgeSeconds: 1800,
        expiresAt: Date.now() + 1800000,
        terminalAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const completionId = await ctx.db.insert("durableGenerationCompletions", {
        ownerId: "owner",
        jobId,
        jobKey: "job_key",
        generationKey: "generation_key",
        provider: "openai",
        providerRequestId: "request",
        completionKey: "completion_key",
        outputIdentityKind: "checksum",
        outputIdentity: "a".repeat(64),
        createdAt: Date.now(),
      });
      const output = await ctx.db.insert("durableGenerationOutputs", {
        ownerId: "owner",
        jobId,
        jobKey: "job_key",
        generationKey: "generation_key",
        completionId,
        outputKey: "output_key",
        storageId: a,
        thumbnailStorageId: b,
        mediaType: "image",
        contentType: "image/png",
        byteSize: 1,
        checksumSha256: "a".repeat(64),
        createdAt: Date.now(),
      });
      const video = await ctx.db.insert("videoGenerations", {
        userId: "owner",
        prompt: "historical video",
        videoStorageId: a,
        thumbnailStorageId: b,
        mode: "image-to-video",
        aspectRatio: "landscape",
        resolution: "720p",
        duration: 8,
        referenceImageStorageIds: [c, c],
        estimatedCost: 0,
        createdAt: Date.now(),
      });
      return { generation, gallery, character, output, video };
    });

    for (const source of ["generations", "gallery", "characters", "durable_outputs", "video_generations"] as const) {
      const result = await t.mutation(runPage, { source, pageSize: 16 });
      expect(result).toMatchObject({
        source,
        status: "completed",
        pageDocuments: 1,
        authoritative: false,
        physicalDeletionEnabled: false,
      });
    }

    const rows = await ledger(t);
    expect(rows).toHaveLength(14);
    expect(rows.every((row) => row.origin === "historical_backfill_v1")).toBe(true);
    expect(rows
      .filter((row) => row.source === "generations" && row.field === "referenceImageIds")
      .map((row) => ({ position: row.position, storageId: row.storageId })))
      .toEqual([
        { position: 0, storageId: a },
        { position: 1, storageId: a },
        { position: 2, storageId: c },
      ]);
    expect(new Set(rows.map((row) => row.documentId))).toEqual(new Set(Object.values(documents)));
    expect(await t.run(async (ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(3);
  });

  it("resumes from its checkpoint cursor and excludes rows created after the immutable cutoff", async () => {
    const t = convexTest(schema, modules);
    const avatar = await store(t, "avatar");
    await t.run(async (ctx) => {
      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert("characters", {
          userId: "owner",
          name: `Before ${index}`,
          appearance: {},
          avatarStorageId: avatar,
          createdAt: Date.now(),
        });
      }
    });
    const first = await t.mutation(runPage, { source: "characters", pageSize: 2 });
    expect(first).toMatchObject({ status: "running", pagesCompleted: 1, documentsScanned: 2 });
    const afterCutoff = await t.run(async (ctx) => ctx.db.insert("characters", {
      userId: "owner",
      name: "After cutoff",
      appearance: {},
      avatarStorageId: avatar,
      createdAt: Date.now(),
    }));
    await t.run(async (ctx) => {
      for (const documentId of [first.lastDocumentId, first.cutoffDocumentId]) {
        if (!documentId) throw new Error("Expected persisted backfill anchor");
        const id = ctx.db.normalizeId("characters", documentId);
        if (!id) throw new Error("Expected character anchor ID");
        const rows = await ctx.db
          .query("storageReferenceLedger")
          .withIndex("by_source_document", (q) => q.eq("source", "characters").eq("documentId", documentId))
          .collect();
        for (const row of rows) await ctx.db.delete(row._id);
        await ctx.db.delete(id);
      }
    });
    const second = await t.mutation(runPage, { source: "characters", pageSize: 2 });
    expect(second).toMatchObject({
      status: "completed",
      cutoffDocumentId: first.cutoffDocumentId,
      pagesCompleted: 2,
      documentsScanned: 2,
      documentsInserted: 2,
    });
    expect((await ledger(t)).some((row) => row.documentId === afterCutoff)).toBe(false);
    const replay = await t.mutation(runPage, { source: "characters", pageSize: 2 });
    expect(replay).toMatchObject({
      status: "completed",
      pagesCompleted: 2,
      documentsScanned: 2,
      pageDocuments: 0,
      pageOccurrencesInserted: 0,
    });
  });

  it("replays exact transactional rows and blocks a conflicting page without partial writes or cursor advance", async () => {
    const replayTest = convexTest(schema, modules);
    const image = await store(replayTest, "image");
    const thumbnail = await store(replayTest, "thumbnail");
    await replayTest.withIdentity({ subject: "owner" }).mutation(
      api.gallery.saveImage,
      { filename: "live-row", imageStorageId: image, thumbnailStorageId: thumbnail },
    );
    const replay = await replayTest.mutation(runPage, { source: "gallery", pageSize: 16 });
    expect(replay).toMatchObject({
      status: "completed",
      pageDocuments: 1,
      pageOccurrencesInserted: 0,
      pageReplayed: 1,
    });
    expect((await ledger(replayTest)).every((row) => row.origin === "transactional_dual_write_v1")).toBe(true);

    const blockedTest = convexTest(schema, modules);
    const [a, b, wrong] = await Promise.all([
      store(blockedTest, "a"), store(blockedTest, "b"), store(blockedTest, "wrong"),
    ]);
    const ids = await blockedTest.run(async (ctx) => {
      const first = await ctx.db.insert("gallery", {
        userId: "owner",
        filename: "first",
        imageStorageId: a,
        thumbnailStorageId: b,
        createdAt: Date.now(),
      });
      const second = await ctx.db.insert("gallery", {
        userId: "owner",
        filename: "second",
        imageStorageId: a,
        thumbnailStorageId: b,
        createdAt: Date.now(),
      });
      await ctx.db.insert("storageReferenceLedger", {
        referenceKey: JSON.stringify(["gallery", second, "imageStorageId", 0]),
        storageId: wrong,
        source: "gallery",
        documentId: second,
        field: "imageStorageId",
        position: 0,
        ownerId: "owner",
        origin: "transactional_dual_write_v1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { first, second };
    });
    const blocked = await blockedTest.mutation(runPage, { source: "gallery", pageSize: 16 });
    expect(blocked).toMatchObject({
      status: "blocked",
      pagesCompleted: 0,
      documentsScanned: 0,
      occurrencesInserted: 0,
      pageDocuments: 0,
      blockedDocumentId: ids.second,
      blockedReason: "STORAGE_REFERENCE_LEDGER_BACKFILL_CONFLICT",
    });
    const rows = await ledger(blockedTest);
    expect(rows.some((row) => row.documentId === ids.first)).toBe(false);
    expect(rows.filter((row) => row.documentId === ids.second)).toHaveLength(1);
    const blockedReplay = await blockedTest.mutation(runPage, { source: "gallery", pageSize: 1 });
    expect(blockedReplay).toMatchObject({
      status: "blocked",
      pagesCompleted: 0,
      documentsScanned: 0,
      pageDocuments: 0,
      blockedDocumentId: ids.second,
    });
  });

  it("rejects duplicate checkpoints before source or ledger progress", async () => {
    const t = convexTest(schema, modules);
    const avatar = await store(t, "avatar");
    await t.run(async (ctx) => {
      await ctx.db.insert("characters", {
        userId: "owner",
        name: "Checkpoint Sentinel",
        appearance: {},
        avatarStorageId: avatar,
        createdAt: Date.now(),
      });
      const now = Date.now();
      for (let index = 0; index < 2; index += 1) {
        await ctx.db.insert("storageReferenceLedgerBackfillCheckpoints", {
          checkpointKey: "historical_backfill_v1:characters",
          version: "historical_backfill_v1",
          source: "characters",
          sourceTable: "characters",
          status: "running",
          pagesCompleted: 0,
          documentsScanned: 0,
          documentsInserted: 0,
          documentsReplayed: 0,
          occurrencesInserted: 0,
          startedAt: now,
          updatedAt: now,
        });
      }
    });
    await expect(t.mutation(runPage, { source: "characters", pageSize: 1 }))
      .rejects.toThrow("STORAGE_REFERENCE_LEDGER_BACKFILL_CHECKPOINT_CORRUPT");
    expect(await ledger(t)).toEqual([]);
  });
});
