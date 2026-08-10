import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { durableExecutionDecision } from "./durableExecutionPolicy";
import { createDurableJobRecords } from "./durableJobs";
import schema from "./schema";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/!(*.*.*)*.*s");
const OWNER = "owner_test_123";
const LEASE_MS = 300_000;

type Harness = TestConvex<typeof schema>;
type Fixture = {
  t: Harness;
  ownerId: string;
  jobId: Id<"durableGenerationJobs">;
  attemptKey: string;
  suffix: string;
};

type Lease = {
  token: string;
  epoch: number;
  revision: number;
};

function createArgs(now: number, suffix: string) {
  return {
    ownerId: OWNER,
    jobKey: `job_${suffix}`,
    generationKey: `generation_${suffix}`,
    idempotencyKey: `idempotency_${suffix}`,
    requestFingerprint: `request_${suffix}`,
    provider: "openai" as const,
    credentialHandle: `credential_${suffix}`,
    modelId: "gpt-image-2",
    requestMetadataJson: JSON.stringify({ kind: "fake-image-v1", fixture: suffix }),
    maxAgeSeconds: 30 * 60,
    scheduleAt: now + 60_000,
    eventId: `created_${suffix}`,
    occurredAt: now,
  };
}

async function createFixture(suffix: string): Promise<Fixture> {
  const t = convexTest(schema, modules);
  const created = await t.run(async (ctx) => createDurableJobRecords(ctx, createArgs(Date.now(), suffix)));
  await t.run(async (ctx) => {
    await ctx.db.insert("generations", {
      userId: OWNER,
      prompt: `fake prompt ${suffix}`,
      mode: "text-to-image",
      aspectRatio: "square",
      imageSize: "2K",
      createdAt: Date.now(),
      imageModel: "gpt-image-2",
      credentialHandle: `credential_${suffix}`,
      credentialProvider: "openai",
      requestIdempotencyKey: `idempotency_${suffix}`,
      durableJobId: created.jobId,
      durableGenerationKey: `generation_${suffix}`,
      status: "pending",
    });
  });
  const attempt = await t.run(async (ctx) =>
    ctx.db
      .query("durableGenerationAttempts")
      .withIndex("by_job", (q) => q.eq("jobId", created.jobId))
      .unique(),
  );
  if (!attempt) throw new Error("TEST_ATTEMPT_MISSING");
  return { t, ownerId: OWNER, jobId: created.jobId, attemptKey: attempt.attemptKey, suffix };
}

async function snapshot(fixture: Fixture) {
  const value = await fixture.t.query(internal.durableJobs.getScheduledExecutionInternal, { jobId: fixture.jobId });
  if (!value) throw new Error("TEST_SNAPSHOT_MISSING");
  return value;
}

async function claim(fixture: Fixture, worker: string, durationMs = LEASE_MS): Promise<Lease> {
  const current = await snapshot(fixture);
  const token = `lease_${worker}_${fixture.suffix}`;
  const result = await fixture.t.mutation(internal.durableJobs.claim, {
    ownerId: fixture.ownerId,
    jobId: fixture.jobId,
    attemptKey: fixture.attemptKey,
    expectedStatus: current.job.status,
    expectedRevision: current.job.revision,
    leaseOwner: worker,
    leaseToken: token,
    leaseDurationMs: durationMs,
    eventId: `claim_${worker}_${current.job.revision}_${fixture.suffix}`,
    occurredAt: Date.now(),
  });
  return { token, epoch: result.leaseEpoch, revision: result.revision };
}

async function begin(fixture: Fixture, lease: Lease) {
  return fixture.t.mutation(internal.durableJobs.beginSubmission, {
    ownerId: fixture.ownerId,
    jobId: fixture.jobId,
    expectedRevision: lease.revision,
    attemptKey: fixture.attemptKey,
    leaseToken: lease.token,
    leaseEpoch: lease.epoch,
    eventId: `begin_${fixture.suffix}`,
    occurredAt: Date.now(),
  });
}

class FakeProvider {
  calls = 0;

  submit(outcome: "accepted" | "timeout" | "crash", suffix: string) {
    this.calls += 1;
    if (outcome === "timeout") throw Object.assign(new Error("FAKE_TIMEOUT"), { status: undefined });
    if (outcome === "crash") throw new Error("FAKE_PROCESS_CRASH");
    return {
      providerRequestId: `provider_request_${suffix}`,
      bytes: new TextEncoder().encode(`fake-image-${suffix}`),
      contentType: "image/png",
    };
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function accept(fixture: Fixture, lease: Lease, expectedRevision: number, providerRequestId: string) {
  return fixture.t.mutation(internal.durableJobs.recordSubmissionAccepted, {
    ownerId: fixture.ownerId,
    jobId: fixture.jobId,
    expectedRevision,
    attemptKey: fixture.attemptKey,
    leaseToken: lease.token,
    leaseEpoch: lease.epoch,
    submissionKey: `submission_${fixture.suffix}`,
    providerRequestId,
    eventId: `accepted_${fixture.suffix}`,
    occurredAt: Date.now(),
  });
}

async function persistFakeOutput(
  fixture: Fixture,
  lease: Lease,
  expectedRevision: number,
  providerResult: ReturnType<FakeProvider["submit"]>,
) {
  if (!providerResult) throw new Error("TEST_PROVIDER_RESULT_MISSING");
  const storageId = await fixture.t.run(async (ctx) =>
    ctx.storage.store(new Blob([providerResult.bytes], { type: providerResult.contentType })),
  );
  const checksumSha256 = await sha256Hex(providerResult.bytes);
  // convex-test@0.0.40 returns base64 here; Convex 1.31 documents this system field as hex.
  await fixture.t.run(async (ctx) => {
    const patchSystemStorage = ctx.db.patch as unknown as (
      id: Id<"_storage">,
      value: { sha256: string },
    ) => Promise<void>;
    await patchSystemStorage(storageId, { sha256: checksumSha256 });
  });
  const metadata = await fixture.t.run(async (ctx) => ctx.db.system.get(storageId));
  if (!metadata) throw new Error("TEST_STORAGE_METADATA_MISSING");
  const completion = await fixture.t.mutation(internal.durableJobs.recordProviderCompletion, {
    ownerId: fixture.ownerId,
    jobId: fixture.jobId,
    expectedRevision,
    attemptKey: fixture.attemptKey,
    leaseToken: lease.token,
    leaseEpoch: lease.epoch,
    providerRequestId: providerResult.providerRequestId,
    outputIdentityKind: "checksum",
    outputIdentity: checksumSha256,
    eventId: `completed_${fixture.suffix}`,
    occurredAt: Date.now(),
  });
  const output = await fixture.t.mutation(internal.durableJobs.recordDurableOutput, {
    ownerId: fixture.ownerId,
    jobId: fixture.jobId,
    expectedRevision: completion.revision,
    attemptKey: fixture.attemptKey,
    leaseToken: lease.token,
    leaseEpoch: lease.epoch,
    completionId: completion.completionId,
    outputKey: `output_${fixture.suffix}`,
    storageId,
    mediaType: "image",
    contentType: providerResult.contentType,
    byteSize: metadata.size,
    checksumSha256,
    eventId: `output_${fixture.suffix}`,
    occurredAt: Date.now(),
  });
  const finalized = await fixture.t.mutation(internal.durableJobs.finalize, {
    ownerId: fixture.ownerId,
    jobId: fixture.jobId,
    expectedRevision: output.revision,
    attemptKey: fixture.attemptKey,
    leaseToken: lease.token,
    leaseEpoch: lease.epoch,
    outputIds: [output.outputId],
    eventId: `finalized_${fixture.suffix}`,
    occurredAt: Date.now(),
  });
  return { storageId, metadata, checksumSha256, completion, output, finalized };
}

const safeError = (suffix: string) => ({
  category: "unknown" as const,
  code: "fake_failure",
  message: "The fake provider outcome requires reconciliation.",
  retryable: false,
  correlationId: `correlation_${suffix}`,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("durable jobs integration with fake provider", () => {
  it("atomically creates real durable records and returns an exact replay", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const first = await t.mutation(internal.durableJobs.createAndSchedule, createArgs(now, "atomic"));
    const replay = await t.mutation(internal.durableJobs.createAndSchedule, createArgs(now, "atomic"));

    expect(first.created).toBe(true);
    expect(replay).toEqual({ ...first, created: false });

    const persisted = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("durableGenerationJobs").collect(),
      attempts: await ctx.db.query("durableGenerationAttempts").collect(),
      events: await ctx.db.query("durableGenerationEvents").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(persisted.jobs).toHaveLength(1);
    expect(persisted.attempts).toHaveLength(1);
    expect(persisted.events).toHaveLength(1);
    expect(persisted.scheduled).toHaveLength(1);
    expect(persisted.scheduled[0].args).toEqual([{ jobId: first.jobId }]);
  });

  it("fences duplicate delivery so only one fake provider call can be accepted", async () => {
    const fixture = await createFixture("duplicate");
    const provider = new FakeProvider();
    const workerA = await claim(fixture, "worker_a");
    await expect(claim(fixture, "worker_b")).rejects.toThrow("LEASE_HELD");

    const submission = await begin(fixture, workerA);
    const result = provider.submit("accepted", fixture.suffix);
    const accepted = await accept(fixture, workerA, submission.revision, result.providerRequestId);

    expect(provider.calls).toBe(1);
    const current = await snapshot(fixture);
    expect(current.job).toMatchObject({ status: "processing", submissionState: "accepted", revision: accepted.revision });
    const submissions = await fixture.t.run(async (ctx) =>
      ctx.db
        .query("durableProviderSubmissions")
        .withIndex("by_job", (q) => q.eq("jobId", fixture.jobId))
        .collect(),
    );
    expect(submissions).toHaveLength(1);
  });

  it.each(["before", "after"] as const)("reclaims a crash %s dispatch as ambiguous without resubmitting", async (point) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const fixture = await createFixture(`crash_${point}`);
    const provider = new FakeProvider();
    const workerA = await claim(fixture, "worker_a", 100);
    const submission = await begin(fixture, workerA);
    if (point === "after") expect(() => provider.submit("crash", fixture.suffix)).toThrow("FAKE_PROCESS_CRASH");

    vi.advanceTimersByTime(101);
    const workerB = await claim(fixture, "worker_b");
    const current = await snapshot(fixture);
    expect(durableExecutionDecision({
      status: current.job.status,
      submissionState: current.job.submissionState,
      durableOutputCount: current.outputs.length,
    })).toBe("mark-ambiguous");
    await fixture.t.mutation(internal.durableJobs.recordSubmissionAmbiguous, {
      ownerId: fixture.ownerId,
      jobId: fixture.jobId,
      expectedRevision: workerB.revision,
      attemptKey: fixture.attemptKey,
      leaseToken: workerB.token,
      leaseEpoch: workerB.epoch,
      submissionKey: `submission_${fixture.suffix}`,
      eventId: `ambiguous_${fixture.suffix}`,
      occurredAt: Date.now(),
    });

    expect(provider.calls).toBe(point === "after" ? 1 : 0);
    expect((await snapshot(fixture)).job.submissionState).toBe("ambiguous");
    await expect(
      fixture.t.mutation(internal.durableJobs.transition, {
        ownerId: fixture.ownerId,
        jobId: fixture.jobId,
        expectedStatus: "submitting",
        expectedRevision: (await snapshot(fixture)).job.revision,
        attemptKey: fixture.attemptKey,
        leaseToken: workerB.token,
        leaseEpoch: workerB.epoch,
        targetStatus: "failed",
        eventId: `illegal_failure_${fixture.suffix}`,
        eventFingerprint: "illegal-ambiguous-terminalization",
        occurredAt: Date.now(),
        error: safeError(fixture.suffix),
      }),
    ).rejects.toThrow("AMBIGUOUS_SUBMISSION_REQUIRES_RECONCILIATION");
    expect(submission.revision).toBeGreaterThan(workerA.revision);
  });

  it("requires explicit reconciliation after an ambiguous fake timeout", async () => {
    const fixture = await createFixture("timeout");
    const provider = new FakeProvider();
    const lease = await claim(fixture, "worker");
    const submission = await begin(fixture, lease);
    expect(() => provider.submit("timeout", fixture.suffix)).toThrow("FAKE_TIMEOUT");
    const ambiguous = await fixture.t.mutation(internal.durableJobs.recordSubmissionAmbiguous, {
      ownerId: fixture.ownerId,
      jobId: fixture.jobId,
      expectedRevision: submission.revision,
      attemptKey: fixture.attemptKey,
      leaseToken: lease.token,
      leaseEpoch: lease.epoch,
      submissionKey: `submission_${fixture.suffix}`,
      eventId: `ambiguous_${fixture.suffix}`,
      occurredAt: Date.now(),
    });
    const reconciled = await fixture.t.mutation(internal.durableJobs.reconcileAmbiguousSubmission, {
      ownerId: fixture.ownerId,
      jobId: fixture.jobId,
      expectedRevision: ambiguous.revision,
      attemptKey: fixture.attemptKey,
      leaseToken: lease.token,
      leaseEpoch: lease.epoch,
      submissionKey: `submission_${fixture.suffix}`,
      outcome: "failed",
      error: safeError(fixture.suffix),
      eventId: `reconciled_${fixture.suffix}`,
      occurredAt: Date.now(),
    });

    expect(provider.calls).toBe(1);
    expect(reconciled.status).toBe("failed");
    expect((await snapshot(fixture)).job).toMatchObject({ status: "failed", submissionState: "reconciled" });
  });

  it("persists verified storage, finalizes once, and accepts exact terminal replay", async () => {
    const fixture = await createFixture("success");
    const provider = new FakeProvider();
    const lease = await claim(fixture, "worker");
    const submission = await begin(fixture, lease);
    const providerResult = provider.submit("accepted", fixture.suffix);
    const accepted = await accept(fixture, lease, submission.revision, providerResult.providerRequestId);
    const persisted = await persistFakeOutput(fixture, lease, accepted.revision, providerResult);

    const completionReplay = await fixture.t.mutation(internal.durableJobs.recordProviderCompletion, {
      ownerId: fixture.ownerId,
      jobId: fixture.jobId,
      expectedRevision: accepted.revision,
      attemptKey: fixture.attemptKey,
      leaseToken: lease.token,
      leaseEpoch: lease.epoch,
      providerRequestId: providerResult.providerRequestId,
      outputIdentityKind: "checksum",
      outputIdentity: persisted.checksumSha256,
      eventId: `completed_${fixture.suffix}`,
      occurredAt: Date.now(),
    });
    const finalizeReplay = await fixture.t.mutation(internal.durableJobs.finalize, {
      ownerId: fixture.ownerId,
      jobId: fixture.jobId,
      expectedRevision: persisted.output.revision,
      attemptKey: fixture.attemptKey,
      leaseToken: lease.token,
      leaseEpoch: lease.epoch,
      outputIds: [persisted.output.outputId],
      eventId: `finalized_${fixture.suffix}`,
      occurredAt: Date.now(),
    });

    expect(provider.calls).toBe(1);
    expect(completionReplay).toMatchObject({ completionId: persisted.completion.completionId, replay: true });
    expect(finalizeReplay.revision).toBe(persisted.finalized.revision);
    expect((await snapshot(fixture)).job).toMatchObject({ status: "completed", revision: persisted.finalized.revision });
  });

  it("fences a stale worker after lease reclaim", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    const fixture = await createFixture("stale_lease");
    const workerA = await claim(fixture, "worker_a", 100);
    const submission = await begin(fixture, workerA);
    vi.advanceTimersByTime(101);
    const workerB = await claim(fixture, "worker_b");

    await expect(
      fixture.t.mutation(internal.durableJobs.recordSubmissionAmbiguous, {
        ownerId: fixture.ownerId,
        jobId: fixture.jobId,
        expectedRevision: workerB.revision,
        attemptKey: fixture.attemptKey,
        leaseToken: workerA.token,
        leaseEpoch: workerA.epoch,
        submissionKey: `submission_${fixture.suffix}`,
        eventId: `stale_write_${fixture.suffix}`,
        occurredAt: Date.now(),
      }),
    ).rejects.toThrow("LEASE_FENCED");
    expect(submission.revision).toBeGreaterThan(workerA.revision);
  });

  it("clears unsupported cancellation and leaves an unlinked legacy row untouched", async () => {
    const fixture = await createFixture("cancel_unsupported");
    const legacyId = await fixture.t.run(async (ctx) =>
      ctx.db.insert("generations", {
        userId: OWNER,
        prompt: "historical legacy prompt",
        mode: "text-to-image",
        aspectRatio: "square",
        imageSize: "2K",
        createdAt: Date.now() - 1_000,
        status: "completed",
      }),
    );
    const provider = new FakeProvider();
    const lease = await claim(fixture, "worker");
    const submission = await begin(fixture, lease);
    const providerResult = provider.submit("accepted", fixture.suffix);
    const accepted = await accept(fixture, lease, submission.revision, providerResult.providerRequestId);
    const requested = await fixture.t.mutation(internal.durableJobs.requestCancellation, {
      ownerId: fixture.ownerId,
      jobId: fixture.jobId,
      expectedStatus: "processing",
      expectedRevision: accepted.revision,
      eventId: `cancel_${fixture.suffix}`,
      occurredAt: Date.now(),
    });
    const observed = await fixture.t.mutation(internal.durableJobs.observeCancellation, {
      ownerId: fixture.ownerId,
      jobId: fixture.jobId,
      expectedStatus: "processing",
      expectedRevision: requested.revision,
      outcome: "unsupported",
      eventId: `cancel_observed_${fixture.suffix}`,
      occurredAt: Date.now(),
    });
    const persisted = await persistFakeOutput(fixture, lease, observed.revision, providerResult);

    expect((await snapshot(fixture)).job).toMatchObject({
      status: "completed",
      cancellationRequested: false,
      cancellationOutcome: "unsupported",
      revision: persisted.finalized.revision,
    });
    const legacy = await fixture.t.run(async (ctx) => ctx.db.get(legacyId));
    expect(legacy).toMatchObject({
      prompt: "historical legacy prompt",
      status: "completed",
    });
    expect(legacy?.durableJobId).toBeUndefined();
  });

  it("handles local cancellation and remote cancellation races without resurrection", async () => {
    const queued = await createFixture("cancel_local");
    const local = await queued.t.mutation(internal.durableJobs.requestCancellation, {
      ownerId: queued.ownerId,
      jobId: queued.jobId,
      expectedStatus: "queued",
      expectedRevision: 0,
      eventId: `cancel_${queued.suffix}`,
      occurredAt: Date.now(),
    });
    expect(local.status).toBe("cancelled");
    await expect(claim(queued, "worker")).rejects.toThrow("JOB_NOT_CLAIMABLE");

    const remote = await createFixture("cancel_remote");
    const provider = new FakeProvider();
    const lease = await claim(remote, "worker");
    const submission = await begin(remote, lease);
    const providerResult = provider.submit("accepted", remote.suffix);
    const accepted = await accept(remote, lease, submission.revision, providerResult.providerRequestId);
    const requested = await remote.t.mutation(internal.durableJobs.requestCancellation, {
      ownerId: remote.ownerId,
      jobId: remote.jobId,
      expectedStatus: "processing",
      expectedRevision: accepted.revision,
      eventId: `cancel_${remote.suffix}`,
      occurredAt: Date.now(),
    });
    const observed = await remote.t.mutation(internal.durableJobs.observeCancellation, {
      ownerId: remote.ownerId,
      jobId: remote.jobId,
      expectedStatus: "processing",
      expectedRevision: requested.revision,
      outcome: "accepted",
      eventId: `cancel_observed_${remote.suffix}`,
      occurredAt: Date.now(),
    });
    expect(observed.status).toBe("cancelled");
    await expect(
      remote.t.mutation(internal.durableJobs.recordProviderCompletion, {
        ownerId: remote.ownerId,
        jobId: remote.jobId,
        expectedRevision: observed.revision,
        attemptKey: remote.attemptKey,
        leaseToken: lease.token,
        leaseEpoch: lease.epoch,
        providerRequestId: providerResult.providerRequestId,
        outputIdentityKind: "checksum",
        outputIdentity: "a".repeat(64),
        eventId: `late_completion_${remote.suffix}`,
        occurredAt: Date.now(),
      }),
    ).rejects.toThrow("TERMINAL_IMMUTABLE");
  });
});
