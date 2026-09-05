import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalogModel, CredentialHandleSchema, GenerationRequestSchema, NormalizedErrorResultSchema } from "@eikonstudio/core";
import {
  GoogleImageAdapter,
  GOOGLE_IMAGE_CAPABILITY,
  GOOGLE_IMAGE_EDIT_CAPABILITY,
  GOOGLE_IMAGE_MODELS,
  ProviderInputValidationError,
  ProviderOperationUnsupportedError,
  assertProviderAdapter,
  type AdapterContext,
  type NormalizedProviderInput,
} from "../src/index.js";

const secret = "google-secret-do-not-persist";
const context: AdapterContext = {
  credential: { providerId: "google", handle: CredentialHandleSchema.parse("cred_google_123456") },
  requestId: "test_request",
};
const reference = {
  mediaType: "image",
  contentType: "image/png",
  reference: { kind: "eikon-storage", storageId: "stored_image", ownerId: "owner", assetId: "asset_reference000001" },
};
function request(edit = false, model = GOOGLE_IMAGE_MODELS[0]!.id) {
  const capability = edit ? GOOGLE_IMAGE_EDIT_CAPABILITY : GOOGLE_IMAGE_CAPABILITY;
  return GenerationRequestSchema.parse({
    modelId: model,
    task: capability.task,
    operation: capability.operation,
    schemaRevision: capability.schemaRevision,
    input: { prompt: "Draw a fox", inputAssets: edit ? [reference] : [], outputCount: 1, aspectRatio: "21:9", resolution: "4K" },
  });
}
function response(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      responseId: "google_native_response",
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { text: "Done" },
              { thought: true, inlineData: { data: "AQ==", mimeType: "image/png" } },
              { inlineData: { data: "AAE=", mimeType: "image/png" } },
            ],
          },
        },
      ],
      ...overrides,
    }),
    { headers: { "content-type": "application/json" } },
  );
}
function fixture(fetchImpl: typeof fetch = vi.fn(async () => response()), edit = false) {
  const events: string[] = [];
  const withCredential = vi.fn(async (_ref, use) => {
    events.push("credential");
    return use(secret);
  });
  const imageResolver = vi.fn(async () => {
    events.push("reference");
    return { bytes: new Uint8Array([2, 3]), contentType: "image/png" };
  });
  const fetch = vi.fn(async (...args: Parameters<typeof globalThis.fetch>) => {
    events.push("transport");
    return fetchImpl(...args);
  });
  const adapter = new GoogleImageAdapter({ credentialBroker: { withCredential }, imageResolver, fetch });
  return {
    adapter,
    events,
    withCredential,
    imageResolver,
    fetch,
    input: () => adapter.normalizeInput(request(edit), edit ? GOOGLE_IMAGE_EDIT_CAPABILITY : GOOGLE_IMAGE_CAPABILITY),
  };
}
afterEach(() => vi.useRealTimers());

describe("Google image adapter", () => {
  it("preserves canonical catalog IDs separately from native model IDs", () => {
    expect(GOOGLE_IMAGE_MODELS.map((model) => [model.id, model.providerNative.modelId])).toEqual([
      ["google/nano-banana/gemini-3-1-flash-image", "gemini-3.1-flash-image"],
      ["google/nano-banana/gemini-3-pro-image", "gemini-3-pro-image"],
    ]);
    for (const model of GOOGLE_IMAGE_MODELS) expect(getCatalogModel(model.id)?.nativeId).toBe(model.providerNative.modelId);
  });
  it.each(
    GOOGLE_IMAGE_MODELS.flatMap(
      (model) =>
        [
          [model.id, false],
          [model.id, true],
        ] as const,
    ),
  )("sends one bounded %s edit=%s request", async (model, editing) => {
    const f = fixture(
      vi.fn(async (url, init) => {
        expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${getCatalogModel(model)!.nativeId}:generateContent`);
        expect(init?.redirect).toBe("error");
        expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(secret);
        expect(String(url) + init?.body).not.toContain(secret);
        expect(JSON.parse(String(init?.body))).toEqual({
          contents: [
            {
              role: "user",
              parts: [...(editing ? [{ inlineData: { data: "AgM=", mimeType: "image/png" } }] : []), { text: "Draw a fox" }],
            },
          ],
          ...(editing ? {} : { generationConfig: { imageConfig: { aspectRatio: "21:9", imageSize: "4K" } } }),
        });
        return response();
      }),
      editing,
    );
    assertProviderAdapter(f.adapter);
    const input = await f.adapter.normalizeInput(request(editing, model), editing ? GOOGLE_IMAGE_EDIT_CAPABILITY : GOOGLE_IMAGE_CAPABILITY);
    const result = await f.adapter.submitGeneration(input, context);
    expect(result).toEqual({
      delivery: "synchronous",
      providerRequestId: "google_native_response",
      status: "completed",
      outputs: [{ mediaType: "image", contentType: "image/png", bytes: new Uint8Array([0, 1]) }],
    });
    expect(f.events).toEqual(editing ? ["reference", "credential", "transport"] : ["credential", "transport"]);
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify({ input, result })).not.toContain(secret);
  });
  it.each([
    [400, "validation"],
    [401, "authentication"],
    [403, "billing-access"],
    [404, "validation"],
    [408, "timeout"],
    [429, "rate-limit"],
    [503, "provider-unavailable"],
  ])("classifies HTTP %s without provider text or retries", async (status, category) => {
    const f = fixture(
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: secret + " hostile prompt and url", status: "SECRET" } }), {
            status: Number(status),
          }),
      ),
    );
    let error: unknown;
    try {
      await f.adapter.submitGeneration(await f.input(), context);
    } catch (cause) {
      error = cause;
    }
    expect(error).toMatchObject({ status });
    const normalized = f.adapter.normalizeError(error, "corr_google_error_1");
    expect(NormalizedErrorResultSchema.safeParse(normalized).success).toBe(true);
    expect(normalized.publicError.category).toBe(category);
    expect(JSON.stringify({ error, normalized })).not.toMatch(/hostile|SECRET|google-secret/);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { responseId: "" },
    { candidates: [] },
    { candidates: [{ content: { parts: [{ inlineData: { data: "%%%", mimeType: "image/png" } }] } }] },
    { candidates: [{ content: { parts: [{ inlineData: { data: "AA==", mimeType: "text/html" } }] } }] },
    {
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: "AA==", mimeType: "image/png" } }, { inlineData: { data: "AA==", mimeType: "image/png" } }],
          },
        },
      ],
    },
    { candidates: [{ content: { parts: [{ fileData: { fileUri: "https://untrusted.test/image" } }] } }] },
    { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ inlineData: { data: "AA==", mimeType: "image/png" } }] } }] },
  ])("rejects malformed or incomplete output %#", async (overrides) => {
    const f = fixture(vi.fn(async () => response(overrides)));
    await expect(f.adapter.submitGeneration(await f.input(), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects safety-filtered output without retaining feedback", async () => {
    const f = fixture(vi.fn(async () => response({ promptFeedback: { blockReason: "SAFETY", blockReasonMessage: secret } })));
    let error;
    try {
      await f.adapter.submitGeneration(await f.input(), context);
    } catch (cause) {
      error = cause;
    }
    expect(f.adapter.normalizeError(error, "corr_google_safety").publicError.category).toBe("moderation");
    expect(JSON.stringify(error)).not.toContain(secret);
  });
  it.each(["model", "schema", "operation", "credential", "namespace", "references"])(
    "rejects invalid %s before resolution",
    async (field) => {
      const f = fixture();
      const input = await f.input();
      const bad = structuredClone(input);
      let ctx = context;
      if (field === "model") Object.assign(bad, { modelId: "google/nano-banana/gemini-unapproved" });
      if (field === "schema") Object.assign(bad, { schemaRevision: "schema_unknown" });
      if (field === "operation") Object.assign(bad, { operation: "edit" });
      if (field === "credential") ctx = { ...context, credential: { ...context.credential, providerId: "openai" } };
      if (field === "namespace") Object.assign(bad.native, { namespace: "provider:openai" });
      if (field === "references") Object.assign(bad.native.values, { references: [reference] });
      await expect(f.adapter.submitGeneration(bad as NormalizedProviderInput, ctx)).rejects.toBeInstanceOf(ProviderInputValidationError);
      expect(f.events).toEqual([]);
    },
  );
  it("fails missing and oversized references before credentials or submission", async () => {
    const f = fixture(undefined, true);
    f.imageResolver.mockResolvedValue({ bytes: new Uint8Array(25_000_001), contentType: "image/png" });
    await expect(f.adapter.submitGeneration(await f.input(), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(f.withCredential).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
    const invalid = request(true);
    invalid.input.inputAssets[0]!.reference = {
      kind: "remote-untrusted",
      url: "https://untrusted.test/image",
      validationStatus: "pending",
    };
    await expect(f.adapter.normalizeInput(invalid, GOOGLE_IMAGE_EDIT_CAPABILITY)).rejects.toBeInstanceOf(ProviderInputValidationError);
  });
  it("cancels an oversized chunked response before parsing", async () => {
    let cancellations = 0;
    const f = fixture(
      vi.fn(
        async () =>
          new Response(
            new ReadableStream(
              {
                pull(controller) {
                  controller.enqueue(new Uint8Array(34_000_000));
                },
                cancel() {
                  cancellations++;
                },
              },
              { highWaterMark: 0 },
            ),
          ),
      ),
    );
    await expect(f.adapter.submitGeneration(await f.input(), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(cancellations).toBe(1);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("enforces decoded output limit", async () => {
    const f = fixture(
      vi.fn(async () =>
        response({ candidates: [{ content: { parts: [{ inlineData: { data: "AAAA".repeat(5_000_001), mimeType: "image/png" } }] } }] }),
      ),
    );
    await expect(f.adapter.submitGeneration(await f.input(), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
  });
  it("honors pre-abort without reading references or resolving credentials", async () => {
    const f = fixture(undefined, true);
    const controller = new AbortController();
    controller.abort();
    await expect(f.adapter.submitGeneration(await f.input(), { ...context, signal: controller.signal })).rejects.toMatchObject({
      category: "cancelled",
    });
    expect(f.events).toEqual([]);
  });
  it("aborts one timed out request and never retries", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      async (_url, init) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error(secret)))),
    );
    const adapter = new GoogleImageAdapter({
      credentialBroker: { withCredential: async (_ref, use) => use(secret) },
      fetch,
      timeoutMs: 10,
    });
    const input = await adapter.normalizeInput(request(), GOOGLE_IMAGE_CAPABILITY);
    const check = expect(adapter.submitGeneration(input, context)).rejects.toMatchObject({ category: "timeout" });
    await vi.advanceTimersByTimeAsync(11);
    await check;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("returns safe network errors and fails unsupported methods locally", async () => {
    const f = fixture(
      vi.fn(async () => {
        throw new TypeError(secret);
      }),
    );
    await expect(f.adapter.submitGeneration(await f.input(), context)).rejects.toMatchObject({ category: "provider-unavailable" });
    const calls = [
      f.adapter.validateCredentials(context.credential),
      f.adapter.estimateCost(await f.input(), context),
      f.adapter.getGenerationStatus("req", context),
      f.adapter.cancelGeneration("req", context),
      f.adapter.normalizeOutput({ providerRequestId: "req", status: "completed" }, context),
      f.adapter.verifyWebhook({} as never),
    ];
    for (const call of calls) await expect(call).rejects.toBeInstanceOf(ProviderOperationUnsupportedError);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
});
