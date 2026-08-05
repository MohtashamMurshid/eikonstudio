import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const convexRoot = resolve(webRoot, "convex");
const source = (name: string) => readFileSync(resolve(convexRoot, name), "utf8");
const schema = source("schema.ts");
const durableJobs = source("durableJobs.ts");
const policy = source("durableJobPolicy.ts");
const joined = [schema, durableJobs, policy].join("\n");

describe("durable persistence source boundary", () => {
  it("does not add arbitrary Convex values or prohibited persisted fields", () => {
    expect(joined).not.toMatch(/v\.any\s*\(/);
    expect(schema).not.toMatch(/\b(?:plaintextCredentials?|providerKeys?|transportUrls?|nativePayloads?)\b/i);
  });

  it("does not persist or pass transport locations", () => {
    expect(schema).not.toMatch(/\b(?:request|response|callback|webhook|transport)Url\b/);
    expect(durableJobs).not.toMatch(/https?:\/\//i);
  });

  it("schedules only the opaque Convex job id", () => {
    expect(durableJobs).toContain("internal.durableJobs.inspectScheduledJob, { jobId }");
    expect(durableJobs).not.toMatch(/inspectScheduledJob, \{[^}]+(?:credential|providerRequest|requestMetadata|submission)/);
  });

  it("persists owner, credential, lease fencing, provider identity, and completion linkage", () => {
    for (const required of [
      "credentialHandle: v.string()",
      "leaseToken: v.optional(v.string())",
      "leaseEpoch: v.number()",
      "durableGenerationCompletions",
      'index("by_provider_request", ["provider", "providerRequestId"])',
    ]) {
      expect(schema).toContain(required);
    }
    expect(durableJobs).toContain("assertLeaseFence");
    expect(durableJobs).toContain("Date.now()");
    expect(durableJobs).toContain("PROVIDER_REQUEST_ID_COLLISION");
    expect(durableJobs).toContain("completionIdentityKey");
    expect(schema).toContain('completionId: v.id("durableGenerationCompletions")');
    expect(durableJobs).toContain("OUTPUT_COMPLETION_MISMATCH");
    expect(durableJobs).toContain("ctx.db.system.get(args.storageId)");
    expect(durableJobs).toContain("JSON.stringify([args.submissionKey, args.providerRequestId])");
  });

  it("cannot bypass completion, persistence, or cancellation through the generic transition", () => {
    expect(durableJobs).toContain('targetStatus: v.union(v.literal("failed"), v.literal("expired"))');
    expect(durableJobs).toContain("TERMINAL_DURABLE_JOB_STATUSES.has(job.status)");
    expect(durableJobs).toContain("job.cancellationRequested || job.expiresAt <= leaseNow");
    expect(durableJobs).toContain('status: "completed"');
    expect(durableJobs).toContain("DURABLE_OUTPUTS_REQUIRED");
    expect(durableJobs).toContain("cancellationRequested: cancelled");
    expect(durableJobs).toContain("CANCELLATION_REQUIRES_OBSERVATION");
    expect(durableJobs).toContain("args.scheduleAt > creationNow + args.maxAgeSeconds * 1000");
    expect(durableJobs).toContain("job.expiresAt <= leaseNow");
    expect(durableJobs).toContain("if (job.expiresAt <= now) fail(\"JOB_EXPIRED\")");
    expect(durableJobs).toContain('args.targetStatus === "expired" && Date.now() < job.expiresAt');
    const cancellationObservation = durableJobs.split("export const observeCancellation")[1]?.split("export const recordProviderCompletion")[0] ?? "";
    expect(cancellationObservation).toContain("TERMINAL_DURABLE_JOB_STATUSES.has(job.status)");
    const reconciliation = durableJobs.split("export const reconcileAmbiguousSubmission")[1]?.split("export const requestCancellation")[0] ?? "";
    expect(reconciliation).toContain("if (job.cancellationRequested) fail(\"CANCELLATION_REQUIRES_OBSERVATION\")");
  });

  it("keeps migration inventory read-only and paginated", () => {
    expect(durableJobs).toContain("inventoryLegacyGenerationPageInternal");
    const inventory = durableJobs.split("export const inventoryLegacyGenerationPageInternal")[1]?.split("export const claim")[0] ?? "";
    expect(inventory).toContain("paginate(args.paginationOpts)");
    expect(inventory).not.toMatch(/ctx\.db\.(?:insert|patch|delete)/);
  });
});
