import { createHash } from "node:crypto";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { CREDENTIAL_KEY_VERSION, encryptCredentialV2 } from "./credentialCrypto";
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

type Variant = { provider: "google" | "openai"; model: "gemini-3.1-flash-image" | "gemini-3-pro-image" | "gpt-image-2"; mode: "text-to-image" | "image-editing" };
async function seedVariantFixture(suffix: string, variant: Variant): Promise<Fixture> {
  process.env.CREDENTIAL_ENCRYPTION_SECRET = ENCRYPTION_SECRET;
  const t = convexTest(schema, modules);
  const now = Date.now();
  const credentialHandle = `cred_${createHash("sha256").update(suffix).digest("hex").slice(0, 22)}-_`;
  const generationKey = `generation_openai_${suffix}`;
  const created = await t.run(async (ctx) =>
    createDurableJobRecords(ctx, {
      ownerId: OWNER,
      jobKey: `job_openai_${suffix}`,
      generationKey,
      idempotencyKey: `idempotency_openai_${suffix}`,
      requestFingerprint: `request_openai_${suffix}`,
      provider: variant.provider,
      credentialHandle,
      modelId: variant.model,
      requestMetadataJson: JSON.stringify({ kind: "openai-image-v1", suffix }),
      maxAgeSeconds: 1_800,
      scheduleAt: now + 60_000,
      eventId: `created_openai_${suffix}`,
      occurredAt: now,
    }),
  );
  const encrypted = await encryptCredentialV2(
    SECRET_VALUE,
    { ownerId: OWNER, provider: variant.provider, handle: credentialHandle, keyVersion: CREDENTIAL_KEY_VERSION },
    ENCRYPTION_SECRET,
  );
  const generationId = await t.run(async (ctx) => {
    await ctx.db.insert("apiKeys", {
      userId: OWNER,
      provider: variant.provider === "google" ? "gemini" : "openai",
      canonicalProvider: variant.provider,
      credentialHandle,
      ...encrypted,
      health: "active",
      maskedHint: "••••test",
      createdAt: now,
      updatedAt: now,
    });
    const referenceImageIds = variant.mode === "image-editing"
      ? [await ctx.storage.store(new Blob([new Uint8Array(Buffer.from(TINY_PNG_BASE64, "base64"))], { type: "image/png" }))] : [];
    return await ctx.db.insert("generations", {
      referenceImageIds,
      userId: OWNER,
      prompt: `Draw a tiny durable lighthouse ${suffix}`,
      mode: variant.mode,
      aspectRatio: "square",
      imageSize: "1K",
      createdAt: now,
      imageModel: variant.model,
      credentialHandle,
      credentialProvider: variant.provider,
      requestIdempotencyKey: `idempotency_openai_${suffix}`,
      durableJobId: created.jobId,
      durableGenerationKey: generationKey,
      status: "pending",
    });
  });
  return { t, jobId: created.jobId, generationId, credentialHandle };
}

function installVariantFetch(response: () => Response, variant: Variant) {
  let calls = 0;
  const fake = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    if (calls !== 1) throw new Error("TEST_FETCH_CALLED_MORE_THAN_ONCE");
    const headers = new Headers(init?.headers);
    expect(headers.get(variant.provider === "openai" ? "authorization" : "x-goog-api-key")).toBe(variant.provider === "openai" ? `Bearer ${SECRET_VALUE}` : SECRET_VALUE);
    if (variant.provider === "google") {
      expect(String(_input)).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${variant.model}:generateContent`);
      const body = JSON.parse(String(init?.body));
      expect(body.contents[0].parts).toHaveLength(variant.mode === "image-editing" ? 2 : 1);
      if (variant.mode === "image-editing") {
        expect(body.contents[0].parts[0]).toEqual({ inlineData: { data: TINY_PNG_BASE64, mimeType: "image/png" } });
        expect(body.generationConfig).toBeUndefined();
      } else expect(body.generationConfig).toEqual({ imageConfig: { aspectRatio: "1:1", imageSize: "1K" } });
    } else if (variant.mode === "image-editing") {
      expect(String(_input)).toBe("https://api.openai.com/v1/images/edits");
      const body = init?.body as FormData;
      expect(body.get("model")).toBe("gpt-image-2");
      expect(body.get("size")).toBe("1024x1024");
      expect(body.get("quality")).toBe("auto");
      expect(Buffer.from(await (body.get("image") as Blob).arrayBuffer()).toString("base64")).toBe(TINY_PNG_BASE64);
    }
    const result = response();
    if (variant.provider === "openai" || !result.ok) return result;
    const data = await result.json();
    return new Response(JSON.stringify({ responseId: result.headers.get("x-request-id"), candidates: data.data?.map((image: { b64_json: string }) => ({ finishReason: "STOP", content: { parts: [{ inlineData: { data: image.b64_json, mimeType: "image/png" } }] } })) }), { headers: { "content-type": "application/json" } });
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

const variants: Variant[] = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gpt-image-2"].flatMap(model => ["text-to-image", "image-editing"].map(mode => ({ provider: model === "gpt-image-2" ? "openai" : "google", model, mode } as Variant)));

describe.each(variants)("durable $model $mode production action", (variant) => {
  const seedFixture = (suffix: string) => seedVariantFixture(suffix, variant);
  const installOneShotFetch = (response: () => Response) => installVariantFetch(response, variant);
  it("fails preflight without chargeable dispatch", async () => {
    const fixture = await seedFixture("preflight");
    await fixture.t.run(async ctx => ctx.db.patch(fixture.generationId, variant.mode === "image-editing" ? { referenceImageIds: [] } : { prompt: "" }));
    const fetch = vi.fn(async () => { throw new Error("PREFLIGHT_MUST_NOT_FETCH"); });
    globalThis.fetch = fetch;
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    expect(fetch).not.toHaveBeenCalled();
    const rows = await persistedRows(fixture);
    expect(rows.job).toMatchObject({ status: "failed", submissionState: "not_started" });
    expect(rows.submissions).toHaveLength(0);
  });

  it("rejects disabled credentials before beginning submission", async () => {
    const fixture = await seedFixture("disabled");
    await fixture.t.run(async ctx => {
      const record = await ctx.db.query("apiKeys").first();
      await ctx.db.patch(record!._id, { health: "disabled", disabledAt: Date.now() });
    });
    const fetch = vi.fn(async () => { throw new Error("DISABLED_MUST_NOT_FETCH"); });
    globalThis.fetch = fetch;
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    expect(fetch).not.toHaveBeenCalled();
    const rows = await persistedRows(fixture);
    expect(rows.job).toMatchObject({ status: "failed", submissionState: "not_started" });
    expect(rows.submissions).toHaveLength(0);
    expect(JSON.stringify(rows)).not.toContain(SECRET_VALUE);
  });

  it("observes in-flight at dispatch and refuses concurrent duplicate submission", async () => {
    const fixture = await seedFixture("concurrent");
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
    const releasePromise = new Promise<void>(resolve => { release = resolve; });
    const fetch = installOneShotFetch(() => new Response(JSON.stringify({ data: [{ b64_json: TINY_PNG_BASE64 }] }), { headers: { "x-request-id": "req_concurrent", "content-type": "application/json" } }));
    globalThis.fetch = async (...args) => {
      entered();
      await releasePromise;
      return fetch(...args);
    };
    const first = fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    await enteredPromise;
    expect((await snapshot(fixture)).job).toMatchObject({ status: "submitting", submissionState: "in_flight" });
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    release();
    await first;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await snapshot(fixture)).job.status).toBe("completed");
  });

  it("does not resubmit a lost transport response", async () => {
    const fixture = await seedFixture("network");
    const fetch = vi.fn(async () => { throw new TypeError(SECRET_VALUE); });
    globalThis.fetch = fetch;
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    await fixture.t.action(internal.imageGeneration.generateDurableImageBackground, { jobId: fixture.jobId });
    expect(fetch).toHaveBeenCalledTimes(1);
    const rows = await persistedRows(fixture);
    expect(rows.job).toMatchObject({ submissionState: "ambiguous" });
    expect(JSON.stringify(rows)).not.toContain(SECRET_VALUE);
  });

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
    const history = await fixture.t.withIdentity({ subject: OWNER }).query(api.generations.getMyGenerations, {});
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: "completed", imageModel: variant.model, imageStorageId: rows.outputs[0].storageId, imageUrl: expect.any(String), thumbnailUrl: expect.any(String) });
    expect(await fixture.t.withIdentity({ subject: "other_owner" }).query(api.generations.getMyGenerations, {})).toEqual([]);
    expect(await fixture.t.query(api.generations.getMyGenerations, {})).toEqual([]);
    for (const storageId of rows.generation?.referenceImageIds ?? []) {
      const saved = await fixture.t.run(async ctx => (await ctx.storage.get(storageId))?.arrayBuffer());
      expect(Buffer.from(saved!).toString("base64")).toBe(TINY_PNG_BASE64);
    }
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
    expect(rows.generation).toMatchObject({
      status: "failed",
      errorMessage: "The provider rejected the request.",
    });
    expect(rows.outputs).toHaveLength(0);
    expect(rows.job).toMatchObject({
      publicErrorCode: "provider_validation_error",
      publicErrorMessage: "The provider rejected the request.",
    });
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
