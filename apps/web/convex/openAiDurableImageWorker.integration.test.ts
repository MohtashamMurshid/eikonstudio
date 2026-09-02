import { createHash } from "node:crypto";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { CREDENTIAL_KEY_VERSION, encryptCredentialV2 } from "./credentialCrypto";
import { createDurableJobRecords } from "./durableJobs";
import schema from "./schema";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/!(*.*.*)*.*s");

const OWNER = "owner_openai_worker_test";
const SECRET_VALUE = "sk-test-openai-never-persist";
const ENCRYPTION_SECRET = Buffer.alloc(32, 37).toString("base64");
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const originalFetch = globalThis.fetch;
const originalEncryptionSecret = process.env.CREDENTIAL_ENCRYPTION_SECRET;

type Harness = TestConvex<typeof schema>;
type Fixture = {
  t: Harness;
  jobId: Id<"durableGenerationJobs">;
  generationId: Id<"generations">;
  credentialHandle: string;
};

async function seedFixture(suffix: string): Promise<Fixture> {
  process.env.CREDENTIAL_ENCRYPTION_SECRET = ENCRYPTION_SECRET;
  const t = convexTest(schema, modules);
  const now = Date.now();
  const credentialHandle = `cred_${createHash("sha256").update(suffix).digest("hex").slice(0, 24)}`;
  const generationKey = `generation_openai_${suffix}`;
  const created = await t.run(async (ctx) =>
    createDurableJobRecords(ctx, {
      ownerId: OWNER,
      jobKey: `job_openai_${suffix}`,
      generationKey,
      idempotencyKey: `idempotency_openai_${suffix}`,
      requestFingerprint: `request_openai_${suffix}`,
      provider: "openai",
      credentialHandle,
      modelId: "gpt-image-2",
      requestMetadataJson: JSON.stringify({ kind: "openai-image-v1", suffix }),
      maxAgeSeconds: 1_800,
      scheduleAt: now + 60_000,
      eventId: `created_openai_${suffix}`,
      occurredAt: now,
    }),
  );
  const encrypted = await encryptCredentialV2(
    SECRET_VALUE,
    { ownerId: OWNER, provider: "openai", handle: credentialHandle, keyVersion: CREDENTIAL_KEY_VERSION },
    ENCRYPTION_SECRET,
  );
  const generationId = await t.run(async (ctx) => {
    await ctx.db.insert("apiKeys", {
      userId: OWNER,
      provider: "openai",
      canonicalProvider: "openai",
      credentialHandle,
      ...encrypted,
      health: "active",
      maskedHint: "••••test",
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("generations", {
      userId: OWNER,
      prompt: `Draw a tiny durable lighthouse ${suffix}`,
      mode: "text-to-image",
      aspectRatio: "square",
      imageSize: "1K",
      createdAt: now,
      imageModel: "gpt-image-2",
      credentialHandle,
      credentialProvider: "openai",
      requestIdempotencyKey: `idempotency_openai_${suffix}`,
      durableJobId: created.jobId,
      durableGenerationKey: generationKey,
      status: "pending",
    });
  });
  return { t, jobId: created.jobId, generationId, credentialHandle };
}

function installOneShotFetch(response: () => Response) {
  let calls = 0;
  const fake = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    if (calls !== 1) throw new Error("TEST_FETCH_CALLED_MORE_THAN_ONCE");
    const authorization = new Headers(init?.headers).get("authorization");
    expect(authorization).toBe(`Bearer ${SECRET_VALUE}`);
    return response();
  }) as typeof fetch;
  globalThis.fetch = fake;
  return fake;
}

async function snapshot(fixture: Fixture) {
  const value = await fixture.t.query(internal.durableJobs.getScheduledExecutionInternal, { jobId: fixture.jobId });
  if (!value) throw new Error("TEST_SNAPSHOT_MISSING");
  return value;
}

async function persistedRows(fixture: Fixture) {
  return await fixture.t.run(async (ctx) => ({
    job: await ctx.db.get(fixture.jobId),
    generation: await ctx.db.get(fixture.generationId),
    attempts: await ctx.db.query("durableGenerationAttempts").withIndex("by_job", (q) => q.eq("jobId", fixture.jobId)).collect(),
    outputs: await ctx.db.query("durableGenerationOutputs").withIndex("by_job", (q) => q.eq("jobId", fixture.jobId)).collect(),
    completions: await ctx.db.query("durableGenerationCompletions").withIndex("by_job", (q) => q.eq("jobId", fixture.jobId)).collect(),
    events: await ctx.db.query("durableGenerationEvents").withIndex("by_job_revision", (q) => q.eq("jobId", fixture.jobId)).collect(),
    submissions: await ctx.db.query("durableProviderSubmissions").withIndex("by_job", (q) => q.eq("jobId", fixture.jobId)).collect(),
    ledger: await ctx.db.query("storageReferenceLedger").collect(),
    apiKeys: await ctx.db.query("apiKeys").collect(),
  }));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEncryptionSecret === undefined) delete process.env.CREDENTIAL_ENCRYPTION_SECRET;
  else process.env.CREDENTIAL_ENCRYPTION_SECRET = originalEncryptionSecret;
  vi.restoreAllMocks();
});

describe("durable OpenAI image production action", () => {
  it("persists the real image, thumbnail, audit records, ledgers, and legacy mirror", async () => {
    const fixture = await seedFixture("success");
    const fetch = installOneShotFetch(() =>
      new Response(JSON.stringify({ data: [{ b64_json: TINY_PNG_BASE64 }] }), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "req_openai_success" },
      }),
    );

    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });

    expect(fetch).toHaveBeenCalledTimes(1);
    const rows = await persistedRows(fixture);
    expect(rows.job).toMatchObject({ status: "completed", submissionState: "accepted", revision: 8 });
    expect(rows.attempts).toHaveLength(1);
    expect(rows.attempts[0]).toMatchObject({ status: "completed", submissionState: "accepted" });
    expect(rows.outputs).toHaveLength(1);
    expect(rows.completions).toHaveLength(1);
    expect(rows.submissions).toEqual([
      expect.objectContaining({ state: "accepted", providerRequestId: "req_openai_success" }),
    ]);
    expect(rows.outputs[0]).toMatchObject({
      completionId: rows.completions[0]._id,
      contentType: "image/png",
      checksumSha256: createHash("sha256").update(Uint8Array.from(Buffer.from(TINY_PNG_BASE64, "base64"))).digest("hex"),
    });
    expect(rows.generation).toMatchObject({
      status: "completed",
      imageStorageId: rows.outputs[0].storageId,
      thumbnailStorageId: rows.outputs[0].thumbnailStorageId,
    });
    expect(rows.job?.finalizedOutputIds).toEqual([rows.outputs[0]._id]);
    expect(rows.events.map((event) => event.eventType)).toEqual([
      "created", "claimed", "transitioned", "claimed", "submission_accepted", "provider_completed",
      "claimed", "output_persisted", "finalized",
    ]);
    expect(rows.ledger.map((row) => [row.source, row.field, row.storageId])).toEqual(expect.arrayContaining([
      ["durable_outputs", "storageId", rows.outputs[0].storageId],
      ["durable_outputs", "thumbnailStorageId", rows.outputs[0].thumbnailStorageId],
      ["generations", "imageStorageId", rows.outputs[0].storageId],
      ["generations", "thumbnailStorageId", rows.outputs[0].thumbnailStorageId],
    ]));
    expect(rows.ledger).toHaveLength(4);
    expect(await fixture.t.run(async (ctx) => {
      const blob = await ctx.storage.get(rows.outputs[0].storageId);
      return blob && { type: blob.type, size: blob.size };
    })).toEqual({ type: "image/png", size: Buffer.from(TINY_PNG_BASE64, "base64").byteLength });
    expect(await fixture.t.run(async (ctx) => {
      const blob = await ctx.storage.get(rows.outputs[0].thumbnailStorageId!);
      return blob && { type: blob.type, size: blob.size };
    })).toEqual(expect.objectContaining({ type: "image/jpeg", size: expect.any(Number) }));
    expect(JSON.stringify(rows)).not.toContain(SECRET_VALUE);
  });

  it("records an HTTP 400 as a definitive, safe terminal failure", async () => {
    const fixture = await seedFixture("http400");
    installOneShotFetch(() => new Response(JSON.stringify({ error: { message: `${SECRET_VALUE}: hostile detail` } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    const rows = await persistedRows(fixture);
    expect(rows.job).toMatchObject({ status: "failed", submissionState: "in_flight", revision: 4 });
    expect(rows.attempts[0]).toMatchObject({ status: "failed", submissionState: "in_flight" });
    expect(rows.generation).toMatchObject({ status: "failed" });
    expect(rows.outputs).toHaveLength(0);
    expect(rows.job?.publicErrorMessage).not.toContain("hostile detail");
    expect(JSON.stringify(rows)).not.toContain(SECRET_VALUE);
  });

  it.each([
    ["http429", () => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429, headers: { "content-type": "application/json" } })],
    ["malformed", () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } })],
  ] as const)("records %s after transport as ambiguous", async (suffix, response) => {
    const fixture = await seedFixture(suffix);
    installOneShotFetch(response);
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    const rows = await persistedRows(fixture);
    expect(rows.job).toMatchObject({ status: "submitting", submissionState: "ambiguous", revision: 4 });
    expect(rows.attempts[0]).toMatchObject({ status: "submitting", submissionState: "ambiguous" });
    expect(rows.submissions).toEqual([expect.objectContaining({ state: "ambiguous" })]);
    expect(rows.generation).toMatchObject({ status: "failed" });
    expect(rows.generation?.errorMessage).toContain("outcome is unknown");
    expect(JSON.stringify(rows)).not.toContain(SECRET_VALUE);
  });

  it("redelivers an ambiguous job without provider transport or revision changes", async () => {
    const fixture = await seedFixture("ambiguous_redelivery");
    installOneShotFetch(() => new Response("{}", { status: 429, headers: { "content-type": "application/json" } }));
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    const before = await snapshot(fixture);
    const noFetch = vi.fn(async () => { throw new Error("REDELIVERY_MUST_NOT_FETCH"); }) as typeof fetch;
    globalThis.fetch = noFetch;
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    const after = await snapshot(fixture);
    expect(noFetch).not.toHaveBeenCalled();
    expect(after.job).toMatchObject({ status: "submitting", submissionState: "ambiguous", revision: before.job.revision });
  });

  it("redelivers a completed job to repair the legacy mirror without provider transport", async () => {
    const fixture = await seedFixture("completed_redelivery");
    installOneShotFetch(() => new Response(JSON.stringify({ data: [{ b64_json: TINY_PNG_BASE64 }] }), {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "req_openai_redelivery" },
    }));
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    const before = await snapshot(fixture);
    await fixture.t.run(async (ctx) => ctx.db.patch(fixture.generationId, {
      status: "failed",
      imageStorageId: undefined,
      thumbnailStorageId: undefined,
      errorMessage: "simulated mirror interruption",
    }));
    const noFetch = vi.fn(async () => { throw new Error("RECOVERY_MUST_NOT_FETCH"); }) as typeof fetch;
    globalThis.fetch = noFetch;
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    const after = await snapshot(fixture);
    const generation = await fixture.t.run(async (ctx) => ctx.db.get(fixture.generationId));
    expect(noFetch).not.toHaveBeenCalled();
    expect(after.job.revision).toBe(before.job.revision);
    expect(generation).toMatchObject({
      status: "completed",
      imageStorageId: after.outputs[0].storageId,
      thumbnailStorageId: after.outputs[0].thumbnailStorageId,
    });
  });
});
