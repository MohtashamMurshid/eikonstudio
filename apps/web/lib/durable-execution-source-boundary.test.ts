import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(webRoot, path), "utf8");
const generations = source("convex/generations.ts");
const durableJobs = source("convex/durableJobs.ts");
const worker = source("convex/imageGeneration.ts");
const schema = source("convex/schema.ts");
const hook = source("components/image-combiner/hooks/use-image-generation.ts");

const orderedBefore = (haystack: string, first: string, second: string) => {
  const firstIndex = haystack.indexOf(first);
  const secondIndex = haystack.indexOf(second);
  expect(firstIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).toBeGreaterThanOrEqual(0);
  expect(firstIndex).toBeLessThan(secondIndex);
};

describe("durable image execution source boundary", () => {
  it("atomically links legacy creation, durable records, and an opaque scheduler payload", () => {
    const start = generations.split("export const startGeneration")[1]?.split("export const getGenerationExecutionContext")[0] ?? "";
    expect(start).toContain("createDurableJobRecords(ctx");
    expect(start).toContain("ctx.db.patch(generationId");
    expect(start).toContain("ctx.scheduler.runAt(now, internal.imageGeneration.generateDurableImageBackground, { jobId })");
    expect(start).not.toContain("generateImageBackground");
    const payloads = [...start.matchAll(/generateDurableImageBackground,\s*(\{[^}]*\})/g)].map((match) => match[1].replace(/\s+/g, " "));
    expect(payloads).toEqual(["{ jobId }", "{ jobId }"]);
  });

  it("uses owner-scoped client idempotency and additive legacy linkage", () => {
    expect(hook).toContain("crypto.randomUUID()");
    expect(hook).toContain("pendingRequestRef.current?.signature !== requestSignature");
    expect(hook).toContain("pendingRequest.referenceImageIds = referenceImageIds");
    orderedBefore(hook, "if (generationStartLockRef.current) return", "pendingRequestRef.current?.signature !== requestSignature");
    expect(hook).toContain("finally {\n      generationStartLockRef.current = false");
    expect(generations).toContain('withIndex("by_user_idempotency"');
    expect(generations).toContain("Generation request identity was reused with different inputs");
    expect(schema).toContain("requestIdempotencyKey: v.optional(v.string())");
    expect(schema).toContain('durableJobId: v.optional(v.id("durableGenerationJobs"))');
    expect(schema).toContain('.index("by_user_idempotency", ["userId", "requestIdempotencyKey"])');
  });

  it("persists in-flight before provider dispatch and never auto-resubmits recovered work", () => {
    const durableWorker = worker.split("export const generateDurableImageBackground")[1] ?? "";
    orderedBefore(durableWorker, "internal.durableJobs.beginSubmission", "executeExistingImageProvider(ctx");
    expect(durableWorker).toContain('decision === "mark-ambiguous"');
    expect(durableWorker).toContain('decision === "fail-without-resubmit"');
    expect(durableWorker).toContain("recordSubmissionAmbiguous");
    expect(durableWorker).toContain("will not be submitted again automatically");
  });

  it("uses provider-native identities with hidden retries disabled", () => {
    expect(worker).toContain(".withResponse()");
    expect(worker).toContain("wrapped.request_id");
    expect(worker).toContain("response.responseId");
    expect(worker).toContain("maxRetries: 0");
    expect(worker).toContain("timeout: 240_000");
    expect(worker).not.toContain("Final prompt with skills");
  });

  it("renews leases around provider and storage work and fences every durable write", () => {
    const durableWorker = worker.split("export const generateDurableImageBackground")[1] ?? "";
    orderedBefore(durableWorker, "initial.job.expiresAt <= Date.now()", "ctx.scheduler.runAfter(290_000");
    expect(durableWorker).toContain('claim("submitting", begin.revision)');
    expect(durableWorker).toContain('claim("persisting", completion.revision)');
    expect(durableWorker).toContain("leaseEpoch: storageRenewal.leaseEpoch");
    expect(durableWorker).toContain("internal.durableJobs.finalize");
    expect(durableWorker).toContain("ctx.scheduler.runAfter(290_000");
  });

  it("binds provider bytes through checksum, completion, durable output, finalization, and legacy mirroring", () => {
    expect(worker).toContain('createHash("sha256")');
    expect(worker).toContain("recordProviderCompletion");
    expect(worker).toContain("recordDurableOutput");
    expect(worker).toContain("mirrorDurableGenerationCompleted");
    expect(generations).toContain("job.finalizedOutputIds.length !== 1");
    expect(generations).toContain("output.jobId !== jobId");
    expect(durableJobs).toContain("existing.requestMetadataJson !== args.requestMetadataJson");
  });

  it("keeps secrets ephemeral and absent from schemas and scheduler arguments", () => {
    const joined = `${schema}\n${generations}\n${durableJobs}`;
    expect(joined).not.toMatch(/providerSecret\s*:\s*v\./);
    expect(joined).not.toMatch(/apiKey\s*:\s*v\./);
    const durableArgs = worker.split("export const generateDurableImageBackground")[1]?.split("returns:")[0] ?? "";
    expect(durableArgs).toContain('args: { jobId: v.id("durableGenerationJobs") }');
    expect(durableArgs).not.toMatch(/credential|prompt|providerSecret|apiKey/);
  });

  it("soft-tombstones terminal durable rows without deleting audit records or storage", () => {
    const deletion = generations.split("export const deleteGeneration")[1]?.split("// ============================================")[0] ?? "";
    const durableDeletion = deletion.split("if (generation.durableJobId)")[1]?.split("// Legacy unlinked rows")[0] ?? "";
    expect(durableDeletion).toContain('["completed", "failed", "cancelled", "expired"]');
    expect(durableDeletion).toContain("Active durable generations cannot be deleted");
    expect(durableDeletion).toContain('withIndex("by_job"');
    expect(durableDeletion).toContain("Durable finalized output binding is invalid");
    expect(durableDeletion).toContain("generation_tombstone:");
    expect(durableDeletion).toContain('eventType: "tombstoned"');
    expect(durableDeletion).toContain('tombstoneReason: "user_deleted_generation"');
    expect(durableDeletion).not.toContain("ctx.storage.delete");
    expect(durableDeletion).not.toContain("ctx.db.delete");
    expect(generations).toContain('withIndex("by_user_tombstone_created"');
    expect(generations).toContain("Generation request identity belongs to a deleted generation");
    expect(schema).toContain('.index("by_user_tombstone_created", ["userId", "tombstonedAt", "createdAt"])');
  });
});
