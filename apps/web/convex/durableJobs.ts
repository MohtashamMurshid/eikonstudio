import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import {
  assertBoundedJsonObject,
  assertExpectedState,
  assertExpectedTransition,
  assertLeaseClaimable,
  assertLeaseFence,
  assertMayAutomaticallySubmit,
  assertMayTerminateWithoutReconciliation,
  assertSafePublicError,
  assertSubmissionAcknowledgementAllowed,
  classifyEventReplay,
  classifyIdempotentCreate,
  completionIdentityKey,
  DURABLE_JOB_STATUSES,
  nextLeaseEpoch,
  TERMINAL_DURABLE_JOB_STATUSES,
  type DurableJobStatus,
} from "./durableJobPolicy";
import { replaceDocumentStorageReferences } from "./storageReferenceLedger";

const statusValidator = v.union(...DURABLE_JOB_STATUSES.map((status) => v.literal(status)));
const providerValidator = v.union(
  v.literal("openai"),
  v.literal("google"),
  v.literal("bfl"),
  v.literal("byteplus"),
  v.literal("kling"),
  v.literal("xai"),
);
const eventTypeValidator = v.union(
  v.literal("created"),
  v.literal("claimed"),
  v.literal("transitioned"),
  v.literal("submission_accepted"),
  v.literal("submission_ambiguous"),
  v.literal("submission_reconciled"),
  v.literal("cancellation_requested"),
  v.literal("cancellation_observed"),
  v.literal("provider_completed"),
  v.literal("output_persisted"),
  v.literal("finalized"),
  v.literal("tombstoned"),
);
const errorCategoryValidator = v.union(
  v.literal("authentication"),
  v.literal("billing-access"),
  v.literal("validation"),
  v.literal("rate-limit"),
  v.literal("moderation"),
  v.literal("provider-unavailable"),
  v.literal("timeout"),
  v.literal("cancelled"),
  v.literal("unknown"),
);
const safeErrorValidator = v.object({
  category: errorCategoryValidator,
  code: v.string(),
  message: v.string(),
  retryable: v.boolean(),
  correlationId: v.string(),
});

type SafeError = {
  category: "authentication" | "billing-access" | "validation" | "rate-limit" | "moderation" | "provider-unavailable" | "timeout" | "cancelled" | "unknown";
  code: string;
  message: string;
  retryable: boolean;
  correlationId: string;
};

function fail(code: string): never {
  throw new ConvexError(code);
}

function bounded(value: string, max: number, code: string): void {
  if (value.length < 1 || value.length > max) fail(code);
}

function opaque(value: string, max: number, code: string): void {
  if (value.length < 1 || value.length > max || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) fail(code);
}

function trustedInstant(occurredAt: number, now = Date.now()): void {
  if (!Number.isFinite(occurredAt) || occurredAt <= 0 || occurredAt < now - 604_800_000 || occurredAt > now + 60_000) {
    fail("INVALID_OCCURRED_AT");
  }
}

function validateSafeError(error: SafeError): void {
  try {
    assertSafePublicError(error);
  } catch {
    fail("UNSAFE_PUBLIC_ERROR");
  }
}

function terminalErrorPatch(error: SafeError) {
  return {
    publicErrorCategory: error.category,
    publicErrorCode: error.code,
    publicErrorMessage: error.message,
    publicErrorRetryable: error.retryable,
    publicErrorCorrelationId: error.correlationId,
  };
}

async function loadOwnedJob(
  ctx: MutationCtx,
  ownerId: string,
  jobId: Id<"durableGenerationJobs">,
): Promise<Doc<"durableGenerationJobs">> {
  const job = await ctx.db.get(jobId);
  if (!job || job.ownerId !== ownerId) fail("JOB_NOT_FOUND");
  return job;
}

async function loadAttempt(
  ctx: MutationCtx,
  job: Doc<"durableGenerationJobs">,
  attemptKey: string,
): Promise<Doc<"durableGenerationAttempts">> {
  bounded(attemptKey, 512, "INVALID_ATTEMPT_KEY");
  const attempt = await ctx.db
    .query("durableGenerationAttempts")
    .withIndex("by_attempt_key", (q) => q.eq("attemptKey", attemptKey))
    .unique();
  if (
    !attempt ||
    attempt.jobId !== job._id ||
    attempt.ownerId !== job.ownerId ||
    attempt.generationKey !== job.generationKey
  ) {
    fail("ATTEMPT_NOT_FOUND");
  }
  return attempt;
}

async function patchJobAttemptsStatus(
  ctx: MutationCtx,
  job: Doc<"durableGenerationJobs">,
  status: DurableJobStatus,
  updatedAt: number,
): Promise<void> {
  const attempts = await ctx.db
    .query("durableGenerationAttempts")
    .withIndex("by_job", (q) => q.eq("jobId", job._id))
    .take(101);
  if (attempts.length > 100) fail("ATTEMPT_LIMIT_EXCEEDED");
  for (const attempt of attempts) {
    if (attempt.ownerId !== job.ownerId || attempt.generationKey !== job.generationKey) fail("ATTEMPT_BINDING_INVALID");
    await ctx.db.patch(attempt._id, { status, updatedAt });
  }
}

function expectState(job: Doc<"durableGenerationJobs">, status: DurableJobStatus, revision: number): void {
  try {
    assertExpectedState(job, { status, revision });
  } catch (error) {
    fail(error instanceof Error ? error.message : "STALE_JOB");
  }
}

function expectTransition(
  job: Doc<"durableGenerationJobs">,
  status: DurableJobStatus,
  revision: number,
  target: DurableJobStatus,
): void {
  try {
    assertExpectedTransition(job, { status, revision }, target);
  } catch (error) {
    fail(error instanceof Error ? error.message : "INVALID_TRANSITION");
  }
}

function fenceWorker(
  job: Doc<"durableGenerationJobs">,
  attempt: Doc<"durableGenerationAttempts">,
  leaseToken: string,
  leaseEpoch: number,
): void {
  opaque(leaseToken, 256, "INVALID_LEASE_TOKEN");
  const now = Date.now();
  if (job.expiresAt <= now) fail("JOB_EXPIRED");
  try {
    assertLeaseFence(
      {
        owner: job.leaseOwner,
        token: job.leaseToken,
        epoch: job.leaseEpoch,
        expiresAt: job.leaseExpiresAt,
      },
      { token: leaseToken, epoch: leaseEpoch },
      now,
    );
  } catch {
    fail("LEASE_FENCED");
  }
  if (attempt.leaseToken !== leaseToken || attempt.leaseEpoch !== leaseEpoch) fail("LEASE_FENCED");
}

async function replayedRevision(
  ctx: MutationCtx,
  eventId: string,
  job: Doc<"durableGenerationJobs">,
  eventType: Doc<"durableGenerationEvents">["eventType"],
  eventFingerprint: string,
): Promise<number | undefined> {
  const existing = await ctx.db
    .query("durableGenerationEvents")
    .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
    .unique();
  if (!existing) return undefined;
  try {
    classifyEventReplay(existing, { jobKey: job.jobKey, eventType, eventFingerprint });
  } catch {
    fail("EVENT_ID_COLLISION");
  }
  if (existing.ownerId !== job.ownerId || existing.generationKey !== job.generationKey) fail("EVENT_ID_COLLISION");
  return existing.revision;
}

async function insertEvent(
  ctx: MutationCtx,
  job: Doc<"durableGenerationJobs">,
  event: {
    eventId: string;
    eventType: Doc<"durableGenerationEvents">["eventType"];
    eventFingerprint: string;
    revision: number;
    occurredAt: number;
    attemptId?: Id<"durableGenerationAttempts">;
  },
): Promise<void> {
  bounded(event.eventId, 256, "INVALID_EVENT_ID");
  bounded(event.eventFingerprint, 2_048, "INVALID_EVENT_FINGERPRINT");
  const replay = await replayedRevision(ctx, event.eventId, job, event.eventType, event.eventFingerprint);
  if (replay !== undefined) return;
  await ctx.db.insert("durableGenerationEvents", {
    ownerId: job.ownerId,
    jobId: job._id,
    jobKey: job.jobKey,
    generationKey: job.generationKey,
    ...event,
  });
}

async function assertProviderRequestAvailable(
  ctx: MutationCtx,
  job: Doc<"durableGenerationJobs">,
  attempt: Doc<"durableGenerationAttempts">,
  providerRequestId: string,
): Promise<void> {
  opaque(providerRequestId, 256, "INVALID_PROVIDER_REQUEST_ID");
  const matches = await ctx.db
    .query("durableProviderSubmissions")
    .withIndex("by_provider_request", (q) => q.eq("provider", job.provider).eq("providerRequestId", providerRequestId))
    .take(2);
  for (const match of matches) {
    if (
      match.jobId !== job._id ||
      match.attemptId !== attempt._id ||
      match.ownerId !== job.ownerId ||
      match.credentialHandle !== job.credentialHandle
    ) {
      fail("PROVIDER_REQUEST_ID_COLLISION");
    }
  }
}

type DurableCreateArgs = {
  ownerId: string;
  jobKey: string;
  generationKey: string;
  idempotencyKey: string;
  requestFingerprint: string;
  provider: "openai" | "google" | "bfl" | "byteplus" | "kling" | "xai";
  credentialHandle: string;
  modelId: string;
  requestMetadataJson: string;
  maxAgeSeconds: number;
  scheduleAt: number;
  eventId: string;
  occurredAt: number;
};

/** Creates the durable rows inside the caller's mutation transaction. The caller must schedule work before returning. */
export async function createDurableJobRecords(
  ctx: MutationCtx,
  args: DurableCreateArgs,
): Promise<{ jobId: Id<"durableGenerationJobs">; created: boolean; revision: number }> {
  const creationNow = Date.now();
  bounded(args.ownerId, 256, "INVALID_OWNER");
  bounded(args.jobKey, 256, "INVALID_JOB_KEY");
  bounded(args.generationKey, 256, "INVALID_GENERATION_KEY");
  bounded(args.idempotencyKey, 256, "INVALID_IDEMPOTENCY_KEY");
  bounded(args.requestFingerprint, 256, "INVALID_REQUEST_FINGERPRINT");
  bounded(args.modelId, 256, "INVALID_MODEL");
  opaque(args.credentialHandle, 256, "INVALID_CREDENTIAL_HANDLE");
  try {
    assertBoundedJsonObject(args.requestMetadataJson);
  } catch {
    fail("INVALID_REQUEST_METADATA");
  }
  if (
    !Number.isInteger(args.maxAgeSeconds) ||
    args.maxAgeSeconds < 1 ||
    args.maxAgeSeconds > 604_800 ||
    args.scheduleAt < creationNow - 60_000 ||
    args.scheduleAt > creationNow + args.maxAgeSeconds * 1000
  ) {
    fail("INVALID_SCHEDULE");
  }

  const existing = await ctx.db
    .query("durableGenerationJobs")
    .withIndex("by_owner_idempotency", (q) => q.eq("ownerId", args.ownerId).eq("idempotencyKey", args.idempotencyKey))
    .unique();
  if (existing) {
    try {
      classifyIdempotentCreate(existing.requestFingerprint, args.requestFingerprint);
    } catch {
      fail("IDEMPOTENCY_COLLISION");
    }
    if (
      existing.jobKey !== args.jobKey ||
      existing.generationKey !== args.generationKey ||
      existing.provider !== args.provider ||
      existing.credentialHandle !== args.credentialHandle ||
      existing.modelId !== args.modelId ||
      existing.requestMetadataJson !== args.requestMetadataJson
    ) {
      fail("IDEMPOTENCY_COLLISION");
    }
    return { jobId: existing._id, created: false, revision: existing.revision };
  }
  const duplicateJobKey = await ctx.db
    .query("durableGenerationJobs")
    .withIndex("by_job_key", (q) => q.eq("jobKey", args.jobKey))
    .unique();
  if (duplicateJobKey) fail("JOB_KEY_COLLISION");
  trustedInstant(args.occurredAt, creationNow);

  const expiresAt = creationNow + args.maxAgeSeconds * 1000;
  const jobId = await ctx.db.insert("durableGenerationJobs", {
    ownerId: args.ownerId,
    jobKey: args.jobKey,
    generationKey: args.generationKey,
    idempotencyKey: args.idempotencyKey,
    requestFingerprint: args.requestFingerprint,
    provider: args.provider,
    credentialHandle: args.credentialHandle,
    modelId: args.modelId,
    requestMetadataJson: args.requestMetadataJson,
    status: "queued",
    revision: 0,
    submissionState: "not_started",
    cancellationRequested: false,
    leaseEpoch: 0,
    maxAgeSeconds: args.maxAgeSeconds,
    expiresAt,
    createdAt: creationNow,
    updatedAt: creationNow,
  });
  const attemptId = await ctx.db.insert("durableGenerationAttempts", {
    ownerId: args.ownerId,
    jobId,
    jobKey: args.jobKey,
    generationKey: args.generationKey,
    attemptKey: `${args.jobKey}:1`,
    attemptNumber: 1,
    status: "queued",
    submissionState: "not_started",
    leaseEpoch: 0,
    createdAt: creationNow,
    updatedAt: creationNow,
  });
  const job = await ctx.db.get(jobId);
  if (!job) fail("JOB_NOT_FOUND");
  await insertEvent(ctx, job, {
    eventId: args.eventId,
    eventType: "created",
    eventFingerprint: args.requestFingerprint,
    revision: 0,
    occurredAt: args.occurredAt,
    attemptId,
  });
  return { jobId, created: true, revision: 0 };
}

/** Atomically creates the job, first attempt/event, and inspection scheduler record. */
export const createAndSchedule = internalMutation({
  args: {
    ownerId: v.string(),
    jobKey: v.string(),
    generationKey: v.string(),
    idempotencyKey: v.string(),
    requestFingerprint: v.string(),
    provider: providerValidator,
    credentialHandle: v.string(),
    modelId: v.string(),
    requestMetadataJson: v.string(),
    maxAgeSeconds: v.number(),
    scheduleAt: v.number(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ jobId: v.id("durableGenerationJobs"), created: v.boolean(), revision: v.number() }),
  handler: async (ctx, args) => {
    const result = await createDurableJobRecords(ctx, args);
    if (result.created) {
      const jobId = result.jobId;
      await ctx.scheduler.runAt(args.scheduleAt, internal.durableJobs.inspectScheduledJob, { jobId });
    }
    return result;
  },
});

/** Scheduler target intentionally inspects state only; provider dispatch is out of scope. */
export const inspectScheduledJob = internalMutation({
  args: { jobId: v.id("durableGenerationJobs") },
  returns: v.union(v.null(), v.object({ status: statusValidator, revision: v.number(), submissionState: v.string() })),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    return job ? { status: job.status, revision: job.revision, submissionState: job.submissionState } : null;
  },
});

export const getInternal = internalQuery({
  args: { ownerId: v.string(), jobId: v.id("durableGenerationJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    return job?.ownerId === args.ownerId ? job : null;
  },
});

/** Internal scheduler snapshot with strict cross-table ownership/linkage checks. */
export const getScheduledExecutionInternal = internalQuery({
  args: { jobId: v.id("durableGenerationJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    const attempts = await ctx.db
      .query("durableGenerationAttempts")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .take(17);
    if (attempts.length === 0 || attempts.length > 16) throw new Error("Durable attempt binding is invalid");
    const attempt = attempts.reduce((latest, candidate) =>
      candidate.attemptNumber > latest.attemptNumber ? candidate : latest,
    );
    if (attempt.ownerId !== job.ownerId || attempt.generationKey !== job.generationKey) {
      throw new Error("Durable attempt binding is invalid");
    }
    const outputs = await ctx.db
      .query("durableGenerationOutputs")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .take(17);
    if (
      outputs.length > 16 ||
      outputs.some((output) => output.ownerId !== job.ownerId || output.generationKey !== job.generationKey)
    ) {
      throw new Error("Durable output binding is invalid");
    }
    const generation = await ctx.db
      .query("generations")
      .withIndex("by_durable_job", (q) => q.eq("durableJobId", jobId))
      .unique();
    if (
      !generation ||
      generation.userId !== job.ownerId ||
      generation.durableGenerationKey !== job.generationKey ||
      generation.credentialHandle !== job.credentialHandle ||
      generation.credentialProvider !== job.provider
    ) {
      throw new Error("Legacy generation binding is invalid");
    }
    return { job, attempt, outputs, generation };
  },
});

/** Read-only, bounded migration inventory. It never rewrites legacy generation rows. */
export const inventoryLegacyGenerationPageInternal = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("generations").order("asc").paginate(args.paginationOpts);
    return {
      scanned: result.page.length,
      byLegacyStatus: {
        pending: result.page.filter((row) => row.status === "pending").length,
        generating: result.page.filter((row) => row.status === "generating").length,
        completed: result.page.filter((row) => row.status === "completed").length,
        failed: result.page.filter((row) => row.status === "failed").length,
        unset: result.page.filter((row) => row.status === undefined).length,
      },
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const claim = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    attemptKey: v.string(),
    expectedStatus: statusValidator,
    expectedRevision: v.number(),
    leaseOwner: v.string(),
    leaseToken: v.string(),
    leaseDurationMs: v.number(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number(), leaseEpoch: v.number(), leaseExpiresAt: v.number() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    const leaseNow = Date.now();
    const fingerprint = `${args.leaseOwner}:${args.leaseToken}:${args.leaseDurationMs}:${args.occurredAt}`;
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "claimed", fingerprint);
    if (replayRevision !== undefined) {
      if (job.leaseToken !== args.leaseToken || attempt.leaseToken !== args.leaseToken) fail("LEASE_FENCED");
      return {
        revision: replayRevision,
        leaseEpoch: job.leaseEpoch,
        leaseExpiresAt: job.leaseExpiresAt ?? args.occurredAt,
      };
    }
    trustedInstant(args.occurredAt, leaseNow);
    expectState(job, args.expectedStatus, args.expectedRevision);
    if (TERMINAL_DURABLE_JOB_STATUSES.has(job.status) || job.cancellationRequested || job.expiresAt <= leaseNow) {
      fail("JOB_NOT_CLAIMABLE");
    }
    bounded(args.leaseOwner, 256, "INVALID_LEASE_OWNER");
    opaque(args.leaseToken, 256, "INVALID_LEASE_TOKEN");
    if (!Number.isInteger(args.leaseDurationMs) || args.leaseDurationMs < 1 || args.leaseDurationMs > 300_000) {
      fail("INVALID_LEASE_DURATION");
    }
    try {
      assertLeaseClaimable(
        { owner: job.leaseOwner, token: job.leaseToken, epoch: job.leaseEpoch, expiresAt: job.leaseExpiresAt },
        args.leaseOwner,
        args.leaseToken,
        leaseNow,
      );
    } catch {
      fail("LEASE_HELD");
    }
    const leaseEpoch = nextLeaseEpoch(
      { owner: job.leaseOwner, token: job.leaseToken, epoch: job.leaseEpoch, expiresAt: job.leaseExpiresAt },
      args.leaseOwner,
      args.leaseToken,
      leaseNow,
    );
    const leaseExpiresAt = leaseNow + args.leaseDurationMs;
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "claimed",
      eventFingerprint: fingerprint,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(job._id, {
      leaseOwner: args.leaseOwner,
      leaseToken: args.leaseToken,
      leaseEpoch,
      leaseExpiresAt,
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
    });
    await ctx.db.patch(attempt._id, { leaseToken: args.leaseToken, leaseEpoch, updatedAt: args.occurredAt });
    return { revision: job.revision + 1, leaseEpoch, leaseExpiresAt };
  },
});

/** Generic transition is intentionally restricted so specialized persistence/cancellation paths cannot be bypassed. */
export const transition = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedStatus: statusValidator,
    expectedRevision: v.number(),
    attemptKey: v.optional(v.string()),
    leaseToken: v.optional(v.string()),
    leaseEpoch: v.optional(v.number()),
    targetStatus: v.union(v.literal("failed"), v.literal("expired")),
    eventId: v.string(),
    eventFingerprint: v.string(),
    occurredAt: v.number(),
    error: v.optional(safeErrorValidator),
  },
  returns: v.object({ revision: v.number(), replay: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "transitioned", args.eventFingerprint);
    if (replayRevision !== undefined) return { revision: replayRevision, replay: true };
    trustedInstant(args.occurredAt);
    if (args.targetStatus === "failed" && (job.leaseExpiresAt ?? 0) > Date.now()) {
      if (!args.attemptKey || !args.leaseToken || args.leaseEpoch === undefined) fail("LEASE_FENCE_REQUIRED");
      const attempt = await loadAttempt(ctx, job, args.attemptKey);
      fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    }
    try {
      assertMayTerminateWithoutReconciliation(job.submissionState);
    } catch {
      fail("AMBIGUOUS_SUBMISSION_REQUIRES_RECONCILIATION");
    }
    if (job.cancellationRequested) fail("CANCELLATION_REQUIRES_OBSERVATION");
    if (args.targetStatus === "expired" && Date.now() < job.expiresAt) fail("JOB_NOT_EXPIRED");
    expectTransition(job, args.expectedStatus, args.expectedRevision, args.targetStatus);
    if (args.targetStatus === "failed") {
      if (!args.error) fail("SAFE_ERROR_REQUIRED");
      validateSafeError(args.error);
    } else if (args.error) {
      fail("ERROR_NOT_ALLOWED");
    }
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "transitioned",
      eventFingerprint: args.eventFingerprint,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
    });
    await ctx.db.patch(job._id, {
      status: args.targetStatus,
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
      terminalAt: args.occurredAt,
      leaseOwner: undefined,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      ...(args.error ? terminalErrorPatch(args.error) : {}),
    });
    await patchJobAttemptsStatus(ctx, job, args.targetStatus, args.occurredAt);
    return { revision: job.revision + 1, replay: false };
  },
});

export const beginSubmission = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedRevision: v.number(),
    attemptKey: v.string(),
    leaseToken: v.string(),
    leaseEpoch: v.number(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "transitioned", "queued:submitting");
    if (replayRevision !== undefined) return { revision: replayRevision };
    trustedInstant(args.occurredAt);
    fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    if (job.cancellationRequested) fail("CANCELLATION_REQUESTED");
    expectTransition(job, "queued", args.expectedRevision, "submitting");
    try {
      assertMayAutomaticallySubmit(job.submissionState);
    } catch {
      fail("AMBIGUOUS_SUBMISSION_REQUIRES_RECONCILIATION");
    }
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "transitioned",
      eventFingerprint: "queued:submitting",
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(job._id, {
      status: "submitting",
      submissionState: "in_flight",
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
    });
    await ctx.db.patch(attempt._id, {
      status: "submitting",
      submissionState: "in_flight",
      updatedAt: args.occurredAt,
    });
    return { revision: job.revision + 1 };
  },
});

export const recordSubmissionAccepted = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedRevision: v.number(),
    attemptKey: v.string(),
    leaseToken: v.string(),
    leaseEpoch: v.number(),
    submissionKey: v.string(),
    providerRequestId: v.string(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    const acceptedFingerprint = JSON.stringify([args.submissionKey, args.providerRequestId]);
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "submission_accepted", acceptedFingerprint);
    if (replayRevision !== undefined) return { revision: replayRevision };
    opaque(args.submissionKey, 256, "INVALID_SUBMISSION_KEY");
    await assertProviderRequestAvailable(ctx, job, attempt, args.providerRequestId);
    const duplicate = await ctx.db
      .query("durableProviderSubmissions")
      .withIndex("by_submission_key", (q) => q.eq("submissionKey", args.submissionKey))
      .unique();
    if (duplicate) {
      if (
        duplicate.jobId === job._id &&
        duplicate.attemptId === attempt._id &&
        duplicate.state === "accepted" &&
        duplicate.providerRequestId === args.providerRequestId
      ) {
        return { revision: job.revision };
      }
      fail("SUBMISSION_KEY_COLLISION");
    }
    trustedInstant(args.occurredAt);
    try {
      assertSubmissionAcknowledgementAllowed(job.submissionState, attempt.submissionState);
    } catch {
      fail("SUBMISSION_NOT_IN_FLIGHT");
    }
    fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    expectTransition(job, "submitting", args.expectedRevision, "processing");
    await ctx.db.insert("durableProviderSubmissions", {
      ownerId: job.ownerId,
      jobId: job._id,
      generationKey: job.generationKey,
      credentialHandle: job.credentialHandle,
      attemptId: attempt._id,
      submissionKey: args.submissionKey,
      provider: job.provider,
      state: "accepted",
      providerRequestId: args.providerRequestId,
      createdAt: args.occurredAt,
      updatedAt: args.occurredAt,
    });
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "submission_accepted",
      eventFingerprint: acceptedFingerprint,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(job._id, {
      status: "processing",
      submissionState: "accepted",
      providerRequestId: args.providerRequestId,
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
    });
    await ctx.db.patch(attempt._id, {
      status: "processing",
      submissionState: "accepted",
      providerRequestId: args.providerRequestId,
      updatedAt: args.occurredAt,
    });
    return { revision: job.revision + 1 };
  },
});

export const recordSubmissionAmbiguous = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedRevision: v.number(),
    attemptKey: v.string(),
    leaseToken: v.string(),
    leaseEpoch: v.number(),
    submissionKey: v.string(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "submission_ambiguous", args.submissionKey);
    if (replayRevision !== undefined) return { revision: replayRevision };
    opaque(args.submissionKey, 256, "INVALID_SUBMISSION_KEY");
    const duplicate = await ctx.db
      .query("durableProviderSubmissions")
      .withIndex("by_submission_key", (q) => q.eq("submissionKey", args.submissionKey))
      .unique();
    if (duplicate) {
      if (duplicate.jobId === job._id && duplicate.attemptId === attempt._id && duplicate.state === "ambiguous") {
        return { revision: job.revision };
      }
      fail("SUBMISSION_KEY_COLLISION");
    }
    trustedInstant(args.occurredAt);
    try {
      assertSubmissionAcknowledgementAllowed(job.submissionState, attempt.submissionState);
    } catch {
      fail("SUBMISSION_NOT_IN_FLIGHT");
    }
    fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    expectState(job, "submitting", args.expectedRevision);
    await ctx.db.insert("durableProviderSubmissions", {
      ownerId: job.ownerId,
      jobId: job._id,
      generationKey: job.generationKey,
      credentialHandle: job.credentialHandle,
      attemptId: attempt._id,
      submissionKey: args.submissionKey,
      provider: job.provider,
      state: "ambiguous",
      createdAt: args.occurredAt,
      updatedAt: args.occurredAt,
    });
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "submission_ambiguous",
      eventFingerprint: args.submissionKey,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(job._id, {
      submissionState: "ambiguous",
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
    });
    await ctx.db.patch(attempt._id, { submissionState: "ambiguous", updatedAt: args.occurredAt });
    return { revision: job.revision + 1 };
  },
});

/** The only path out of ambiguous submission; accepted and definitive failure remain distinct. */
export const reconcileAmbiguousSubmission = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedRevision: v.number(),
    attemptKey: v.string(),
    leaseToken: v.string(),
    leaseEpoch: v.number(),
    submissionKey: v.string(),
    outcome: v.union(v.literal("accepted"), v.literal("failed")),
    providerRequestId: v.optional(v.string()),
    error: v.optional(safeErrorValidator),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number(), status: statusValidator }),
  handler: async (ctx, args): Promise<{ revision: number; status: DurableJobStatus }> => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    const fingerprint = JSON.stringify([
      args.submissionKey,
      args.outcome,
      args.providerRequestId ?? null,
      args.error ? [args.error.category, args.error.code, args.error.message, args.error.retryable, args.error.correlationId] : null,
    ]);
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "submission_reconciled", fingerprint);
    if (replayRevision !== undefined) {
      return { revision: replayRevision, status: job.status };
    }
    const submission = await ctx.db
      .query("durableProviderSubmissions")
      .withIndex("by_submission_key", (q) => q.eq("submissionKey", args.submissionKey))
      .unique();
    if (!submission || submission.jobId !== job._id || submission.attemptId !== attempt._id) {
      fail("SUBMISSION_NOT_FOUND");
    }
    if (submission.state === "reconciled") {
      const sameAccepted =
        args.outcome === "accepted" &&
        submission.reconciliationOutcome === "accepted" &&
        submission.providerRequestId === args.providerRequestId &&
        !args.error;
      const sameFailed =
        args.outcome === "failed" &&
        submission.reconciliationOutcome === "failed" &&
        !args.providerRequestId &&
        args.error?.category === job.publicErrorCategory &&
        args.error?.code === job.publicErrorCode &&
        args.error?.message === job.publicErrorMessage &&
        args.error?.retryable === job.publicErrorRetryable &&
        args.error?.correlationId === job.publicErrorCorrelationId;
      if (sameAccepted || sameFailed) {
        return { revision: job.revision, status: job.status };
      }
      fail("RECONCILIATION_COLLISION");
    }
    if (submission.state !== "ambiguous") fail("SUBMISSION_NOT_FOUND");
    trustedInstant(args.occurredAt);
    fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    expectState(job, "submitting", args.expectedRevision);
    if (job.submissionState !== "ambiguous") fail("SUBMISSION_NOT_AMBIGUOUS");
    if (args.outcome === "accepted") {
      if (!args.providerRequestId || args.error) fail("INVALID_RECONCILIATION_RESULT");
      await assertProviderRequestAvailable(ctx, job, attempt, args.providerRequestId);
    } else {
      if (args.providerRequestId || !args.error) fail("INVALID_RECONCILIATION_RESULT");
      validateSafeError(args.error);
      if (job.cancellationRequested) fail("CANCELLATION_REQUIRES_OBSERVATION");
    }
    const status: DurableJobStatus = args.outcome === "accepted" ? "processing" : "failed";
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "submission_reconciled",
      eventFingerprint: fingerprint,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(submission._id, {
      state: "reconciled",
      providerRequestId: args.providerRequestId,
      reconciliationOutcome: args.outcome,
      updatedAt: args.occurredAt,
    });
    await ctx.db.patch(job._id, {
      status,
      submissionState: "reconciled",
      providerRequestId: args.providerRequestId,
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
      ...(args.error ? { ...terminalErrorPatch(args.error), terminalAt: args.occurredAt, leaseOwner: undefined, leaseToken: undefined, leaseExpiresAt: undefined } : {}),
    });
    await ctx.db.patch(attempt._id, {
      status,
      submissionState: "reconciled",
      providerRequestId: args.providerRequestId,
      updatedAt: args.occurredAt,
    });
    return { revision: job.revision + 1, status };
  },
});

export const requestCancellation = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedStatus: statusValidator,
    expectedRevision: v.number(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number(), status: statusValidator }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "cancellation_requested", "requested");
    if (replayRevision !== undefined) return { revision: replayRevision, status: job.status };
    trustedInstant(args.occurredAt);
    expectState(job, args.expectedStatus, args.expectedRevision);
    if (TERMINAL_DURABLE_JOB_STATUSES.has(job.status)) fail("TERMINAL_IMMUTABLE");
    const queued = job.status === "queued";
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "cancellation_requested",
      eventFingerprint: "requested",
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
    });
    await ctx.db.patch(job._id, {
      cancellationRequested: !queued,
      cancellationRequestedAt: args.occurredAt,
      ...(queued ? { status: "cancelled" as const, cancellationObservedAt: args.occurredAt, cancellationOutcome: "local" as const, terminalAt: args.occurredAt, leaseOwner: undefined, leaseToken: undefined, leaseExpiresAt: undefined } : {}),
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
    });
    if (queued) await patchJobAttemptsStatus(ctx, job, "cancelled", args.occurredAt);
    return { revision: job.revision + 1, status: queued ? "cancelled" : job.status };
  },
});

export const observeCancellation = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedStatus: statusValidator,
    expectedRevision: v.number(),
    outcome: v.union(v.literal("accepted"), v.literal("unsupported"), v.literal("too_late"), v.literal("local")),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number(), status: statusValidator }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "cancellation_observed", args.outcome);
    if (replayRevision !== undefined) return { revision: replayRevision, status: job.status };
    trustedInstant(args.occurredAt);
    if (TERMINAL_DURABLE_JOB_STATUSES.has(job.status)) fail("TERMINAL_IMMUTABLE");
    expectState(job, args.expectedStatus, args.expectedRevision);
    if (!job.cancellationRequested) fail("CANCELLATION_NOT_REQUESTED");
    const cancelled = args.outcome === "accepted" || args.outcome === "local";
    if (cancelled) expectTransition(job, args.expectedStatus, args.expectedRevision, "cancelled");
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "cancellation_observed",
      eventFingerprint: args.outcome,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
    });
    await ctx.db.patch(job._id, {
      ...(cancelled ? { status: "cancelled" as const, terminalAt: args.occurredAt, leaseOwner: undefined, leaseToken: undefined, leaseExpiresAt: undefined } : {}),
      cancellationRequested: false,
      cancellationObservedAt: args.occurredAt,
      cancellationOutcome: args.outcome,
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
    });
    if (cancelled) await patchJobAttemptsStatus(ctx, job, "cancelled", args.occurredAt);
    return { revision: job.revision + 1, status: cancelled ? "cancelled" : job.status };
  },
});

export const recordProviderCompletion = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedRevision: v.number(),
    attemptKey: v.string(),
    leaseToken: v.string(),
    leaseEpoch: v.number(),
    providerRequestId: v.string(),
    outputIdentityKind: v.union(v.literal("checksum"), v.literal("asset")),
    outputIdentity: v.string(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ completionId: v.id("durableGenerationCompletions"), revision: v.number(), replay: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    if (job.providerRequestId !== args.providerRequestId) fail("PROVIDER_REQUEST_ID_MISMATCH");
    opaque(args.providerRequestId, 256, "INVALID_PROVIDER_REQUEST_ID");
    if (args.outputIdentityKind === "checksum") {
      if (!/^[a-f0-9]{64}$/.test(args.outputIdentity)) fail("INVALID_COMPLETION_IDENTITY");
    } else {
      opaque(args.outputIdentity, 256, "INVALID_COMPLETION_IDENTITY");
    }
    const completionKey = completionIdentityKey({
      generationKey: job.generationKey,
      provider: job.provider,
      providerRequestId: args.providerRequestId,
      outputIdentityKind: args.outputIdentityKind,
      outputIdentity: args.outputIdentity,
    });
    const existingCompletion = await ctx.db
      .query("durableGenerationCompletions")
      .withIndex("by_completion_key", (q) => q.eq("completionKey", completionKey))
      .unique();
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "provider_completed", completionKey);
    if (replayRevision !== undefined) {
      if (!existingCompletion || existingCompletion.jobId !== job._id || existingCompletion.ownerId !== job.ownerId) {
        fail("COMPLETION_RECORD_MISSING");
      }
      return { completionId: existingCompletion._id, revision: replayRevision, replay: true };
    }
    if (existingCompletion) {
      if (existingCompletion.jobId === job._id && existingCompletion.ownerId === job.ownerId) {
        return { completionId: existingCompletion._id, revision: job.revision, replay: true };
      }
      fail("COMPLETION_IDENTITY_COLLISION");
    }
    trustedInstant(args.occurredAt);
    if (TERMINAL_DURABLE_JOB_STATUSES.has(job.status)) fail("TERMINAL_IMMUTABLE");
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    if (job.status === "processing") expectTransition(job, "processing", args.expectedRevision, "persisting");
    else if (job.status === "persisting") expectState(job, "persisting", args.expectedRevision);
    else fail("INVALID_COMPLETION_STATUS");
    const requestCompletions = await ctx.db
      .query("durableGenerationCompletions")
      .withIndex("by_provider_request", (q) => q.eq("provider", job.provider).eq("providerRequestId", args.providerRequestId))
      .take(17);
    if (requestCompletions.some((completion) => completion.jobId !== job._id)) fail("PROVIDER_REQUEST_ID_COLLISION");
    if (requestCompletions.length >= 16) fail("COMPLETION_OUTPUT_LIMIT");
    const completionId = await ctx.db.insert("durableGenerationCompletions", {
      ownerId: job.ownerId,
      jobId: job._id,
      jobKey: job.jobKey,
      generationKey: job.generationKey,
      provider: job.provider,
      providerRequestId: args.providerRequestId,
      completionKey,
      outputIdentityKind: args.outputIdentityKind,
      outputIdentity: args.outputIdentity,
      createdAt: args.occurredAt,
    });
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "provider_completed",
      eventFingerprint: completionKey,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(job._id, {
      status: "persisting",
      completionIdentity: job.completionIdentity ?? completionKey,
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
    });
    await ctx.db.patch(attempt._id, { status: "persisting", updatedAt: args.occurredAt });
    return { completionId, revision: job.revision + 1, replay: false };
  },
});

export const recordDurableOutput = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedRevision: v.number(),
    attemptKey: v.string(),
    leaseToken: v.string(),
    leaseEpoch: v.number(),
    completionId: v.id("durableGenerationCompletions"),
    outputKey: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    contentType: v.string(),
    byteSize: v.number(),
    checksumSha256: v.string(),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ outputId: v.id("durableGenerationOutputs"), revision: v.number(), replay: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    const existing = await ctx.db
      .query("durableGenerationOutputs")
      .withIndex("by_output_key", (q) => q.eq("outputKey", args.outputKey))
      .unique();
    if (existing) {
      const same =
        existing.jobId === job._id &&
        existing.ownerId === job.ownerId &&
        existing.generationKey === job.generationKey &&
        existing.completionId === args.completionId &&
        existing.checksumSha256 === args.checksumSha256 &&
        existing.storageId === args.storageId &&
        existing.thumbnailStorageId === args.thumbnailStorageId &&
        existing.mediaType === args.mediaType &&
        existing.contentType === args.contentType &&
        existing.byteSize === args.byteSize;
      if (!same) fail("OUTPUT_KEY_COLLISION");
      const replayRevision = await replayedRevision(ctx, args.eventId, job, "output_persisted", args.outputKey);
      return { outputId: existing._id, revision: replayRevision ?? job.revision, replay: true };
    }
    trustedInstant(args.occurredAt);
    fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    expectState(job, "persisting", args.expectedRevision);
    if (
      !/^[a-f0-9]{64}$/.test(args.checksumSha256) ||
      !Number.isInteger(args.byteSize) ||
      args.byteSize < 1 ||
      args.byteSize > 10_000_000_000
    ) {
      fail("INVALID_OUTPUT");
    }
    bounded(args.contentType, 128, "INVALID_OUTPUT");
    bounded(args.outputKey, 512, "INVALID_OUTPUT");
    const completion = await ctx.db.get(args.completionId);
    if (
      !completion ||
      completion.jobId !== job._id ||
      completion.ownerId !== job.ownerId ||
      completion.generationKey !== job.generationKey ||
      (completion.outputIdentityKind === "checksum" && completion.outputIdentity !== args.checksumSha256) ||
      (completion.outputIdentityKind === "asset" && completion.outputIdentity !== args.outputKey)
    ) {
      fail("OUTPUT_COMPLETION_MISMATCH");
    }
    const primaryMetadata = await ctx.db.system.get(args.storageId);
    const thumbnailMetadata = args.thumbnailStorageId ? await ctx.db.system.get(args.thumbnailStorageId) : null;
    if (!primaryMetadata || (args.thumbnailStorageId && !thumbnailMetadata)) fail("DURABLE_STORAGE_NOT_FOUND");
    if (primaryMetadata.sha256.toLowerCase() !== args.checksumSha256) fail("DURABLE_STORAGE_CHECKSUM_MISMATCH");
    if (
      primaryMetadata.size !== args.byteSize ||
      (primaryMetadata.contentType !== undefined && primaryMetadata.contentType !== args.contentType)
    ) {
      fail("DURABLE_STORAGE_METADATA_MISMATCH");
    }
    const outputId = await ctx.db.insert("durableGenerationOutputs", {
      ownerId: job.ownerId,
      jobId: job._id,
      jobKey: job.jobKey,
      generationKey: job.generationKey,
      completionId: args.completionId,
      outputKey: args.outputKey,
      storageId: args.storageId,
      thumbnailStorageId: args.thumbnailStorageId,
      mediaType: args.mediaType,
      contentType: args.contentType,
      byteSize: args.byteSize,
      checksumSha256: args.checksumSha256,
      createdAt: args.occurredAt,
    });
    await replaceDocumentStorageReferences(ctx, {
      source: "durable_outputs",
      documentId: outputId,
      ownerId: job.ownerId,
      references: [
        { field: "storageId", storageIds: [args.storageId] },
        { field: "thumbnailStorageId", storageIds: args.thumbnailStorageId ? [args.thumbnailStorageId] : [] },
      ],
    });
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "output_persisted",
      eventFingerprint: args.outputKey,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(job._id, { revision: job.revision + 1, updatedAt: args.occurredAt });
    return { outputId, revision: job.revision + 1, replay: false };
  },
});

export const finalize = internalMutation({
  args: {
    ownerId: v.string(),
    jobId: v.id("durableGenerationJobs"),
    expectedRevision: v.number(),
    attemptKey: v.string(),
    leaseToken: v.string(),
    leaseEpoch: v.number(),
    outputIds: v.array(v.id("durableGenerationOutputs")),
    eventId: v.string(),
    occurredAt: v.number(),
  },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const job = await loadOwnedJob(ctx, args.ownerId, args.jobId);
    const eventFingerprint = [...args.outputIds].sort().join(":");
    const replayRevision = await replayedRevision(ctx, args.eventId, job, "finalized", eventFingerprint);
    if (replayRevision !== undefined) return { revision: replayRevision };
    if (job.status === "completed") {
      const existingFingerprint = [...(job.finalizedOutputIds ?? [])].sort().join(":");
      if (existingFingerprint === eventFingerprint) return { revision: job.revision };
      fail("TERMINAL_IMMUTABLE");
    }
    trustedInstant(args.occurredAt);
    const attempt = await loadAttempt(ctx, job, args.attemptKey);
    fenceWorker(job, attempt, args.leaseToken, args.leaseEpoch);
    if (job.cancellationRequested) fail("CANCELLATION_REQUIRES_OBSERVATION");
    expectTransition(job, "persisting", args.expectedRevision, "completed");
    if (args.outputIds.length < 1 || args.outputIds.length > 16 || new Set(args.outputIds).size !== args.outputIds.length) {
      fail("DURABLE_OUTPUTS_REQUIRED");
    }
    for (const outputId of args.outputIds) {
      const output = await ctx.db.get(outputId);
      if (
        !output ||
        output.jobId !== job._id ||
        output.ownerId !== job.ownerId ||
        output.generationKey !== job.generationKey ||
        !output.storageId
      ) {
        fail("DURABLE_OUTPUTS_REQUIRED");
      }
      const completion = await ctx.db.get(output.completionId);
      if (
        !completion ||
        completion.jobId !== job._id ||
        completion.ownerId !== job.ownerId ||
        completion.generationKey !== job.generationKey ||
        (completion.outputIdentityKind === "checksum" && completion.outputIdentity !== output.checksumSha256) ||
        (completion.outputIdentityKind === "asset" && completion.outputIdentity !== output.outputKey)
      ) {
        fail("OUTPUT_COMPLETION_MISMATCH");
      }
    }
    await insertEvent(ctx, job, {
      eventId: args.eventId,
      eventType: "finalized",
      eventFingerprint,
      revision: job.revision + 1,
      occurredAt: args.occurredAt,
      attemptId: attempt._id,
    });
    await ctx.db.patch(job._id, {
      status: "completed",
      terminalAt: args.occurredAt,
      finalizedOutputIds: args.outputIds,
      revision: job.revision + 1,
      updatedAt: args.occurredAt,
      leaseOwner: undefined,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
    });
    await ctx.db.patch(attempt._id, { status: "completed", updatedAt: args.occurredAt });
    return { revision: job.revision + 1 };
  },
});
