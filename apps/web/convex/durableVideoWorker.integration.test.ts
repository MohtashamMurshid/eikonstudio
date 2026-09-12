import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { CREDENTIAL_KEY_VERSION, encryptCredentialV2 } from "./credentialCrypto";
import { VIDEO_DOWNLOAD_TIMEOUT_MS, VIDEO_MAX_BYTES, downloadDurableVideo } from "./durableVideoDownload";
import { ProviderCredentialReferenceSchema, type GenerationStatusResult } from "@eikonstudio/providers";
import type { Id } from "./_generated/dataModel";
import type { VideoInput } from "../components/video-combiner/creator-session";

vi.mock("./auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth")>();
  return { ...actual, authComponent: new Proxy(actual.authComponent, {
    get(target, property, receiver) {
      if (property === "safeGetAuthUser") return async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
        const identity = await ctx.auth.getUserIdentity();
        return identity ? { _id: identity.subject } : null;
      };
      return Reflect.get(target, property, receiver);
    },
  }) };
});
const modules = (import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }).glob("./**/!(*.*.*)*.*s");
const owner = "video-owner";
const handle = "cred_video_test_1234567890";
const secret = "fake-google-secret-never-persist";
const encryptionSecret = Buffer.alloc(32, 42).toString("base64");
const operation = "models/veo-3.1-generate-preview/operations/test_-123";
const locator = "https://generativelanguage.googleapis.com/download/v1beta/files/video_123:download?alt=media";
const mp4 = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109]);
const originalFetch = globalThis.fetch;
const originalEncryptionSecret = process.env.CREDENTIAL_ENCRYPTION_SECRET;
const args = { idempotencyKey: "video-request-123", prompt: "A lighthouse", aspectRatio: "16:9" as const,
  resolution: "720p" as const, duration: 8 as const, referenceGalleryIds: [] as Id<"gallery">[] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const completed = (uri = locator) => json({ name: operation, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } } });
const videoResponse = () => new Response(mp4, { headers: { "content-type": "video/mp4", "content-length": String(mp4.length) } });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-08T12:00:00Z")); process.env.CREDENTIAL_ENCRYPTION_SECRET = encryptionSecret; });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); globalThis.fetch = originalFetch;
  if (originalEncryptionSecret === undefined) delete process.env.CREDENTIAL_ENCRYPTION_SECRET;
  else process.env.CREDENTIAL_ENCRYPTION_SECRET = originalEncryptionSecret;
});
async function fixture(create = true) {
  const t = convexTest(schema, modules);
  const user = t.withIdentity({ subject: owner });
  const envelope = await encryptCredentialV2(secret, { ownerId: owner, provider: "google", handle, keyVersion: CREDENTIAL_KEY_VERSION }, encryptionSecret);
  const credentialId = await t.run(ctx => ctx.db.insert("apiKeys", { userId: owner, provider: "gemini", canonicalProvider: "google",
    credentialHandle: handle, ...envelope, health: "active", maskedHint: "test", createdAt: Date.now(), updatedAt: Date.now() }));
  const jobId = create ? await user.mutation(api.videoGenerations.startDurableVideo, args) : undefined;
  return { t, user, credentialId, jobId: jobId! };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const state = async (f: Fixture) => (await f.t.query(internal.videoGenerations.getDurableVideoExecution, { jobId: f.jobId }))!;
const step = (f: Fixture) => f.t.action(internal.imageGeneration.generateDurableVideoBackground, { jobId: f.jobId });
async function due(f: Fixture) { const { job } = await state(f); vi.setSystemTime(Math.max(Date.now(), job.veoNextStepAt ?? job.leaseExpiresAt! + 1)); }
function transport(f: Fixture, poll = () => completed(), download = () => videoResponse()) {
  const mocked = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(secret);
    expect(url).not.toContain(secret);
    expect(init?.redirect).toBe(url === locator ? "manual" : "error");
    if (init?.method === "POST") {
      const snapshot = await state(f);
      expect(snapshot.job).toMatchObject({ status: "submitting", submissionState: "in_flight" });
      expect(snapshot.job.leaseToken).toBeTruthy();
      expect(snapshot.attempt.leaseEpoch).toBe(snapshot.job.leaseEpoch);
      return json({ name: operation });
    }
    if (url === locator) return download();
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/${operation}`);
    return poll();
  });
  globalThis.fetch = mocked;
  return mocked;
}

it("atomically creates and replays one job, attempt, event, and opaque schedule", async () => {
  const f = await fixture();
  expect(await f.user.mutation(api.videoGenerations.startDurableVideo, args)).toBe(f.jobId);
  const reordered = { duration: args.duration, referenceGalleryIds: args.referenceGalleryIds, prompt: args.prompt,
    idempotencyKey: args.idempotencyKey, resolution: args.resolution, aspectRatio: args.aspectRatio };
  expect(await f.user.mutation(api.videoGenerations.startDurableVideo, reordered)).toBe(f.jobId);
  await expect(f.user.mutation(api.videoGenerations.startDurableVideo, { ...args, prompt: "changed" })).rejects.toThrow("IDEMPOTENCY_COLLISION");
  const rows = await f.t.run(async ctx => ({ jobs: await ctx.db.query("durableGenerationJobs").collect(),
    attempts: await ctx.db.query("durableGenerationAttempts").collect(), events: await ctx.db.query("durableGenerationEvents").collect(),
    scheduled: await ctx.db.system.query("_scheduled_functions").collect() }));
  expect(rows.jobs).toHaveLength(1); expect(rows.attempts).toHaveLength(1); expect(rows.events).toHaveLength(1);
  expect(rows.scheduled).toHaveLength(1); expect(rows.scheduled[0].args).toEqual([{ jobId: f.jobId }]);
});

it("submits once, polls once, verifies MP4 checksum/storage/ledger and refresh-safe owned history", async () => {
  const f = await fixture(); const fetch = transport(f);
  await step(f);
  expect((await state(f)).job).toMatchObject({ status: "processing", providerRequestId: operation, submissionState: "accepted" });
  await due(f); await step(f);
  const saved = await state(f);
  expect(saved.job.status).toBe("completed"); expect(saved.outputs).toHaveLength(1); expect(saved.completions).toHaveLength(1);
  expect(saved.completions[0].providerRequestId).toBe(operation);
  expect(saved.outputs[0]).toMatchObject({ mediaType: "video", byteSize: mp4.length, checksumSha256: createHash("sha256").update(mp4).digest("hex") });
  expect(saved.job.finalizedOutputIds).toEqual([saved.outputs[0]._id]);
  const bytes = await f.t.run(async ctx => (await ctx.storage.get(saved.outputs[0].storageId))!.arrayBuffer());
  expect(new Uint8Array(bytes)).toEqual(mp4);
  const ledger = await f.t.run(ctx => ctx.db.query("storageReferenceLedger").collect());
  expect(ledger).toEqual(expect.arrayContaining([expect.objectContaining({ source: "durable_outputs", storageId: saved.outputs[0].storageId })]));
  const history = await f.user.query(api.videoGenerations.getMyDurableVideos, {});
  expect(history[0]).toMatchObject({ status: "completed", videoUrl: expect.any(String) });
  expect(await f.t.withIdentity({ subject: "other" }).query(api.videoGenerations.getMyDurableVideos, {})).toEqual([]);
  expect(JSON.stringify(history)).not.toContain(locator); expect(JSON.stringify(history)).not.toContain(handle);
  expect(JSON.stringify(saved)).not.toContain(secret);
  await step(f); expect(await state(f)).toEqual(saved); expect(fetch).toHaveBeenCalledTimes(3);
});

it("runs the initial scheduler target as a real action", async () => {
  const f = await fixture(); const fetch = transport(f);
  await f.t.finishInProgressScheduledFunctions();
  // Explicitly advance only the immediate creation delivery, not the whole 30-minute recovery chain.
  await vi.advanceTimersByTimeAsync(0);
  await f.t.finishInProgressScheduledFunctions();
  expect(fetch.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  expect((await state(f)).job.status).toBe("processing");
});

it("bounds processing backoff and ignores early duplicate delivery", async () => {
  const f = await fixture(); const fetch = transport(f, () => json({ name: operation }));
  await step(f);
  const first = await state(f); await step(f); expect(await state(f)).toEqual(first);
  await due(f); await step(f); const second = await state(f);
  expect(second.job.veoPollCount).toBe(2);
  expect(second.job.veoNextStepAt! - Date.now()).toBeGreaterThanOrEqual(20_000);
  expect(second.job.veoNextStepAt! - Date.now()).toBeLessThan(22_000);
  expect(second.job.status).toBe("processing"); expect(fetch).toHaveBeenCalledTimes(2);
});

it.each(["timeout", "malformed", "server", "identity"])("marks uncertain %s submission ambiguous without resubmission", async kind => {
  const f = await fixture();
  const fetch = vi.fn(async () => {
    if (kind === "timeout") throw new Error(secret);
    if (kind === "server") return json({ secret }, 503);
    return json(kind === "identity" ? { name: "operations/wrong" } : { secret });
  }); globalThis.fetch = fetch;
  await step(f); const saved = await state(f);
  expect(saved.job).toMatchObject({ status: "submitting", submissionState: "ambiguous" });
  vi.setSystemTime(Date.now() + 2_000_000); await step(f);
  expect(await state(f)).toEqual(saved); expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([400, 401, 403, 404, 422])("terminalizes definitive submission HTTP %s without retry", async status => {
  const f = await fixture(); const fetch = vi.fn(async () => json({ message: secret }, status)); globalThis.fetch = fetch;
  await step(f); expect((await state(f)).job.status).toBe("failed");
  await step(f); expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(["disabled", "owner", "provider", "aad"])("rejects %s credentials before dispatch", async kind => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.credentialId, kind === "disabled" ? { health: "disabled" } : kind === "owner" ? { userId: "other" } : kind === "provider" ? { canonicalProvider: "openai" } : { nonce: Buffer.alloc(12, 1).toString("base64") }));
  const fetch = vi.fn(); globalThis.fetch = fetch;
  await step(f); expect((await state(f)).job.status).toBe("failed"); expect(fetch).not.toHaveBeenCalled();
});

it("checks authentication, saved credentials and reference ownership atomically", async () => {
  const f = await fixture(false);
  await expect(f.t.mutation(api.videoGenerations.startDurableVideo, args)).rejects.toThrow("UNAUTHENTICATED");
  await expect(f.t.withIdentity({ subject: "other" }).mutation(api.videoGenerations.startDurableVideo, args)).rejects.toThrow("CREDENTIAL_REQUIRED");
  const galleryId = await f.t.run(async ctx => {
    const id = await ctx.storage.store(new Blob(["png"], { type: "image/png" }));
    return ctx.db.insert("gallery", { userId: "other", filename: "foreign", imageStorageId: id, thumbnailStorageId: id, createdAt: Date.now() });
  });
  await expect(f.user.mutation(api.videoGenerations.startDurableVideo, { ...args, referenceGalleryIds: [galleryId] })).rejects.toThrow("INVALID_VIDEO_REFERENCE");
  expect(await f.t.run(ctx => ctx.db.query("videoGenerations").collect())).toEqual([]);
});

it("retains ordered first/last frames including duplicates and validates before credentials", async () => {
  const f = await fixture();
  const refs = [];
  for (const content of ["first", "last"]) {
    const frame = await creatorFrame(f, owner, content);
    refs.push({ gallery: frame.galleryId, id: frame.storageId });
  }
  f.jobId = await f.user.mutation(api.videoGenerations.startDurableVideo, { ...args, idempotencyKey: "owned-frame-request", referenceGalleryIds: refs.map(r => r.gallery) });
  const fetch = transport(f); await step(f);
  const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
  expect(body.instances[0].image.bytesBase64Encoded).toBe(Buffer.from("first").toString("base64"));
  expect(body.instances[0].lastFrame.bytesBase64Encoded).toBe(Buffer.from("last").toString("base64"));
  expect((await state(f)).video.referenceImageStorageIds).toEqual(refs.map(r => r.id));
  const duplicateJob = await f.user.mutation(api.videoGenerations.startDurableVideo, { ...args, idempotencyKey: "duplicate-frames", referenceGalleryIds: [refs[0].gallery, refs[0].gallery] });
  const duplicate = (await f.t.query(internal.videoGenerations.getDurableVideoExecution, { jobId: duplicateJob }))!;
  expect(duplicate.video.referenceImageStorageIds).toEqual([refs[0].id, refs[0].id]);
  const ledger = await f.t.run(ctx => ctx.db.query("storageReferenceLedger").collect());
  expect(ledger.filter(row => row.documentId === duplicate.video._id).map(row => row.position)).toEqual([0, 1]);
});

it("fences concurrent submissions and a stale response after lease reclaim", async () => {
  const f = await fixture(); let release!: () => void; let entered!: () => void;
  const dispatched = new Promise<void>(resolve => { entered = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const fetch = vi.fn(async () => { entered(); await pending; return json({ name: operation }); }); globalThis.fetch = fetch;
  const first = step(f); await dispatched;
  await step(f); expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 240_001); await step(f);
  expect((await state(f)).job.submissionState).toBe("ambiguous");
  release(); await first; await step(f);
  expect((await state(f)).job.submissionState).toBe("ambiguous"); expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([3, 7, 8, 13, 16, 1])("records terminal provider error %s without downloading or resubmitting", async code => {
  const f = await fixture(); const fetch = transport(f, () => json({ name: operation, done: true, error: { code, message: secret } }));
  await step(f); await due(f); await step(f);
  expect((await state(f)).job.status).toBe(code === 1 ? "cancelled" : "failed"); expect((await state(f)).outputs).toEqual([]);
  await step(f); expect(fetch).toHaveBeenCalledTimes(2); expect(JSON.stringify(await state(f))).not.toContain(secret);
});

it.each([
  "https://evil.example/v1beta/files/a:download?alt=media",
  "https://generativelanguage.googleapis.com.evil.example/v1beta/files/a:download?alt=media",
  "https://user:password@generativelanguage.googleapis.com/v1beta/files/a:download?alt=media",
  "https://generativelanguage.googleapis.com/v1beta/files/a:download?alt=media&key=secret",
  "https://generativelanguage.googleapis.com/v1beta/files/%2e%2e:download?alt=media",
  "https://generativelanguage.googleapis.com/v1beta/files/a:download?alt=media#fragment",
  "http://generativelanguage.googleapis.com/v1beta/files/a:download?alt=media",
])( "rejects malicious locator %s before authenticated download", async uri => {
  const f = await fixture(); const fetch = transport(f, () => completed(uri));
  await step(f); await due(f); await step(f);
  expect((await state(f)).job.status).toBe("failed"); expect(fetch).toHaveBeenCalledTimes(2);
  await step(f); expect(fetch).toHaveBeenCalledTimes(2);
});

it.each(["redirect", "oversize", "html", "invalid-mp4", "truncated"])("rejects %s download with no output or resubmission", async kind => {
  const f = await fixture(); const fetch = transport(f, () => completed(), () => {
    if (kind === "redirect") return new Response(null, { status: 302, headers: { location: "https://evil.example" } });
    if (kind === "oversize") return new Response(mp4, { headers: { "content-type": "video/mp4", "content-length": String(VIDEO_MAX_BYTES + 1) } });
    if (kind === "html") return new Response("secret", { headers: { "content-type": "text/html" } });
    return new Response(kind === "invalid-mp4" ? "not a video file" : mp4, { headers: { "content-type": "video/mp4", ...(kind === "truncated" ? { "content-length": "100" } : {}) } });
  });
  await step(f); await due(f); await step(f);
  expect((await state(f)).job.status).toBe("failed"); expect((await state(f)).outputs).toEqual([]);
  await step(f); expect(fetch).toHaveBeenCalledTimes(3);
});

it("expires processing work and preserves queued cancellation and tombstone boundaries", async () => {
  const f = await fixture(); const fetch = transport(f); await step(f);
  vi.setSystemTime((await state(f)).job.expiresAt); await step(f);
  expect((await state(f)).job.status).toBe("expired"); expect(fetch).toHaveBeenCalledTimes(1);
  const queued = await fixture(); const initial = await state(queued);
  await queued.t.mutation(internal.durableJobs.requestCancellation, { ownerId: owner, jobId: queued.jobId,
    expectedStatus: "queued", expectedRevision: initial.job.revision, eventId: "cancel_video_queued", occurredAt: Date.now() });
  await step(queued); expect((await state(queued)).job.status).toBe("cancelled");
  await expect(queued.user.mutation(api.videoGenerations.deleteVideoGeneration, { videoGenerationId: initial.video._id })).rejects.toThrow("TOMBSTONE");
});

const pendingStatus = (): GenerationStatusResult => ({ status: "completed", providerRequestId: operation, pendingOutputs: [{ mediaType: "video", contentType: "video/mp4",
  reference: { kind: "provider-transport", providerId: "google", providerRequestId: operation, transportUrl: locator } }] });
const credential = ProviderCredentialReferenceSchema.parse({ providerId: "google", handle });
it("rejects a locator rebound to another request before credential resolution", async () => {
  const broker = vi.fn(); const fetch = vi.fn();
  await expect(downloadDurableVideo({ status: pendingStatus(), requestId: operation + "other", credential, withCredential: broker, fetch })).rejects.toThrow("POLICY");
  expect(broker).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it("bounds a hanging download including transports that ignore abort", async () => {
  const fetch = vi.fn(() => new Promise<Response>(() => undefined));
  const result = downloadDurableVideo({ status: pendingStatus(), requestId: operation, credential,
    withCredential: async (_, op) => op(secret), fetch });
  const assertion = expect(result).rejects.toThrow("TIMEOUT");
  await vi.advanceTimersByTimeAsync(VIDEO_DOWNLOAD_TIMEOUT_MS); await assertion;
  expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0]).toBeDefined();
});

async function seedInterruptedPersistence(f: Fixture, withOutput: boolean) {
  const snapshot = await state(f);
  const claimed = await f.t.mutation(internal.durableJobs.claim, { ownerId: owner, jobId: f.jobId,
    attemptKey: snapshot.attempt.attemptKey, expectedStatus: "processing", expectedRevision: snapshot.job.revision,
    leaseOwner: "interrupted-worker", leaseToken: "lease_interrupted_123", leaseDurationMs: 1000,
    eventId: "interrupted_claim", occurredAt: Date.now() });
  const fence = { ownerId: owner, jobId: f.jobId, attemptKey: snapshot.attempt.attemptKey,
    leaseToken: "lease_interrupted_123", leaseEpoch: claimed.leaseEpoch };
  const checksumSha256 = createHash("sha256").update(mp4).digest("hex");
  const completionArgs = { ...fence, expectedRevision: claimed.revision, providerRequestId: operation,
    outputIdentityKind: "checksum" as const, outputIdentity: checksumSha256, eventId: "interrupted_completion", occurredAt: Date.now() };
  const completion = await f.t.mutation(internal.durableJobs.recordProviderCompletion, completionArgs);
  expect((await f.t.mutation(internal.durableJobs.recordProviderCompletion, completionArgs)).completionId).toBe(completion.completionId);
  if (withOutput) {
    const storageId = await f.t.run(ctx => ctx.storage.store(new Blob([mp4], { type: "video/mp4" })));
    const outputArgs = { ...fence, expectedRevision: completion.revision, completionId: completion.completionId,
      outputKey: `output:${snapshot.job.jobKey}:1`, storageId, mediaType: "video" as const, contentType: "video/mp4",
      byteSize: mp4.length, checksumSha256, eventId: "interrupted_output", occurredAt: Date.now() };
    const output = await f.t.mutation(internal.durableJobs.recordDurableOutput, outputArgs);
    expect(await f.t.mutation(internal.durableJobs.recordDurableOutput, outputArgs)).toMatchObject({ outputId: output.outputId, replay: true });
  }
  vi.setSystemTime(Math.max(claimed.leaseExpiresAt + 1, snapshot.job.veoNextStepAt ?? 0));
}

it.each([false, true])("recovers interrupted completion/storage with persisted output=%s and zero resubmission", async withOutput => {
  const f = await fixture(); const fetch = transport(f); await step(f);
  await seedInterruptedPersistence(f, withOutput);
  await step(f);
  const saved = await state(f);
  expect(saved.job.status).toBe("completed"); expect(saved.outputs).toHaveLength(1); expect(saved.completions).toHaveLength(1);
  expect(fetch.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(withOutput ? 1 : 3);
  await step(f); expect(await state(f)).toEqual(saved);
});

it("rejects a changed completion checksum during recovery without creating another completion", async () => {
  const f = await fixture(); const fetch = transport(f); await step(f);
  await seedInterruptedPersistence(f, false);
  const changed = new Uint8Array(mp4); changed[19] = 110;
  transport(f, () => completed(), () => new Response(changed, { headers: { "content-type": "video/mp4" } }));
  await step(f);
  expect((await state(f)).job.status).toBe("failed"); expect((await state(f)).completions).toHaveLength(1);
  expect((await state(f)).outputs).toHaveLength(0); expect(fetch).toHaveBeenCalledTimes(1);
});

it("allows only one concurrent poll and discards a stale poll completion after reclaim", async () => {
  const f = await fixture(); const submit = transport(f); await step(f); await due(f);
  let release!: () => void; let entered!: () => void;
  const dispatched = new Promise<void>(resolve => { entered = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const poll = vi.fn(async () => { entered(); await pending; return completed(); }); globalThis.fetch = poll;
  const stale = step(f); await dispatched; await step(f); expect(poll).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 240_001);
  const current = transport(f); await step(f); const saved = await state(f);
  expect(saved.job.status).toBe("completed");
  release(); await stale;
  expect(await state(f)).toEqual(saved); expect(poll).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1); expect(current).toHaveBeenCalledTimes(2);
});

it("observes unsupported cancellation without stopping accepted upstream work", async () => {
  const f = await fixture(); const fetch = transport(f); await step(f);
  const initial = await state(f);
  await f.t.mutation(internal.durableJobs.requestCancellation, { ownerId: owner, jobId: f.jobId,
    expectedStatus: "processing", expectedRevision: initial.job.revision, eventId: "cancel_video_remote", occurredAt: Date.now() });
  await step(f); expect((await state(f)).job).toMatchObject({ status: "processing", cancellationOutcome: "unsupported", cancellationRequested: false });
  await due(f); await step(f); expect((await state(f)).job.status).toBe("completed"); expect(fetch).toHaveBeenCalledTimes(3);
});

it("bounds streamed bytes without a Content-Length header through the real action", async () => {
  const f = await fixture(); let cancelled = false;
  const chunk = new Uint8Array(8_000_000);
  const fetch = transport(f, () => completed(), () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(chunk); }, cancel() { cancelled = true; },
  }), { headers: { "content-type": "video/mp4" } }));
  await step(f); await due(f); await step(f);
  expect(cancelled).toBe(true); expect((await state(f)).job.status).toBe("failed"); expect((await state(f)).outputs).toEqual([]);
  await step(f); expect(fetch).toHaveBeenCalledTimes(3);
});

it("times out a stalled MP4 stream in a real action and never resubmits", async () => {
  const f = await fixture(); let entered!: () => void; let cancelled = false;
  const downloading = new Promise<void>(resolve => { entered = resolve; });
  let downloads = 0;
  const fetch = transport(f, () => completed(), () => { if (downloads++) return videoResponse(); entered(); return new Response(new ReadableStream({
    start() {}, cancel() { cancelled = true; },
  }), { headers: { "content-type": "video/mp4" } }); });
  await step(f); await due(f); const polling = step(f); await downloading;
  // Change wall time for the timeout callback only; queued scheduler deliveries remain explicitly controlled.
  await vi.advanceTimersByTimeAsync(VIDEO_DOWNLOAD_TIMEOUT_MS);
  await polling;
  expect(cancelled).toBe(true); expect((await state(f)).job.status).toBe("processing");
  await due(f); await step(f);
  expect((await state(f)).job.status).toBe("completed");
  expect(fetch.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
});

it.each(["missing", "unsupported", "too-many", "duration"])("rejects invalid %s references before any provider call", async kind => {
  const f = await fixture(false);
  const galleryId = await f.t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["frame"], { type: kind === "unsupported" ? "image/webp" : "image/png" }));
    return ctx.db.insert("gallery", { userId: owner, filename: "frame", imageStorageId: storageId, thumbnailStorageId: storageId, createdAt: Date.now() });
  });
  if (kind === "missing") await f.t.run(ctx => ctx.db.delete(galleryId));
  const references = kind === "too-many" ? [galleryId, galleryId, galleryId] : kind === "duration" ? [galleryId, galleryId] : [galleryId];
  const fetch = vi.fn(); globalThis.fetch = fetch;
  await expect(f.user.mutation(api.videoGenerations.startDurableVideo, { ...args, referenceGalleryIds: references,
    duration: kind === "duration" ? 4 : 8 })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it("stops at the poll budget without resubmission", async () => {
  const f = await fixture(); const fetch = transport(f); await step(f);
  await f.t.run(ctx => ctx.db.patch(f.jobId, { veoPollCount: 60 }));
  await due(f); await step(f); expect((await state(f)).job.status).toBe("failed");
  await step(f); expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([429, 503, 504])("reschedules transient poll HTTP %s without resubmission", async httpStatus => {
  const f = await fixture(); const fetch = transport(f, () => json({ message: secret }, httpStatus));
  await step(f); await due(f); await step(f);
  expect((await state(f)).job).toMatchObject({ status: "processing", veoPollCount: 2, providerRequestId: operation });
  await due(f); await step(f);
  expect(fetch.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
});

it("rechecks saved credential health on each poll", async () => {
  const f = await fixture(); const fetch = transport(f); await step(f);
  await f.t.run(ctx => ctx.db.patch(f.credentialId, { health: "disabled" }));
  await due(f); await step(f); expect((await state(f)).job.status).toBe("failed");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("fails closed on mismatched output ownership and preserves hidden terminal storage on replay", async () => {
  const f = await fixture(); const fetch = transport(f); await step(f); await due(f); await step(f);
  const saved = await state(f);
  await f.t.run(ctx => ctx.db.patch(saved.outputs[0]._id, { ownerId: "other" }));
  await expect(f.user.query(api.videoGenerations.getMyDurableVideos, {})).rejects.toThrow("VIDEO_BINDING_INVALID");
  await expect(step(f)).rejects.toThrow("VIDEO_BINDING_INVALID");
  await f.t.run(async ctx => {
    await ctx.db.patch(saved.outputs[0]._id, { ownerId: owner, tombstonedAt: Date.now() });
    await ctx.db.patch(saved.video._id, { tombstonedAt: Date.now() });
  });
  expect(await f.user.query(api.videoGenerations.getMyDurableVideos, {})).toEqual([]);
  await step(f); expect(fetch).toHaveBeenCalledTimes(3);
  const retained = await f.t.run(async ctx => (await ctx.storage.get(saved.outputs[0].storageId))!.size);
  expect(retained).toBe(mp4.length);
  await expect(f.user.mutation(api.videoGenerations.startDurableVideo, args)).rejects.toThrow("IDEMPOTENCY_COLLISION");
});

it("serializes concurrent creation retries into one scheduled job", async () => {
  const f = await fixture(false);
  const ids = await Promise.all([f.user.mutation(api.videoGenerations.startDurableVideo, args), f.user.mutation(api.videoGenerations.startDurableVideo, args)]);
  expect(ids[0]).toBe(ids[1]);
  expect(await f.t.run(ctx => ctx.db.query("durableGenerationJobs").collect())).toHaveLength(1);
  expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
});

it("keeps durable jobs out of legacy history and unverified cost analytics", async () => {
  const f = await fixture();
  expect(await f.user.query(api.videoGenerations.getMyVideoGenerations, {})).toEqual([]);
  expect(await f.user.query(api.videoGenerations.getVideoUsageStats, {})).toMatchObject({ totalGenerations: 0, totalCost: 0 });
  expect(await f.user.query(api.videoGenerations.getMyDurableVideos, {})).toHaveLength(1);
});

it("rejects a poll for a different operation without downloading", async () => {
  const f = await fixture(); const fetch = transport(f, () => json({ name: operation + "other", done: true,
    response: { generateVideoResponse: { generatedSamples: [{ video: { uri: locator } }] } } }));
  await step(f); await due(f); await step(f);
  expect((await state(f)).job.status).toBe("failed"); expect(fetch).toHaveBeenCalledTimes(2);
});

// Corrected independent reproductions from /tmp/eikon-veo-review-tests/review.test.ts.
it.each([false, true])("review: preserves POST acknowledgement with concurrent cancellation observation=%s", async observe => {
 const f = await fixture();
 let release!: () => void; let entered!: () => void;
 const pending = new Promise<void>(r => { release=r; });
 const dispatched = new Promise<void>(r => { entered=r; });
 const fetch = vi.fn(async () => { entered(); await pending; return json({name:operation}); });
 globalThis.fetch=fetch;
 const running=step(f); await dispatched;
 const s=await state(f);
 await f.t.mutation(internal.durableJobs.requestCancellation,{ownerId:owner,jobId:f.jobId,expectedStatus:"submitting",expectedRevision:s.job.revision,eventId:"review_cancel_inflight",occurredAt:Date.now()});
 if (observe) await step(f);
 release(); await running;

 const after=await state(f);
 expect(after.job).toMatchObject({status:"processing",submissionState:"accepted",cancellationOutcome:"unsupported"});
 expect(after.job.providerRequestId).toBe(operation);
 expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([503, 429, 408, 500, 502, 504, "reset"])("review: transient download %s re-polls the accepted operation and completes", async failure => {
 const f = await fixture(); let downloads = 0;
 const fetch = transport(f, () => completed(), () => {
   if (downloads++) return videoResponse();
   if (failure === "reset") throw Object.assign(new TypeError("private transport detail"), { cause: { code: "ECONNRESET" } });
   return new Response(null, { status: Number(failure) });
 });
 await step(f); await due(f); await step(f);
 expect((await state(f)).job).toMatchObject({ status: "processing", providerRequestId: operation });
 expect((await state(f)).outputs).toEqual([]);
 await due(f); await step(f);
 expect((await state(f)).job.status).toBe("completed");
 expect(fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1);
 expect(fetch.mock.calls.map(c => String(c[0])).slice(1)).toEqual([
   `https://generativelanguage.googleapis.com/v1beta/${operation}`, locator,
   `https://generativelanguage.googleapis.com/v1beta/${operation}`, locator,
 ]);
});
it("review: deadline recovery preserves unknown submission evidence and fences late acknowledgement", async () => {
 const f=await fixture();
 vi.setSystemTime((await state(f)).job.expiresAt-1000);
 let release!: () => void; let entered!: () => void;
 const pending = new Promise<void>(r => { release=r; });
 const dispatched = new Promise<void>(r => { entered=r; });
 globalThis.fetch=vi.fn(async()=>{entered();await pending;return json({name:operation});});
 const running=step(f); await dispatched;
 vi.setSystemTime(Date.now()+1001);
 await step(f); release(); await running;
 const recovered = await state(f);
 expect(recovered.job.leaseToken).toBeUndefined();
 expect(recovered.outputs).toEqual([]);
 const submissions = await f.t.run(ctx => ctx.db.query("durableProviderSubmissions").collect());
 expect(submissions).toHaveLength(1); expect(submissions[0].state).toBe("ambiguous");
 await step(f); expect(globalThis.fetch).toHaveBeenCalledTimes(1);
 expect((await state(f)).job).toMatchObject({status:"submitting",submissionState:"ambiguous"});
 expect((await f.user.query(api.videoGenerations.getMyDurableVideos,{}))[0].requiresReconciliation).toBe(true);
});
it("review: full scheduler and watchdog chain reaches maximum age with one POST", async () => {
 const f=await fixture(); const fetch=transport(f,()=>json({name:operation}));
 await f.t.finishAllScheduledFunctions(()=>vi.runAllTimers());
 expect((await state(f)).job.status).toBe("expired");
 expect(fetch.mock.calls.filter(c=>c[1]?.method==="POST")).toHaveLength(1);
 expect(fetch.mock.calls.filter(c=>c[1]?.method!=="POST").length).toBeLessThanOrEqual(60);
});

it.each(["lease-loss", "deadline"])("a transient download after %s cannot schedule or persist through an old fence", async interleaving => {
  const f = await fixture();
  let entered!: () => void; let release!: () => void;
  const downloading = new Promise<void>(r => { entered = r; });
  const pending = new Promise<void>(r => { release = r; });
  const fetch = transport(f);
  globalThis.fetch = async (input, init) => {
    if (String(input) === locator) { entered(); await pending; return new Response(null, { status: 503 }); }
    return fetch(input, init);
  };
  await step(f); await due(f); const running = step(f); await downloading;
  const before = await state(f);
  if (interleaving === "deadline") {
    vi.setSystemTime(before.job.expiresAt);
    await step(f);
  } else {
    vi.setSystemTime(before.job.leaseExpiresAt! + 1);
    await f.t.mutation(internal.durableJobs.claim, { ownerId: owner, jobId: f.jobId,
      attemptKey: before.attempt.attemptKey, expectedStatus: "processing", expectedRevision: before.job.revision,
      leaseOwner: "replacement", leaseToken: "lease_replacement", leaseDurationMs: 240000,
      eventId: "claim_replacement", occurredAt: Date.now() });
  }
  const fenced = await state(f);
  release(); await running;
  expect((await state(f)).job).toEqual(fenced.job);
  expect((await state(f)).outputs).toEqual([]);
  expect(fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1);
});

it.each(["token", "epoch", "attempt", "expired-lease", "non-cancellation", "too-many-events"])("acknowledgement revision refresh rejects %s", async kind => {
  const f = await fixture();
  let entered!: () => void; let release!: () => void;
  const dispatched = new Promise<void>(r => { entered = r; });
  const pending = new Promise<void>(r => { release = r; });
  globalThis.fetch = vi.fn(async () => { entered(); await pending; return json({ name: operation }); });
  const running = step(f); await dispatched;
  const before = await state(f);
  const fence = { ownerId: owner, jobId: f.jobId, attemptKey: before.attempt.attemptKey,
    expectedRevision: before.job.revision, leaseToken: before.job.leaseToken!, leaseEpoch: before.job.leaseEpoch };
  await f.t.mutation(internal.durableJobs.requestCancellation, { ownerId: owner, jobId: f.jobId,
    expectedStatus: "submitting", expectedRevision: before.job.revision, eventId: "cancel_refresh", occurredAt: Date.now() });
  if (kind === "token") fence.leaseToken = "lease_wrong";
  if (kind === "epoch") fence.leaseEpoch++;
  if (kind === "attempt") fence.attemptKey += ":wrong";
  if (kind === "expired-lease") vi.setSystemTime(before.job.leaseExpiresAt! + 1);
  if (kind === "non-cancellation") {
    await step(f);
    const live = await state(f);
    await f.t.mutation(internal.durableJobs.claim, { ownerId: owner, jobId: f.jobId, attemptKey: fence.attemptKey,
      leaseToken: fence.leaseToken, expectedRevision: live.job.revision,
      expectedStatus: "submitting", leaseOwner: "durable-video-worker", leaseDurationMs: 240000,
      eventId: "renew_refresh", occurredAt: Date.now() });
  }
  if (kind === "too-many-events") {
    for (let i = 0; i < 8; i++) {
      const live = await state(f);
      await f.t.mutation(internal.durableJobs.requestCancellation, { ownerId: owner, jobId: f.jobId,
        expectedStatus: "submitting", expectedRevision: live.job.revision, eventId: `cancel_refresh_${i}`, occurredAt: Date.now() });
    }
  }
  await expect(f.t.mutation(internal.durableJobs.refreshSubmissionRevision, fence)).rejects.toThrow();
  release(); await running;
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

it.each([false, true])("deadline evidence recovery is atomic with cancellation=%s and rejects premature recovery", async cancel => {
  const f = await fixture();
  vi.setSystemTime((await state(f)).job.expiresAt - 1000);
  let entered!: () => void; let release!: () => void;
  const dispatched = new Promise<void>(r => { entered = r; });
  const pending = new Promise<void>(r => { release = r; });
  globalThis.fetch = vi.fn(async () => { entered(); await pending; return json({ name: operation }); });
  const running = step(f); await dispatched;
  const before = await state(f);
  const recovery = { ownerId: owner, jobId: f.jobId, attemptKey: before.attempt.attemptKey,
    expectedRevision: before.job.revision, submissionKey: `submission:${createHash("sha256").update(before.attempt.attemptKey).digest("hex")}`,
    eventId: "deadline_recovery", occurredAt: Date.now() };
  await expect(f.t.mutation(internal.durableJobs.recoverExpiredSubmission, recovery)).rejects.toThrow("JOB_NOT_EXPIRED");
  if (cancel) await f.t.mutation(internal.durableJobs.requestCancellation, { ownerId: owner, jobId: f.jobId,
    expectedStatus: "submitting", expectedRevision: before.job.revision, eventId: "cancel_deadline", occurredAt: Date.now() });
  vi.setSystemTime(before.job.expiresAt);
  const live = await state(f);
  await expect(f.t.mutation(internal.durableJobs.transition, { ownerId: owner, jobId: f.jobId,
    expectedStatus: "submitting", expectedRevision: live.job.revision, targetStatus: "expired",
    eventId: "ordinary_expiry", eventFingerprint: "expiry", occurredAt: Date.now() })).rejects.toThrow(cancel ? "CANCELLATION_REQUIRES_OBSERVATION" : "IN_FLIGHT_REQUIRES_RECONCILIATION");
  // A late acknowledgement arriving before the watchdog also cannot grant execution rights.
  release(); await running;
  await Promise.all([step(f), step(f)]);
  const after = await state(f);
  expect(after.job).toMatchObject({ status: "submitting", submissionState: "ambiguous" });
  expect(after.outputs).toEqual([]);
  const evidence = await f.t.run(ctx => ctx.db.query("durableProviderSubmissions").collect());
  expect(evidence).toHaveLength(1);
  expect(evidence[0].state).toBe("ambiguous");
  expect((await f.user.query(api.videoGenerations.getMyDurableVideos, {}))[0].requiresReconciliation).toBe(true);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

it("re-polls for a changed approved locator after a transient download", async () => {
  const f = await fixture(); const fresh = locator.replace("video_123", "video_fresh");
  let polls = 0;
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") return json({ name: operation });
    if (String(input) === locator) return new Response(null, { status: 503 });
    if (String(input) === fresh) return videoResponse();
    expect(String(input)).toBe(`https://generativelanguage.googleapis.com/v1beta/${operation}`);
    return completed(polls++ ? fresh : locator);
  });
  globalThis.fetch = fetch;
  await step(f); await due(f); await step(f); await due(f); await step(f);
  expect((await state(f)).job.status).toBe("completed");
  expect(fetch.mock.calls.map(c => String(c[0])).slice(1)).toEqual([
    `https://generativelanguage.googleapis.com/v1beta/${operation}`, locator,
    `https://generativelanguage.googleapis.com/v1beta/${operation}`, fresh,
  ]);
  expect(fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1);
});

it("exhausts the scheduler with transient downloads within the existing age and poll budgets", async () => {
  const f = await fixture(); const fetch = transport(f, () => completed(), () => new Response(null, { status: 503 }));
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const after = await state(f);
  expect(after.job.status).toBe("expired");
  expect(after.job.veoPollCount).toBeLessThanOrEqual(60);
  expect(after.outputs).toEqual([]);
  expect(fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1);
  expect(fetch.mock.calls.filter(c => String(c[0]) === locator).length).toBeLessThanOrEqual(60);
});

// Creator boundary regressions use the same synthetic auth/network fixture as the reviewed worker.
async function creatorFrame(f: Fixture, frameOwner = owner, content: BlobPart = new Uint8Array([137, 80, 78, 71])) {
  return f.t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob([content], { type: "image/png" }));
    const metadata = (await ctx.db.system.get(storageId))!;
    const source = (await ctx.db.get(f.jobId))!;
    const { _id: _jobId, _creationTime, ...fields } = source;
    const jobId = await ctx.db.insert("durableGenerationJobs", { ...fields, ownerId: frameOwner, status: "completed",
      jobKey: `image-job:${storageId}`, generationKey: `image-generation:${storageId}`, modelId: "gemini-3.1-flash-image" });
    const binding = { ownerId: frameOwner, jobId, jobKey: `image-job:${storageId}`, generationKey: `image-generation:${storageId}`, createdAt: Date.now() };
    const completionId = await ctx.db.insert("durableGenerationCompletions", { ...binding, provider: "google", providerRequestId: "synthetic-image",
      completionKey: `image-completion:${storageId}`, outputIdentityKind: "checksum", outputIdentity: metadata.sha256 });
    const outputId = await ctx.db.insert("durableGenerationOutputs", { ...binding, completionId, outputKey: `image-output:${storageId}`,
      storageId, mediaType: "image", contentType: "image/png", byteSize: metadata.size, checksumSha256: Buffer.from(metadata.sha256, "base64").toString("hex") });
    await ctx.db.patch(jobId, { finalizedOutputIds: [outputId] });
    const galleryId = await ctx.db.insert("gallery", { userId: frameOwner, filename: "verified", imageStorageId: storageId,
      thumbnailStorageId: storageId, createdAt: Date.now() });
    return { galleryId, storageId, outputId, jobId };
  });
}

it("creator accepts ordered owned durable frames and rejects forged legacy gallery ownership", async () => {
  const f = await fixture(); const first = await creatorFrame(f); const last = await creatorFrame(f);
  const foreign = await creatorFrame(f, "other");
  const forged = await f.user.mutation(api.gallery.saveImage, { filename: "forged", imageStorageId: foreign.storageId, thumbnailStorageId: foreign.storageId });
  const view = await f.user.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner });
  expect(view!.frames.map(row => row.id)).toEqual(expect.arrayContaining([first.galleryId, last.galleryId]));
  expect(view!.frames.map(row => row.id)).not.toContain(forged);
  for (const refs of [[first.galleryId], [first.galleryId, last.galleryId], [last.galleryId, first.galleryId], [first.galleryId, first.galleryId]]) {
    const jobId = await f.user.mutation(api.videoGenerations.startCreatorVideo, { ...args, ownerId: owner,
      idempotencyKey: `creator-frames-${refs.join("-").replaceAll(";", "-")}`, referenceGalleryIds: refs });
    const execution = await f.t.query(internal.videoGenerations.getDurableVideoExecution, { jobId });
    expect(execution!.video.referenceImageStorageIds).toEqual(refs.map(id => id === first.galleryId ? first.storageId : last.storageId));
  }
  for (const id of [foreign.galleryId, forged]) {
    await expect(f.user.mutation(api.videoGenerations.startCreatorVideo, { ...args, ownerId: owner,
      idempotencyKey: `creator-reject-${id.replaceAll(";", "-")}`, referenceGalleryIds: [id] })).rejects.toThrow("INVALID_VIDEO_REFERENCE");
  }
  await f.t.run(ctx => ctx.db.patch(first.outputId, { tombstonedAt: Date.now() }));
  expect((await f.user.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner }))!.frames.map(row => row.id)).not.toContain(first.galleryId);
});

it.each(["durable", "creator"] as const)("%s start enforces shared frame ownership and preserves exact replay", async entry => {
  const f = await fixture();
  const own = await creatorFrame(f);
  const foreign = await creatorFrame(f, "other");
  const unverified = await f.t.run(ctx => ctx.db.insert("gallery", { userId: owner, filename: "unverified",
    imageStorageId: foreign.storageId, thumbnailStorageId: foreign.storageId, createdAt: Date.now() }));
  const start = (referenceGalleryIds: Id<"gallery">[], idempotencyKey: string) => entry === "creator"
    ? f.user.mutation(api.videoGenerations.startCreatorVideo, { ...args, ownerId: owner, referenceGalleryIds, idempotencyKey })
    : f.user.mutation(api.videoGenerations.startDurableVideo, { ...args, referenceGalleryIds, idempotencyKey });
  const before = await f.t.run(ctx => ctx.db.query("videoGenerations").collect());
  await expect(start([unverified], "unverified-frame-request")).rejects.toThrow("INVALID_VIDEO_REFERENCE");
  expect(await f.t.run(ctx => ctx.db.query("videoGenerations").collect())).toEqual(before);
  const job = await start([own.galleryId, own.galleryId], "valid-frame-request");
  await f.t.run(ctx => ctx.db.delete(own.galleryId));
  expect(await start([own.galleryId, own.galleryId], "valid-frame-request")).toBe(job);
  await expect(start([own.galleryId], "valid-frame-request")).rejects.toThrow("IDEMPOTENCY_COLLISION");
});

it("creator fences account switches in both subscription and submission and exposes metadata only", async () => {
  const f = await fixture();
  expect(await f.t.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner })).toBeNull();
  const other = f.t.withIdentity({ subject: "other" });
  expect(await other.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner, requestKey: args.idempotencyKey })).toBeNull();
  await expect(other.mutation(api.videoGenerations.startCreatorVideo, { ...args, ownerId: owner })).rejects.toThrow("UNAUTHENTICATED");
  const view = await f.user.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner });
  expect(view!.credential).toMatchObject({ provider: "google", health: "active" });
  expect(JSON.stringify(view)).not.toContain(secret); expect(JSON.stringify(view)).not.toContain("ciphertext");
});

it("creator controller recovers a committed lost response by subscription, refreshes and renders persisted completion without resubmitting", async () => {
  const { VideoCreatorSession, creatorJobView } = await import("../components/video-combiner/creator-session");
  const f = await fixture(false);
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const uuid = () => "00000000-0000-4000-8000-000000000000";
  const creator = new VideoCreatorSession(owner, storage, uuid);
  const { idempotencyKey: _key, ...input } = args;
  const start = vi.fn(async (request: VideoInput & { ownerId: string; idempotencyKey: string }) => {
    f.jobId = await f.user.mutation(api.videoGenerations.startCreatorVideo, request);
    throw new Error("lost synthetic response");
  });
  await creator.submit(input, [], true, start);
  const restored = new VideoCreatorSession(owner, storage, uuid);
  const read = () => f.user.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner, requestKey: restored.snapshot!.key });
  expect((await read())!.jobs[0].status).toBe("queued");
  await restored.submit(input, [], true, start); expect(start).toHaveBeenCalledTimes(1);
  const fetch = transport(f); await step(f);
  expect(creatorJobView((await read())!.jobs[0])).toEqual({ label: "Processing", url: null });
  await due(f); await step(f);
  const completedView = creatorJobView((await read())!.jobs[0]);
  expect(completedView.label).toBe("Completed"); expect(completedView.url).toBeTruthy(); expect(completedView.url).not.toContain("googleapis");
  await restored.submit(input, [], true, start); expect(start).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
});

it("creator exact request subscription finds older work outside the recent 100 and hides nonfinalized URLs", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const video = (await ctx.db.query("videoGenerations").withIndex("by_durable_job", q => q.eq("durableJobId", f.jobId)).unique())!;
    const { _id, _creationTime, ...fields } = video;
    for (let i = 0; i < 101; i++) await ctx.db.insert("videoGenerations", { ...fields,
      requestIdempotencyKey: `later-${i}`, createdAt: Date.now() + i + 1 });
  });
  const state = await f.user.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner, requestKey: args.idempotencyKey });
  expect(state!.jobs.find(job => job.requestKey === args.idempotencyKey)).toMatchObject({ status: "queued", videoUrl: null });
  await f.t.run(ctx => ctx.db.patch(f.jobId, { submissionState: "ambiguous", status: "expired" }));
  const unknown = await f.user.query(api.videoGenerations.getVideoCreatorState, { ownerId: owner, requestKey: args.idempotencyKey });
  expect(unknown!.jobs.find(job => job.requestKey === args.idempotencyKey)).toMatchObject({ status: "expired", ambiguous: true, videoUrl: null });
});
