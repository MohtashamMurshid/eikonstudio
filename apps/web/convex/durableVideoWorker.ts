"use node";

import { createHash, randomUUID } from "node:crypto";
import { GenerationRequestSchema } from "@eikonstudio/core";
import { GoogleVeoAdapter, GOOGLE_VEO_MODEL, GOOGLE_VEO_IMAGE_CAPABILITY, GOOGLE_VEO_TEXT_CAPABILITY,
  ProviderCredentialReferenceSchema, type GenerationStatusResult } from "@eikonstudio/providers";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { withResolvedCredentialForOperation } from "./credentialActions";
import { providerFailureDisposition } from "./durableExecutionPolicy";
import { downloadDurableVideo, VideoDownloadError } from "./durableVideoDownload";

/** One submission OR one poll/download per delivery. Injected transport is the only network boundary. */
export async function runDurableVideoStep(ctx: ActionCtx, jobId: Id<"durableGenerationJobs">, fetch: typeof globalThis.fetch): Promise<null> {
  const initial = await ctx.runQuery(internal.videoGenerations.getDurableVideoExecution, { jobId });
  if (!initial || initial.video.tombstonedAt !== undefined) return null;
  const { job, video, attempt, outputs } = initial;
  if (["completed", "failed", "expired", "cancelled"].includes(job.status) || job.submissionState === "ambiguous") return null;
  if (job.expiresAt <= Date.now() && job.status === "submitting" && job.submissionState === "in_flight") {
    await ctx.runMutation(internal.durableJobs.recoverExpiredSubmission, {
      ownerId: job.ownerId, jobId, attemptKey: attempt.attemptKey, expectedRevision: job.revision,
      submissionKey: `submission:${createHash("sha256").update(attempt.attemptKey).digest("hex")}`,
      eventId: `deadline_${randomUUID()}`, occurredAt: Date.now(),
    }).catch(() => null);
    return null;
  }
  if (job.cancellationRequested) {
    // Veo cannot cancel upstream work; record that fact without pretending it stopped.
    await ctx.runMutation(internal.durableJobs.observeCancellation, {
      ownerId: job.ownerId, jobId, expectedStatus: job.status, expectedRevision: job.revision,
      outcome: "unsupported", eventId: `cancel_${randomUUID()}`, occurredAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.imageGeneration.generateDurableVideoBackground, { jobId });
    return null;
  }
  if (job.expiresAt <= Date.now()) {
    try {
      await ctx.runMutation(internal.durableJobs.transition, { ownerId: job.ownerId, jobId,
        expectedStatus: job.status, expectedRevision: job.revision, targetStatus: "expired",
        eventId: `expired_${randomUUID()}`, eventFingerprint: "video-maximum-age", occurredAt: Date.now() });
    } catch { /* Concurrent expiry/reconciliation owns the newer revision. */ }
    return null;
  }
  if ((job.veoNextStepAt ?? 0) > Date.now()) return null;
  const leaseToken = `lease_${randomUUID()}`;
  let revision = job.revision;
  let leaseEpoch: number;
  let status = job.status;
  const claimed = await ctx.runMutation(internal.durableJobs.claim, {
    ownerId: job.ownerId, jobId, attemptKey: attempt.attemptKey, expectedStatus: status, expectedRevision: revision,
    leaseOwner: "durable-video-worker", leaseToken, leaseDurationMs: 240_000,
    eventId: `claim_${randomUUID()}`, occurredAt: Date.now(),
  }).catch(() => null);
  if (!claimed) return null;
  revision = claimed.revision;
  leaseEpoch = claimed.leaseEpoch;
  const fence = () => ({ ownerId: job.ownerId, jobId, attemptKey: attempt.attemptKey,
    expectedRevision: revision, leaseToken, leaseEpoch });
  const renew = async () => {
    const renewed = await ctx.runMutation(internal.durableJobs.claim, {
      ownerId: job.ownerId, jobId, attemptKey: attempt.attemptKey, expectedStatus: status, expectedRevision: revision,
      leaseOwner: "durable-video-worker", leaseToken, leaseDurationMs: 240_000,
      eventId: `renew_${randomUUID()}`, occurredAt: Date.now(),
    });
    revision = renewed.revision;
    leaseEpoch = renewed.leaseEpoch;
  };
  const event = () => ({ eventId: `video_${randomUUID()}`, occurredAt: Date.now() });
  const fail = async (error?: GenerationStatusResult["error"]) => {
    await ctx.runMutation(internal.durableJobs.transition, { ...fence(), ...event(), expectedStatus: status,
      targetStatus: "failed", eventFingerprint: "video-step-failed", error: error ? { ...error, retryable: false,
        message: error.category === "authentication" ? "Google authentication failed. Update your saved key in Settings." : error.message } : {
        category: "unknown", code: "video_step_failed", message: "Video generation could not complete. It will not be submitted again automatically.",
        retryable: false, correlationId: `corr_${randomUUID()}`,
      } });
  };
  const ambiguous = async () => {
    await ctx.runMutation(internal.durableJobs.recordSubmissionAmbiguous, {
      ...fence(), ...event(), submissionKey: `submission:${createHash("sha256").update(attempt.attemptKey).digest("hex")}`,
    });
  };
  try {
    if (status === "submitting") { await ambiguous(); return null; }
    if (status === "persisting" && outputs.length === 1) {
      await ctx.runMutation(internal.durableJobs.finalize, { ...fence(), ...event(), outputIds: [outputs[0]._id] });
      return null;
    }
    if ((job.veoPollCount ?? 0) >= 60) { await fail(); return null; }
    const credential = ProviderCredentialReferenceSchema.parse({ providerId: "google", handle: job.credentialHandle });
    let entered = false;
    const adapter = new GoogleVeoAdapter({ fetch: async (input, init) => { entered = true; return fetch(input, init); },
      credentialBroker: { withCredential: async (reference, operation) => {
        if (reference.providerId !== "google" || reference.handle !== job.credentialHandle) throw new Error("CREDENTIAL_BINDING_INVALID");
        return withResolvedCredentialForOperation(ctx, { ownerId: job.ownerId, provider: "google", credentialHandle: job.credentialHandle }, async secret => {
          if (status === "queued") {
            const begin = await ctx.runMutation(internal.durableJobs.beginSubmission, { ...fence(), ...event() });
            revision = begin.revision;
            status = "submitting";
          }
          return operation(secret);
        });
      } },
      imageResolver: async asset => {
        if (asset.reference.ownerId !== job.ownerId || !(video.referenceImageStorageIds ?? []).includes(asset.reference.storageId as Id<"_storage">)) throw new Error("REFERENCE_BINDING_INVALID");
        const blob = await ctx.storage.get(asset.reference.storageId as Id<"_storage">);
        if (!blob || blob.size > 25_000_000 || blob.size < 1) throw new Error("INVALID_VIDEO_REFERENCE");
        return { contentType: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) };
      },
    });
    const context = { credential, requestId: `corr_${randomUUID()}` };
    if (status === "queued") {
      try {
        const inputAssets = [];
        for (const storageId of video.referenceImageStorageIds ?? []) {
          const blob = await ctx.storage.get(storageId);
          if (!blob || blob.size > 25_000_000 || blob.size < 1) throw new Error("INVALID_VIDEO_REFERENCE");
          inputAssets.push({ mediaType: "image", contentType: blob.type, reference: { kind: "eikon-storage", ownerId: job.ownerId,
            storageId, assetId: `asset_${createHash("sha256").update(`${job.ownerId}:${storageId}`).digest("hex").slice(0, 32)}` } });
        }
        const capability = inputAssets.length ? GOOGLE_VEO_IMAGE_CAPABILITY : GOOGLE_VEO_TEXT_CAPABILITY;
        const request = GenerationRequestSchema.parse({ modelId: GOOGLE_VEO_MODEL.id, task: capability.task,
          operation: "generate", schemaRevision: capability.schemaRevision, input: { prompt: video.prompt,
            inputAssets, outputCount: 1, aspectRatio: video.aspectRatio, resolution: video.resolution, durationSeconds: video.duration, audio: true } });
        const normalized = await adapter.normalizeInput(request, capability);
        const result = await adapter.submitGeneration(normalized, context);
        if (result.delivery !== "asynchronous") throw new Error("INVALID_VIDEO_SUBMISSION");
        // Cancellation may advance revisions while this exact POST is outstanding.
        // Re-read at most twice; each re-read proves every intervening event was cancellation-only.
        for (let retry = 0; ; retry++) {
          try {
            const accepted = await ctx.runMutation(internal.durableJobs.recordSubmissionAccepted, {
              ...fence(), ...event(), submissionKey: `submission:${createHash("sha256").update(attempt.attemptKey).digest("hex")}`,
              providerRequestId: result.providerRequestId,
            });
            revision = accepted.revision;
            break;
          } catch (error) {
            if (retry >= 2) throw error;
            revision = await ctx.runMutation(internal.durableJobs.refreshSubmissionRevision, fence());
          }
        }
        status = "processing";
        const live = await ctx.runQuery(internal.videoGenerations.getDurableVideoExecution, { jobId });
        if (live?.job.cancellationRequested && live.job.revision === revision) {
          const observed = await ctx.runMutation(internal.durableJobs.observeCancellation, {
            ownerId: job.ownerId, jobId, expectedStatus: "processing", expectedRevision: revision,
            outcome: "unsupported", ...event(),
          });
          revision = observed.revision;
        }
        await ctx.runMutation(internal.durableJobs.scheduleVeoStep, fence());
      } catch (error) {
        const normalized = adapter.normalizeError(error, context.requestId);
        const httpStatus = normalized.privateError.native.data.status;
        // A malformed acknowledgement or a transport failure after entry is never a retry grant.
        if (entered && providerFailureDisposition(typeof httpStatus === "number" ? httpStatus : undefined) === "ambiguous" && status !== "processing") await ambiguous();
        else if (status !== "processing") await fail({ ...normalized.publicError, retryable: false });
      }
      return null;
    }
    if (!job.providerRequestId) { await fail(); return null; }
    let result: GenerationStatusResult;
    try {
      result = await adapter.getGenerationStatus(job.providerRequestId, context);
    } catch (error) {
      const normalized = adapter.normalizeError(error, context.requestId).publicError;
      if (["rate-limit", "provider-unavailable", "timeout"].includes(normalized.category)) {
        await ctx.runMutation(internal.durableJobs.scheduleVeoStep, fence());
      } else await fail({ ...normalized, retryable: false });
      return null;
    }
    if (result.status === "processing") {
      await ctx.runMutation(internal.durableJobs.scheduleVeoStep, fence());
      return null;
    }
    if (result.status === "failed") { await fail(result.error); return null; }
    if (result.status === "cancelled") {
      const requested = await ctx.runMutation(internal.durableJobs.requestCancellation, {
        ownerId: job.ownerId, jobId, expectedStatus: status, expectedRevision: revision, ...event(),
      });
      await ctx.runMutation(internal.durableJobs.observeCancellation, {
        ownerId: job.ownerId, jobId, expectedStatus: status, expectedRevision: requested.revision,
        outcome: "accepted", ...event(),
      });
      return null;
    }
    await renew();
    const bytes = await downloadDurableVideo({ status: result, requestId: job.providerRequestId, credential, fetch,
      withCredential: async (reference, operation) => {
        if (reference.providerId !== "google" || reference.handle !== job.credentialHandle) throw new Error("CREDENTIAL_BINDING_INVALID");
        return withResolvedCredentialForOperation(ctx, { ownerId: job.ownerId, provider: "google", credentialHandle: job.credentialHandle }, operation);
      } }).catch(async error => {
        if (error instanceof VideoDownloadError && error.retryable) {
          await ctx.runMutation(internal.durableJobs.scheduleVeoStep, fence());
        } else await fail();
        return null;
      });
    if (!bytes) return null;
    const checksumSha256 = createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
    if (initial.completions.length && initial.completions[0].outputIdentity !== checksumSha256) { await fail(); return null; }
    await renew();
    const completion = await ctx.runMutation(internal.durableJobs.recordProviderCompletion, { ...fence(), ...event(),
      providerRequestId: job.providerRequestId, outputIdentityKind: "checksum", outputIdentity: checksumSha256 });
    revision = completion.revision;
    status = "persisting";
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)], { type: "video/mp4" }));
    await renew();
    const output = await ctx.runMutation(internal.durableJobs.recordDurableOutput, { ...fence(), ...event(),
      completionId: completion.completionId, outputKey: `output:${job.jobKey}:1`, storageId,
      mediaType: "video", contentType: "video/mp4", byteSize: bytes.length, checksumSha256 });
    revision = output.revision;
    await ctx.runMutation(internal.durableJobs.finalize, { ...fence(), ...event(), outputIds: [output.outputId] });
  } catch {
    // A crash, stale lease, or storage interruption is recovered by the claim's atomic watchdog.
    // No output/blob deletion and no second provider submission occur here.
  }
  return null;
}
