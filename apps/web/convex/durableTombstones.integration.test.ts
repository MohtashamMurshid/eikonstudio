import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createDurableJobRecords } from "./durableJobs";
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
type DurableStatus = "queued" | "submitting" | "processing" | "persisting" | "completed" | "failed" | "cancelled" | "expired";

async function createFixture(
  t: Harness,
  suffix: string,
  status: DurableStatus,
  options: { ownerId?: string; withOutput?: boolean; createdAt?: number } = {},
) {
  const ownerId = options.ownerId ?? "owner_tombstone";
  const now = Date.now();
  const created = await t.run(async (ctx) => createDurableJobRecords(ctx, {
    ownerId,
    jobKey: `job_${suffix}`,
    generationKey: `generation_${suffix}`,
    idempotencyKey: `image:idempotency_${suffix}`,
    requestFingerprint: `fingerprint_${suffix}`,
    provider: "openai",
    credentialHandle: `credential_${suffix}`,
    modelId: "gpt-image-2",
    requestMetadataJson: JSON.stringify({ kind: "tombstone-test" }),
    maxAgeSeconds: 1800,
    scheduleAt: now + 60_000,
    eventId: `created_${suffix}`,
    occurredAt: now,
  }));

  const stored: {
    imageStorageId?: Id<"_storage">;
    thumbnailStorageId?: Id<"_storage">;
  } = options.withOutput
    ? await t.run(async (ctx) => ({
        imageStorageId: await ctx.storage.store(new Blob([`image-${suffix}`], { type: "image/png" })),
        thumbnailStorageId: await ctx.storage.store(new Blob([`thumb-${suffix}`], { type: "image/jpeg" })),
      }))
    : {};

  return t.run(async (ctx) => {
    const generationId = await ctx.db.insert("generations", {
      userId: ownerId,
      prompt: `prompt ${suffix}`,
      imageStorageId: stored.imageStorageId,
      thumbnailStorageId: stored.thumbnailStorageId,
      mode: "text-to-image",
      aspectRatio: "square",
      imageSize: "2K",
      imageModel: "gpt-image-2",
      credentialHandle: `credential_${suffix}`,
      credentialProvider: "openai",
      requestIdempotencyKey: `idempotency_${suffix}`,
      durableJobId: created.jobId,
      durableGenerationKey: `generation_${suffix}`,
      createdAt: options.createdAt ?? now,
      status: status === "completed" ? "completed" : status === "failed" ? "failed" : "pending",
    });

    let outputId: Id<"durableGenerationOutputs"> | undefined;
    let completionId: Id<"durableGenerationCompletions"> | undefined;
    if (options.withOutput && stored.imageStorageId && stored.thumbnailStorageId) {
      completionId = await ctx.db.insert("durableGenerationCompletions", {
        ownerId,
        jobId: created.jobId,
        jobKey: `job_${suffix}`,
        generationKey: `generation_${suffix}`,
        provider: "openai",
        providerRequestId: `request_${suffix}`,
        completionKey: `completion_${suffix}`,
        outputIdentityKind: "checksum",
        outputIdentity: "a".repeat(64),
        createdAt: now,
      });
      outputId = await ctx.db.insert("durableGenerationOutputs", {
        ownerId,
        jobId: created.jobId,
        jobKey: `job_${suffix}`,
        generationKey: `generation_${suffix}`,
        completionId,
        outputKey: `output_${suffix}`,
        storageId: stored.imageStorageId,
        thumbnailStorageId: stored.thumbnailStorageId,
        mediaType: "image",
        contentType: "image/png",
        byteSize: 12,
        checksumSha256: "a".repeat(64),
        createdAt: now,
      });
    }

    const submissionState = status === "queued" ? "not_started" : status === "submitting" ? "ambiguous" : "accepted";
    const currentJob = await ctx.db.get(created.jobId);
    if (!currentJob) throw new Error("Durable fixture job is missing");
    const terminalAt = ["completed", "failed", "cancelled", "expired"].includes(status)
      ? Math.max(now, currentJob.createdAt)
      : undefined;
    await ctx.db.patch(created.jobId, {
      status,
      submissionState,
      providerRequestId: status === "queued" ? undefined : `request_${suffix}`,
      finalizedOutputIds: status === "completed" && outputId ? [outputId] : undefined,
      terminalAt,
      cancellationRequestedAt: status === "cancelled" ? terminalAt : undefined,
      cancellationObservedAt: status === "cancelled" ? terminalAt : undefined,
      cancellationOutcome: status === "cancelled" ? "accepted" : undefined,
      updatedAt: now,
    });
    return {
      ownerId,
      jobId: created.jobId,
      generationId,
      outputId,
      completionId,
      imageStorageId: stored.imageStorageId,
      thumbnailStorageId: stored.thumbnailStorageId,
    };
  });
}

function asOwner(t: Harness, ownerId = "owner_tombstone") {
  return t.withIdentity({ subject: ownerId, issuer: "test", tokenIdentifier: `test|${ownerId}` });
}

describe("durable generation tombstones", () => {
  it("atomically tombstones a completed generation and output while preserving audit and blobs", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createFixture(t, "completed", "completed", { withOutput: true });
    const authed = asOwner(t);
    const extraOutputId = await t.run(async (ctx) => {
      if (!fixture.completionId || !fixture.imageStorageId || !fixture.thumbnailStorageId) {
        throw new Error("Completed tombstone fixture is incomplete");
      }
      return ctx.db.insert("durableGenerationOutputs", {
        ownerId: fixture.ownerId,
        jobId: fixture.jobId,
        jobKey: "job_completed",
        generationKey: "generation_completed",
        completionId: fixture.completionId,
        outputKey: "output_completed_unfinalized",
        storageId: fixture.imageStorageId,
        thumbnailStorageId: fixture.thumbnailStorageId,
        mediaType: "image",
        contentType: "image/png",
        byteSize: 12,
        checksumSha256: "a".repeat(64),
        createdAt: Date.now(),
      });
    });
    if (!fixture.outputId) throw new Error("Completed fixture has no finalized output");
    await t.run(async (ctx) => ctx.db.patch(fixture.jobId, {
      finalizedOutputIds: [fixture.outputId!, extraOutputId],
    }));

    const first = await authed.mutation(api.generations.deleteGeneration, { generationId: fixture.generationId });
    const replay = await authed.mutation(api.generations.deleteGeneration, { generationId: fixture.generationId });
    expect(first).toMatchObject({ success: true, replayed: false, tombstoned: true });
    expect(replay).toEqual({ ...first, replayed: true });

    const state = await t.run(async (ctx) => ({
      generation: await ctx.db.get(fixture.generationId),
      output: fixture.outputId ? await ctx.db.get(fixture.outputId) : null,
      extraOutput: await ctx.db.get(extraOutputId),
      completion: fixture.completionId ? await ctx.db.get(fixture.completionId) : null,
      job: await ctx.db.get(fixture.jobId),
      events: await ctx.db
        .query("durableGenerationEvents")
        .withIndex("by_job_revision", (q) => q.eq("jobId", fixture.jobId))
        .collect(),
      imageMetadata: fixture.imageStorageId ? await ctx.db.system.get(fixture.imageStorageId) : null,
      thumbnailMetadata: fixture.thumbnailStorageId ? await ctx.db.system.get(fixture.thumbnailStorageId) : null,
    }));
    expect(state.generation).toMatchObject({
      tombstonedAt: first.tombstonedAt,
      tombstoneReason: "user_deleted_generation",
    });
    expect(state.output).toMatchObject({
      tombstonedAt: first.tombstonedAt,
      tombstoneEventId: state.generation?.tombstoneEventId,
      storageId: fixture.imageStorageId,
    });
    expect(state.extraOutput).toMatchObject({
      tombstonedAt: first.tombstonedAt,
      tombstoneEventId: state.generation?.tombstoneEventId,
    });
    expect(state.job?.status).toBe("completed");
    expect(state.events.find((event) => event.eventType === "tombstoned")).toMatchObject({
      eventId: state.generation?.tombstoneEventId,
      eventFingerprint: fixture.generationId,
      occurredAt: first.tombstonedAt,
      revision: state.job?.revision,
    });
    expect(state.completion).not.toBeNull();
    expect(state.imageMetadata).not.toBeNull();
    expect(state.thumbnailMetadata).not.toBeNull();

    expect(await authed.query(api.generations.getMyGenerations, { limit: 50 })).toEqual([]);
    expect(await authed.query(api.generations.getUsageStats, {})).toMatchObject({ totalGenerations: 0, totalCost: 0 });
    await expect(
      authed.mutation(api.generations.startGeneration, {
        idempotencyKey: "idempotency_completed",
        prompt: "prompt completed",
        mode: "text-to-image",
        aspectRatio: "square",
        imageSize: "2K",
        imageModel: "gpt-image-2",
      }),
    ).rejects.toThrow("Generation request identity belongs to a deleted generation");
    const generationReferences = await t.query(internal.storageReconciliation.pageStorageReferences, {
      source: "generations",
      paginationOpts: { cursor: null, numItems: 100 },
    });
    const outputReferences = await t.query(internal.storageReconciliation.pageStorageReferences, {
      source: "durable_outputs",
      paginationOpts: { cursor: null, numItems: 100 },
    });
    expect(generationReferences.page.some((document) => document.documentId === fixture.generationId)).toBe(true);
    expect(outputReferences.page.some((document) => document.documentId === fixture.outputId)).toBe(true);

    await t.mutation(internal.generations.mirrorDurableGenerationCompleted, { jobId: fixture.jobId });
    const afterMirror = await t.run(async (ctx) => ctx.db.get(fixture.generationId));
    expect(afterMirror?.tombstonedAt).toBe(first.tombstonedAt);
  }, 15_000);

  it("blocks active and ambiguous jobs without partial tombstones", async () => {
    for (const status of ["queued", "submitting", "processing", "persisting"] as const) {
      const t = convexTest(schema, modules);
      const fixture = await createFixture(t, `active_${status}`, status);
      await expect(
        asOwner(t).mutation(api.generations.deleteGeneration, { generationId: fixture.generationId }),
      ).rejects.toThrow("Durable generation is not consistently terminal");
      expect((await t.run(async (ctx) => ctx.db.get(fixture.generationId)))?.tombstonedAt).toBeUndefined();
    }
  });

  it("tombstones failed, cancelled, and expired jobs while preserving their outputs", async () => {
    for (const status of ["failed", "cancelled", "expired"] as const) {
      const t = convexTest(schema, modules);
      const fixture = await createFixture(t, `terminal_${status}`, status, { withOutput: true });
      const result = await asOwner(t).mutation(api.generations.deleteGeneration, { generationId: fixture.generationId });
      expect(result).toMatchObject({ success: true, tombstoned: true, replayed: false });
      const state = await t.run(async (ctx) => ({
        generation: await ctx.db.get(fixture.generationId),
        output: fixture.outputId ? await ctx.db.get(fixture.outputId) : null,
      }));
      expect(state.generation?.tombstonedAt).toBe(result.tombstonedAt);
      expect(state.output?.tombstonedAt).toBe(result.tombstonedAt);
    }
  });

  it("rejects malformed terminal timestamps, ambiguous submission, and unresolved cancellation", async () => {
    const cases = [
      { suffix: "missing_terminal_at", patch: { terminalAt: undefined } },
      { suffix: "ambiguous_terminal", patch: { submissionState: "ambiguous" as const } },
      { suffix: "unresolved_cancellation", patch: { cancellationRequested: true } },
    ];
    for (const testCase of cases) {
      const t = convexTest(schema, modules);
      const fixture = await createFixture(t, testCase.suffix, "failed");
      await t.run(async (ctx) => ctx.db.patch(fixture.jobId, testCase.patch));
      await expect(
        asOwner(t).mutation(api.generations.deleteGeneration, { generationId: fixture.generationId }),
      ).rejects.toThrow("Durable generation is not consistently terminal");
      expect((await t.run(async (ctx) => ctx.db.get(fixture.generationId)))?.tombstonedAt).toBeUndefined();
    }

    const cancelledTest = convexTest(schema, modules);
    const cancelled = await createFixture(cancelledTest, "unobserved_cancelled", "cancelled");
    await cancelledTest.run(async (ctx) => ctx.db.patch(cancelled.jobId, {
      cancellationObservedAt: undefined,
      cancellationOutcome: undefined,
    }));
    await expect(
      asOwner(cancelledTest).mutation(api.generations.deleteGeneration, { generationId: cancelled.generationId }),
    ).rejects.toThrow("Durable cancellation is not consistently observed");

    const outcomeTest = convexTest(schema, modules);
    const contradictory = await createFixture(outcomeTest, "contradictory_cancelled", "cancelled");
    await outcomeTest.run(async (ctx) => ctx.db.patch(contradictory.jobId, { cancellationOutcome: "unsupported" }));
    await expect(
      asOwner(outcomeTest).mutation(api.generations.deleteGeneration, { generationId: contradictory.generationId }),
    ).rejects.toThrow("Durable cancellation is not consistently observed");
  });

  it("replays from exact tombstone markers before revalidating later job state and rejects marker corruption", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createFixture(t, "replay_order", "completed", { withOutput: true });
    const authed = asOwner(t);
    const first = await authed.mutation(api.generations.deleteGeneration, { generationId: fixture.generationId });
    const replayTombstonedAt = first.tombstonedAt;
    if (replayTombstonedAt === undefined) throw new Error("Replay fixture was not tombstoned");
    await t.run(async (ctx) => ctx.db.patch(fixture.jobId, {
      status: "processing",
      terminalAt: undefined,
      cancellationRequested: true,
      revision: 999,
    }));
    expect(await authed.mutation(api.generations.deleteGeneration, { generationId: fixture.generationId })).toEqual({
      ...first,
      replayed: true,
    });

    if (!fixture.outputId) throw new Error("Replay fixture has no output");
    await t.run(async (ctx) => ctx.db.patch(fixture.outputId!, { tombstonedAt: replayTombstonedAt + 1 }));
    await expect(
      authed.mutation(api.generations.deleteGeneration, { generationId: fixture.generationId }),
    ).rejects.toThrow("Durable tombstone replay is inconsistent");
  });

  it("rejects malformed finalized completion/image bindings and output overflow atomically", async () => {
    const completionTest = convexTest(schema, modules);
    const completionFixture = await createFixture(completionTest, "bad_completion", "completed", { withOutput: true });
    if (!completionFixture.completionId) throw new Error("Completion fixture is incomplete");
    await completionTest.run(async (ctx) => ctx.db.patch(completionFixture.completionId!, { outputIdentity: "b".repeat(64) }));
    await expect(
      asOwner(completionTest).mutation(api.generations.deleteGeneration, { generationId: completionFixture.generationId }),
    ).rejects.toThrow("Durable output completion binding is invalid");

    const unfinalizedTest = convexTest(schema, modules);
    const unfinalizedFixture = await createFixture(unfinalizedTest, "bad_unfinalized_completion", "failed", { withOutput: true });
    if (!unfinalizedFixture.completionId) throw new Error("Unfinalized completion fixture is incomplete");
    await unfinalizedTest.run(async (ctx) => ctx.db.patch(unfinalizedFixture.completionId!, { jobKey: "foreign_job" }));
    await expect(
      asOwner(unfinalizedTest).mutation(api.generations.deleteGeneration, { generationId: unfinalizedFixture.generationId }),
    ).rejects.toThrow("Durable output completion binding is invalid");

    const thumbnailTest = convexTest(schema, modules);
    const thumbnailFixture = await createFixture(thumbnailTest, "missing_thumbnail", "completed", { withOutput: true });
    if (!thumbnailFixture.outputId) throw new Error("Thumbnail fixture is incomplete");
    await thumbnailTest.run(async (ctx) => ctx.db.patch(thumbnailFixture.outputId!, { thumbnailStorageId: undefined }));
    await expect(
      asOwner(thumbnailTest).mutation(api.generations.deleteGeneration, { generationId: thumbnailFixture.generationId }),
    ).rejects.toThrow("Durable finalized image output is invalid");

    const duplicateTest = convexTest(schema, modules);
    const duplicateFixture = await createFixture(duplicateTest, "duplicate_finalized", "completed", { withOutput: true });
    if (!duplicateFixture.outputId) throw new Error("Duplicate fixture is incomplete");
    await duplicateTest.run(async (ctx) => ctx.db.patch(duplicateFixture.jobId, {
      finalizedOutputIds: [duplicateFixture.outputId!, duplicateFixture.outputId!],
    }));
    await expect(
      asOwner(duplicateTest).mutation(api.generations.deleteGeneration, { generationId: duplicateFixture.generationId }),
    ).rejects.toThrow("Durable finalized output binding is invalid");

    const overflowTest = convexTest(schema, modules);
    const overflow = await createFixture(overflowTest, "overflow", "failed", { withOutput: true });
    if (!overflow.outputId) throw new Error("Overflow fixture is incomplete");
    await overflowTest.run(async (ctx) => {
      const original = await ctx.db.get(overflow.outputId!);
      if (!original) throw new Error("Overflow source output is missing");
      const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...fields } = original;
      for (let index = 1; index <= 16; index += 1) {
        await ctx.db.insert("durableGenerationOutputs", {
          ...fields,
          outputKey: `output_overflow_${index}`,
        });
      }
    });
    await expect(
      asOwner(overflowTest).mutation(api.generations.deleteGeneration, { generationId: overflow.generationId }),
    ).rejects.toThrow("Durable output binding is invalid");
    expect((await overflowTest.run(async (ctx) => ctx.db.get(overflow.generationId)))?.tombstonedAt).toBeUndefined();
  });

  it("rejects cross-owner deletion and inconsistent finalized output sets", async () => {
    const ownerTest = convexTest(schema, modules);
    const owned = await createFixture(ownerTest, "owner", "completed", { withOutput: true });
    await expect(
      asOwner(ownerTest, "other_owner").mutation(api.generations.deleteGeneration, { generationId: owned.generationId }),
    ).rejects.toThrow("You can only delete your own generations");

    const bindingTest = convexTest(schema, modules);
    const inconsistent = await createFixture(bindingTest, "binding", "completed", { withOutput: true });
    await bindingTest.run(async (ctx) => ctx.db.patch(inconsistent.jobId, { finalizedOutputIds: [] }));
    await expect(
      asOwner(bindingTest).mutation(api.generations.deleteGeneration, { generationId: inconsistent.generationId }),
    ).rejects.toThrow("Durable finalized output binding is invalid");
    expect((await bindingTest.run(async (ctx) => ctx.db.get(inconsistent.generationId)))?.tombstonedAt).toBeUndefined();
    expect(inconsistent.outputId && (await bindingTest.run(async (ctx) => ctx.db.get(inconsistent.outputId!)))?.tombstonedAt).toBeUndefined();
  });

  it("does not let tombstoned rows starve visible history pages", async () => {
    const t = convexTest(schema, modules);
    const older = await createFixture(t, "visible_older", "failed", { createdAt: Date.now() - 1_000 });
    const newer = await createFixture(t, "hidden_newer", "failed", { createdAt: Date.now() });
    await asOwner(t).mutation(api.generations.deleteGeneration, { generationId: newer.generationId });
    const visible = await asOwner(t).query(api.generations.getMyGenerations, { limit: 1 });
    expect(visible.map((generation) => generation._id)).toEqual([older.generationId]);
  });

  it("preserves legacy unlinked physical deletion behavior", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const imageStorageId = await ctx.storage.store(new Blob(["legacy-image"], { type: "image/png" }));
      const thumbnailStorageId = await ctx.storage.store(new Blob(["legacy-thumb"], { type: "image/jpeg" }));
      const generationId = await ctx.db.insert("generations", {
        userId: "owner_tombstone",
        prompt: "legacy",
        imageStorageId,
        thumbnailStorageId,
        mode: "text-to-image",
        aspectRatio: "square",
        imageSize: "2K",
        createdAt: Date.now(),
        status: "completed",
      });
      return { generationId, imageStorageId, thumbnailStorageId };
    });
    const result = await asOwner(t).mutation(api.generations.deleteGeneration, { generationId: fixture.generationId });
    expect(result).toEqual({ success: true, replayed: false, tombstoned: false });
    expect(await t.run(async (ctx) => ctx.db.get(fixture.generationId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(fixture.imageStorageId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(fixture.thumbnailStorageId))).toBeNull();
  });
});
