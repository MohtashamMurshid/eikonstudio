import { afterEach, describe, expect, it, vi } from "vitest";
import { CredentialHandleSchema, GenerationRequestSchema, NormalizedErrorResultSchema, getCatalogModel } from "@eikonstudio/core";
import { GoogleVeoAdapter, GOOGLE_VEO_MODEL, GOOGLE_VEO_TEXT_CAPABILITY, GOOGLE_VEO_IMAGE_CAPABILITY, GOOGLE_VEO_MAX_STATUS_BYTES, ProviderInputValidationError, ProviderOperationUnsupportedError, assertProviderAdapter, type AdapterContext, type ProviderAdapter, type ServerCredentialBroker } from "../src/index.js";

const secret = "veo-secret-must-never-escape";
const name = "models/veo-3.1-generate-preview/operations/_request-123";
const uri = "https://generativelanguage.googleapis.com/v1beta/files/video_123:download?alt=media";
const context: AdapterContext = { requestId: "corr_veo_test", credential: { providerId: "google", handle: CredentialHandleSchema.parse("cred_google_veo_test") } };
const frame = { mediaType: "image", contentType: "image/png", reference: { kind: "eikon-storage", ownerId: "owner", assetId: "asset_veoframe123456", storageId: "frame_storage" } };
function request(count = 0, input: Record<string, unknown> = {}) {
  const capability = count ? GOOGLE_VEO_IMAGE_CAPABILITY : GOOGLE_VEO_TEXT_CAPABILITY;
  const base = GenerationRequestSchema.parse({ modelId: GOOGLE_VEO_MODEL.id, task: capability.task, operation: "generate", schemaRevision: capability.schemaRevision,
    input: { prompt: "A circle moves across a white background.", inputAssets: Array.from({ length: count }, () => frame), outputCount: 1 } });
  return { ...base, input: { ...base.input, ...input } };
}
function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
}
function completed(overrides: Record<string, unknown> = {}) {
  return { name, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri } }], ...overrides } } };
}
function fixture(response: () => Promise<Response> | Response = () => json({ name })) {
  const events: string[] = [];
  const credentialBroker: ServerCredentialBroker = { async withCredential(_reference, use) { events.push("credential"); return use(secret); } };
  const withCredential = vi.spyOn(credentialBroker, "withCredential");
  const fetch = vi.fn<typeof globalThis.fetch>(async () => { events.push("transport"); return response(); });
  const imageResolver = vi.fn(async () => { events.push("reference"); return { contentType: "image/png", bytes: new Uint8Array([1, 2, 3]) }; });
  const options = { credentialBroker, fetch, imageResolver, now: () => "2026-09-06T00:00:00.000Z" };
  const adapter = new GoogleVeoAdapter(options);
  return { adapter, options, withCredential, fetch, imageResolver, events, input: (count = 0, values = {}) => adapter.normalizeInput(request(count, values), count ? GOOGLE_VEO_IMAGE_CAPABILITY : GOOGLE_VEO_TEXT_CAPABILITY) };
}
afterEach(() => vi.useRealTimers());

describe("Google Veo adapter", () => {
  it("keeps public readiness unchanged and advertises the bounded asynchronous capabilities", async () => {
    const f = fixture();
    assertProviderAdapter(f.adapter);
    const discovery = await f.adapter.discoverModels(context);
    expect(discovery.transport).toMatchObject({ submission: "asynchronous", polling: "required", cancellation: "unsupported", webhook: "unsupported" });
    expect(getCatalogModel(GOOGLE_VEO_MODEL.id)).toMatchObject({ nativeId: "veo-3.1-generate-preview", readiness: "discovered" });
    expect(GOOGLE_VEO_MODEL.providerNative.modelId).toBe("veo-3.1-generate-preview");
    expect(f.withCredential).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2])("submits %s ordered frames once, resolving all bytes before credentials", async count => {
    const f = fixture();
    const input = await f.input(count, { aspectRatio: "9:16", resolution: "1080p", durationSeconds: 8, negativePrompt: "No captions" });
    const result = await f.adapter.submitGeneration(input, context);
    expect(result).toEqual({ delivery: "asynchronous", providerRequestId: name, status: "processing" });
    expect(f.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = f.fetch.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning");
    expect(init).toMatchObject({ method: "POST", redirect: "error" });
    expect(new Headers(init!.headers).get("x-goog-api-key")).toBe(secret);
    const image = { mimeType: "image/png", bytesBase64Encoded: "AQID" };
    expect(JSON.parse(init!.body as string)).toEqual({ instances: [{ prompt: request().input.prompt, ...(count ? { image } : {}), ...(count === 2 ? { lastFrame: image } : {}) }],
      parameters: { sampleCount: 1, aspectRatio: "9:16", resolution: "1080p", durationSeconds: 8, personGeneration: count ? "allow_adult" : "allow_all", negativePrompt: "No captions" } });
    expect(f.events).toEqual([...Array(count).fill("reference"), "credential", "transport"]);
    expect(JSON.stringify({ input, result, url, body: init!.body })).not.toContain(secret);
  });
  it("retains an immediately completed operation without submitting it again", async () => {
    const f = fixture(() => json(completed()));
    expect(await f.adapter.submitGeneration(await f.input(), context)).toMatchObject({ providerRequestId: name, status: "processing" });
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { outputCount: 2 }, { audio: false }, { seed: 1 }, { aspectRatio: "1:1" }, { resolution: "4k" },
    { durationSeconds: 5 }, { durationSeconds: 4, resolution: "1080p" }, { prompt: "   " },
  ])("rejects unsupported controls before credential access: %j", async controls => {
    const f = fixture();
    await expect(f.input(0, controls)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each(["model", "revision", "providerOptions", "webhook", "task"]) ("rejects unsupported %s before credential access", async field => {
    const f = fixture(); const value = request();
    const changed = { ...value, ...(field === "model" ? { modelId: "google/veo/veo-3-1-fast-generate-preview" } : field === "revision" ? { schemaRevision: "schema_unsupported" } : field === "providerOptions" ? { providerOptions: {} } : field === "webhook" ? { webhookTarget: {} } : { task: "video-to-video" }) };
    await expect(f.adapter.normalizeInput(changed as typeof value, GOOGLE_VEO_TEXT_CAPABILITY)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled();
  });
  it("rejects forged normalized input and wrong provider credentials", async () => {
    const f = fixture(); const input = await f.input();
    await expect(f.adapter.submitGeneration({ ...input, native: { ...input.native, values: { ...input.native.values, hidden: true } } }, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    await expect(f.adapter.submitGeneration(input, { ...context, credential: { ...context.credential, providerId: "openai" } })).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each([0, 25_000_001])("rejects a resolved frame of %s bytes before credential access", async size => {
    const f = fixture(); f.imageResolver.mockResolvedValue({ contentType: "image/png", bytes: new Uint8Array(size) });
    await expect(f.adapter.submitGeneration(await f.input(1), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled();
  });
  it("rejects missing frames, type mismatches, unsupported images, and excess references", async () => {
    const f = fixture();
    await expect(f.input(3)).rejects.toBeInstanceOf(ProviderInputValidationError);
    await expect(f.input(1, { inputAssets: [{ ...frame, contentType: "image/webp" }] })).rejects.toBeInstanceOf(ProviderInputValidationError);
    await expect(f.input(1, { inputAssets: [] })).rejects.toBeInstanceOf(ProviderInputValidationError);
    f.imageResolver.mockResolvedValue({ contentType: "image/jpeg", bytes: new Uint8Array([1]) });
    await expect(f.adapter.submitGeneration(await f.input(1), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    const noResolver = new GoogleVeoAdapter({ credentialBroker: f.options.credentialBroker, fetch: f.fetch });
    await expect(noResolver.submitGeneration(await f.input(1), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled();
  });
  it.each([4, 6])("rejects a %s-second first/last-frame request before submission", async durationSeconds => {
    const f = fixture();
    await expect(f.input(2, { durationSeconds })).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("does not submit a partial set when the second frame is unavailable", async () => {
    const f = fixture();
    f.imageResolver.mockResolvedValueOnce({ contentType: "image/png", bytes: new Uint8Array([1]) }).mockRejectedValueOnce(new ProviderInputValidationError());
    await expect(f.adapter.submitGeneration(await f.input(2), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.events).toEqual([]);
    expect(f.imageResolver).toHaveBeenCalledTimes(2);
    expect(f.withCredential).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("refuses remote frame inputs before resolving images or credentials", async () => {
    const f = fixture();
    await expect(f.input(1, { inputAssets: [{ ...frame, reference: { kind: "remote-untrusted", url: "https://example.com/image.png", validationStatus: "pending" } }] })).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.imageResolver).not.toHaveBeenCalled(); expect(f.withCredential).not.toHaveBeenCalled();
  });
  it.each([{}, { name: "operations/unknown" }, { name: `${name}\n` }])("rejects malformed submission acknowledgements without resubmission", async body => {
    const f = fixture(() => json(body));
    await expect(f.adapter.submitGeneration(await f.input(), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([{ name }, { name, done: false }])("performs exactly one poll for a pending operation", async response => {
    const f = fixture(() => json(response));
    expect(await f.adapter.getGenerationStatus(name, context)).toEqual({ providerRequestId: name, status: "processing" });
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.fetch.mock.calls[0]![0]).toBe(`https://generativelanguage.googleapis.com/v1beta/${name}`);
    expect(f.fetch.mock.calls[0]![1]).toMatchObject({ method: "GET", redirect: "error" });
    expect(f.fetch.mock.calls[0]![1]?.body).toBeUndefined();
  });
  it("returns one request-bound transport locator without fetching media or claiming durable storage", async () => {
    const f = fixture(() => json(completed()));
    expect(await f.adapter.getGenerationStatus(name, context)).toEqual({ providerRequestId: name, status: "completed", pendingOutputs: [{ mediaType: "video", contentType: "video/mp4", reference: { kind: "provider-transport", providerId: "google", providerRequestId: name, transportUrl: uri } }] });
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["https://attacker.example/op", "operations/foo", `${name}?key=oops`, `${name}\n`, `${name}/..`, name.replace("generate-preview", "fast-generate-preview")])("rejects unbound operation paths without credentials: %s", async id => {
    const f = fixture(); await expect(f.adapter.getGenerationStatus(id, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each([
    {}, { name: "wrong", done: false }, { name, done: true }, { name, done: false, error: { code: 3 } },
    { ...completed(), error: { code: 3 } }, completed({ generatedSamples: [] }),
    completed({ generatedSamples: [{ video: { uri } }, { video: { uri } }] }), completed({ raiMediaFilteredCount: 1 }),
  ])("rejects inconsistent or malformed operations: %j", async body => {
    const f = fixture(() => json(body)); await expect(f.adapter.getGenerationStatus(name, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["https://attacker.example/file.mp4", uri.replace("https:", "http:"), `${uri}&key=${secret}`, `${uri}\n`, uri.replace("/files/", "/files/../"), uri.replace("googleapis.com", "googleapis.com.attacker.example")])("rejects unsafe output locators", async transportUrl => {
    const f = fixture(() => json(completed({ generatedSamples: [{ video: { uri: transportUrl } }] })));
    await expect(f.adapter.getGenerationStatus(name, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("reports terminal moderation safely with no automatic retry", async () => {
    const f = fixture(() => json(completed({ generatedSamples: [], raiMediaFilteredCount: 1, raiMediaFilteredReasons: [secret] })));
    const result = await f.adapter.getGenerationStatus(name, context);
    expect(result).toMatchObject({ status: "failed", error: { category: "moderation", retryable: false } });
    expect(JSON.stringify(result)).not.toContain(secret); expect(result.pendingOutputs).toBeUndefined();
  });
  it.each([[1, "cancelled"], [3, "validation"], [7, "billing-access"], [8, "rate-limit"], [13, "provider-unavailable"], [16, "authentication"], [999, "unknown"]])("normalizes terminal RPC %s without native messages", async (code, category) => {
    const f = fixture(() => json({ name, done: true, error: { code, message: secret, details: [{ apiKey: secret }] } }));
    const result = await f.adapter.getGenerationStatus(name, context);
    expect(result).toMatchObject({ status: code === 1 ? "cancelled" : "failed", error: { category, retryable: false } });
    expect(JSON.stringify(result)).not.toContain(secret); expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([[400, "validation"], [401, "authentication"], [403, "billing-access"], [404, "validation"], [429, "rate-limit"], [504, "timeout"], [503, "provider-unavailable"]])("normalizes HTTP %s without bodies or retries", async (status, category) => {
    const f = fixture(() => json({ message: secret }, Number(status)));
    const error = await f.adapter.submitGeneration(await f.input(), context).catch(value => value);
    const normalized = f.adapter.normalizeError(error, context.requestId);
    expect(normalized.publicError.category).toBe(category); expect(NormalizedErrorResultSchema.safeParse(normalized).success).toBe(true);
    expect(JSON.stringify({ error, normalized })).not.toContain(secret); expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["declared", "chunked"])("bounds %s status bodies and cancels the stream", async kind => {
    const cancel = vi.fn();
    const f = fixture(() => new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(GOOGLE_VEO_MAX_STATUS_BYTES + 1)); }, cancel }), { headers: kind === "declared" ? { "content-length": String(GOOGLE_VEO_MAX_STATUS_BYTES + 1) } : {} }));
    await expect(f.adapter.getGenerationStatus(name, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(cancel).toHaveBeenCalledTimes(1); expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("cancels a slow status body at the deadline without retrying", async () => {
    vi.useFakeTimers();
    const f = fixture(); const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => new Response(new ReadableStream({ start(controller) { init!.signal!.addEventListener("abort", () => controller.error(new Error(secret))); } })));
    const adapter = new GoogleVeoAdapter({ ...f.options, fetch, timeoutMs: 20 });
    const result = adapter.getGenerationStatus(name, context).catch(error => adapter.normalizeError(error, context.requestId));
    await vi.advanceTimersByTimeAsync(20);
    expect(await result).toMatchObject({ publicError: { category: "timeout" } }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("honors a pre-aborted signal before credential or image access", async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.adapter.submitGeneration(await f.input(1), { ...context, signal: controller.signal })).rejects.toMatchObject({ category: "cancelled" });
    expect(f.withCredential).not.toHaveBeenCalled(); expect(f.imageResolver).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("redacts lost transport responses and never retries", async () => {
    const f = fixture(() => { throw new Error(secret); });
    const error = await f.adapter.submitGeneration(await f.input(), context).catch(value => value);
    expect(f.adapter.normalizeError(error, context.requestId).publicError.category).toBe("provider-unavailable");
    expect(JSON.stringify(error)).not.toContain(secret); expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("fails unsupported methods locally", async () => {
    const f = fixture(); const adapter: ProviderAdapter = f.adapter;
    const input = await f.input();
    for (const call of [() => adapter.validateCredentials(context.credential), () => adapter.estimateCost(input, context), () => adapter.cancelGeneration(name, context), () => adapter.normalizeOutput({ providerRequestId: name, status: "completed" }, context), () => adapter.verifyWebhook({} as never)]) {
      await expect(call()).rejects.toBeInstanceOf(ProviderOperationUnsupportedError);
    }
    expect(f.fetch).not.toHaveBeenCalled(); expect(f.withCredential).not.toHaveBeenCalled();
  });
});
