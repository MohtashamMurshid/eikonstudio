import { describe, expect, it, vi } from "vitest";

import { CredentialHandleSchema, GenerationRequestSchema, NormalizedErrorResultSchema } from "@eikonstudio/core";
import {
  OPENAI_IMAGE_CAPABILITY,
  OPENAI_IMAGE_MAX_OUTPUT_BYTES,
  OPENAI_IMAGE_MODEL_ID,
  OPENAI_IMAGE_SCHEMA_REVISION,
  OpenAIImageAdapter,
  ProviderInputValidationError,
  ProviderOperationUnsupportedError,
  type AdapterContext,
  type NormalizedProviderInput,
  type ServerCredentialBroker,
} from "../src/index.js";

const secret = "sk-test-confined-value";
const maxResponseBodyBytes = 4 * Math.ceil(OPENAI_IMAGE_MAX_OUTPUT_BYTES / 3) + 65_536;
const credential = { providerId: "openai", handle: CredentialHandleSchema.parse("cred_123456789012") } as const;
const context: AdapterContext = { credential, requestId: "eikon_request_123" };

function broker(onUse?: () => void): ServerCredentialBroker {
  return {
    async withCredential(reference, use) {
      expect(reference).toEqual(credential);
      onUse?.();
      return use(secret);
    },
  };
}

function request(inputOverrides: Record<string, unknown> = {}) {
  return GenerationRequestSchema.parse({
    modelId: OPENAI_IMAGE_MODEL_ID,
    task: "text-to-image",
    operation: "generate",
    schemaRevision: OPENAI_IMAGE_SCHEMA_REVISION,
    input: { prompt: "Draw a copper fox", inputAssets: [], outputCount: 1, ...inputOverrides },
  });
}

async function inputFor(adapter: OpenAIImageAdapter): Promise<NormalizedProviderInput> {
  return adapter.normalizeInput(request(), OPENAI_IMAGE_CAPABILITY);
}

function oneShotFetch(response: Response, inspect?: (url: string, init: RequestInit) => void): { fetch: typeof fetch; calls: () => number } {
  let calls = 0;
  const injected = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    if (calls !== 1) throw new Error("Unexpected second network call");
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== "https://api.openai.com/v1/images/generations") throw new Error(`Unexpected URL: ${url}`);
    inspect?.(url, init ?? {});
    return response;
  }) as unknown as typeof fetch;
  return { fetch: injected, calls: () => calls };
}

function successResponse(base64 = Buffer.from([0, 1, 2, 255]).toString("base64"), requestId = "req_native_123") {
  return new Response(JSON.stringify({ created: 1, data: [{ b64_json: base64 }] }), {
    status: 200,
    headers: { "content-type": "application/json", "x-request-id": requestId },
  });
}

function apiError(status: number, code?: string, message = `hostile ${secret} https://private.test prompt text`) {
  return new Response(JSON.stringify({ error: { message, type: "hostile_type", code } }), {
    status,
    headers: { "content-type": "application/json", "x-secret-header": secret },
  });
}

describe("OpenAIImageAdapter", () => {
  it("preserves the durable worker's 240-second timeout boundary", () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;
    expect(() => new OpenAIImageAdapter({ credentialBroker: broker(), fetch, timeoutMs: 240_000 })).not.toThrow();
    expect(() => new OpenAIImageAdapter({ credentialBroker: broker(), fetch, timeoutMs: 240_001 })).toThrow(
      "OpenAI timeout must be between 1 and 240000 milliseconds.",
    );
  });

  it("sends one exact base64-only request and returns native identity and exact bytes", async () => {
    const transport = oneShotFetch(successResponse(), (_url, init) => {
      expect(init.method).toBe("POST");
      const headers = new Headers(init.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${secret}`);
      expect(headers.get("content-type")).toBe("application/json");
      const secretHeaders: [string, string][] = [];
      headers.forEach((value, name) => {
        if (value.includes(secret)) secretHeaders.push([name, value]);
      });
      expect(secretHeaders).toEqual([["authorization", `Bearer ${secret}`]]);
      expect(JSON.parse(String(init.body))).toEqual({ model: "gpt-image-2", prompt: "Draw a copper fox", n: 1, output_format: "png", stream: false, size: "auto", quality: "medium" });
      expect(String(init.body)).not.toContain(secret);
    });
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch, now: () => "2026-09-01T00:00:00.000Z" });
    const normalized = await inputFor(adapter);
    expect(JSON.stringify({ normalized, context })).not.toContain(secret);

    const result = await adapter.submitGeneration(normalized, context);

    expect(transport.calls()).toBe(1);
    expect(result).toMatchObject({ delivery: "synchronous", providerRequestId: "req_native_123", status: "completed" });
    if (result.delivery === "synchronous") {
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0]?.contentType).toBe("image/png");
      expect(result.outputs[0]?.bytes).toEqual(new Uint8Array([0, 1, 2, 255]));
    }
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it.each([
    ["1K square", "1:1", "1K", "1024x1024", "auto"],
    ["1K default", undefined, "1K", "1024x1024", "auto"],
    ["1K portrait", "9:16", "1K", "1024x1536", "auto"],
    ["1K landscape", "16:9", "1K", "1536x1024", "auto"],
    ["1K wide", "21:9", "1K", "1536x1024", "auto"],
    ["2K square", "1:1", "2K", "auto", "medium"],
    ["2K portrait", "9:16", "2K", "auto", "medium"],
    ["4K wide", "21:9", "4K", "auto", "high"],
    ["unknown resolution", "16:9", "8K", "auto", "medium"],
  ])("maps %s to exact normalized and SDK settings", async (_name, aspectRatio, resolution, size, quality) => {
    const transport = oneShotFetch(successResponse(), (_url, init) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ size, quality });
    });
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch });
    const normalized = await adapter.normalizeInput(request({ aspectRatio, resolution }), OPENAI_IMAGE_CAPABILITY);
    expect(normalized.native.values).toEqual({ prompt: "Draw a copper fox", outputCount: 1, size, quality });
    await adapter.submitGeneration(normalized, context);
  });

  it.each([
    ["missing request ID", successResponse(undefined, "")],
    ["missing data", new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_1" } })],
    ["multiple outputs", new Response(JSON.stringify({ data: [{ b64_json: "AA==" }, { b64_json: "AQ==" }] }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_1" } })],
    ["malformed JSON", new Response("not-json", { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_1" } })],
    ["malformed base64", successResponse("%%%")],
    ["empty base64", successResponse("")],
    ["URL output", new Response(JSON.stringify({ data: [{ url: "https://private.test/image" }] }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_1" } })],
  ])("rejects a %s response", async (_name, response) => {
    const transport = oneShotFetch(response);
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch });
    await expect(adapter.submitGeneration(await inputFor(adapter), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(transport.calls()).toBe(1);
  });

  it("decodes a multi-megabyte valid image without recursive regex overflow", async () => {
    const bytes = Buffer.alloc(3_000_000, 37);
    const transport = oneShotFetch(successResponse(bytes.toString("base64")));
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch });
    const result = await adapter.submitGeneration(await inputFor(adapter), context);
    expect(result.delivery === "synchronous" && result.outputs[0]?.bytes.byteLength).toBe(bytes.byteLength);
  });

  it("rejects oversized output before decoding it", async () => {
    const oversized = "AAAA".repeat(Math.ceil(OPENAI_IMAGE_MAX_OUTPUT_BYTES / 3) + 1);
    const transport = oneShotFetch(successResponse(oversized));
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch });
    await expect(adapter.submitGeneration(await inputFor(adapter), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
  });

  it("rejects an oversized Content-Length without reading the body or retrying", async () => {
    let reads = 0;
    let cancellations = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          reads += 1;
          throw new Error("body must remain unread");
        },
        cancel() {
          cancellations += 1;
        },
      },
      { highWaterMark: 0 },
    );
    const transport = oneShotFetch(
      new Response(body, { status: 200, headers: { "content-type": "application/json", "content-length": String(maxResponseBodyBytes + 1) } }),
    );
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch });

    await expect(adapter.submitGeneration(await inputFor(adapter), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(reads).toBe(0);
    expect(cancellations).toBe(1);
    expect(transport.calls()).toBe(1);
  });

  it("stops and cancels a chunked response once its body exceeds the limit", async () => {
    let reads = 0;
    let cancellations = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads += 1;
          controller.enqueue(new Uint8Array(reads === 1 ? maxResponseBodyBytes : 1));
        },
        cancel() {
          cancellations += 1;
        },
      },
      { highWaterMark: 0 },
    );
    const transport = oneShotFetch(new Response(body, { status: 200, headers: { "content-type": "application/json" } }));
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch });

    await expect(adapter.submitGeneration(await inputFor(adapter), context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(reads).toBe(2);
    expect(cancellations).toBe(1);
    expect(transport.calls()).toBe(1);
  });

  it.each([
    [400, undefined, "validation", "provider_validation_error", false],
    [401, undefined, "authentication", "provider_authentication_error", false],
    [403, undefined, "billing-access", "provider_access_denied", false],
    [422, undefined, "validation", "provider_validation_error", false],
    [429, undefined, "rate-limit", "provider_rate_limit", true],
    [500, undefined, "provider-unavailable", "provider_unavailable", true],
    [503, undefined, "provider-unavailable", "provider_unavailable", true],
    [400, "content_policy_violation", "moderation", "content_policy_violation", false],
  ] as const)("normalizes HTTP %s without provider text", async (status, nativeCode, category, code, retryable) => {
    const transport = oneShotFetch(apiError(status, nativeCode));
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch, now: () => "2026-09-01T00:00:00.000Z" });
    let caught: unknown;
    try {
      await adapter.submitGeneration(await inputFor(adapter), context);
    } catch (error) {
      caught = error;
    }
    const normalized = adapter.normalizeError(caught, "corr_http_123456");
    expect(NormalizedErrorResultSchema.safeParse(normalized).success).toBe(true);
    expect(normalized.publicError).toMatchObject({ category, code, retryable });
    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("private.test");
    expect(serialized).not.toContain("prompt text");
    expect(serialized).not.toContain("hostile_type");
    expect(serialized).not.toContain("stack");
    expect(transport.calls()).toBe(1);
  });

  it("maps a network failure and never retries", async () => {
    let calls = 0;
    const failingFetch = vi.fn(async () => {
      calls += 1;
      throw new TypeError(`network ${secret}`);
    }) as unknown as typeof fetch;
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: failingFetch });
    let caught: unknown;
    try {
      await adapter.submitGeneration(await inputFor(adapter), context);
    } catch (error) {
      caught = error;
    }
    expect(adapter.normalizeError(caught, "corr_network_123").publicError).toMatchObject({ category: "provider-unavailable", retryable: true });
    expect(calls).toBe(1);
  });

  it.each([
    ["timeout", "TimeoutError", "timeout", true],
    ["abort", "AbortError", "cancelled", false],
  ] as const)("maps %s and honors the request signal", async (_name, errorName, category, retryable) => {
    let resolutions = 0;
    let receivedSignal: AbortSignal | null | undefined;
    const failingFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal;
      const error = new Error("hostile transport text");
      error.name = errorName;
      throw error;
    }) as unknown as typeof fetch;
    const controller = new AbortController();
    if (errorName === "AbortError") controller.abort();
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(() => resolutions++), fetch: failingFetch, timeoutMs: 10 });
    let caught: unknown;
    try {
      await adapter.submitGeneration(await inputFor(adapter), { ...context, signal: controller.signal });
    } catch (error) {
      caught = error;
    }
    if (errorName === "AbortError") {
      expect(receivedSignal).toBeUndefined();
      expect(failingFetch).not.toHaveBeenCalled();
      expect(resolutions).toBe(0);
    } else {
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(failingFetch).toHaveBeenCalledTimes(1);
    }
    expect(adapter.normalizeError(caught, "corr_signal_1234").publicError).toMatchObject({ category, retryable });
  });

  it("rejects a malformed credential handle before broker resolution or network", async () => {
    let resolutions = 0;
    const transport = oneShotFetch(successResponse());
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(() => resolutions++), fetch: transport.fetch });
    const malformedContext = { ...context, credential: { providerId: "openai", handle: "bad" } } as unknown as AdapterContext;

    await expect(adapter.submitGeneration(await inputFor(adapter), malformedContext)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(resolutions).toBe(0);
    expect(transport.calls()).toBe(0);
  });

  it.each([
    ["model", { modelId: "openai/gpt-image/gpt-image-1" }],
    ["task", { task: "image-to-image" }],
    ["operation", { operation: "edit" }],
    ["schema", { schemaRevision: "wrong_schema" }],
  ])("rejects unsupported %s before credential resolution or network", async (_name, override) => {
    let resolutions = 0;
    const transport = oneShotFetch(successResponse());
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(() => resolutions++), fetch: transport.fetch });
    const invalid = { ...(await inputFor(adapter)), ...override } as NormalizedProviderInput;
    await expect(adapter.submitGeneration(invalid, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(resolutions).toBe(0);
    expect(transport.calls()).toBe(0);
  });

  it("rejects count and native shape before credential resolution", async () => {
    let resolutions = 0;
    const transport = oneShotFetch(successResponse());
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(() => resolutions++), fetch: transport.fetch });
    const invalid = { ...(await inputFor(adapter)), native: { namespace: "provider:openai", providerId: "openai", values: { prompt: "x", outputCount: 2 } } } as NormalizedProviderInput;
    await expect(adapter.submitGeneration(invalid, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(resolutions).toBe(0);
    expect(transport.calls()).toBe(0);
  });

  it("fails every unsupported boundary method locally", async () => {
    const transport = oneShotFetch(successResponse());
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(), fetch: transport.fetch });
    const calls = [
      adapter.validateCredentials(credential),
      adapter.estimateCost(await inputFor(adapter), context),
      adapter.getGenerationStatus("req_1", context),
      adapter.cancelGeneration("req_1", context),
      adapter.normalizeOutput({ providerRequestId: "req_1", status: "completed" }, context),
      adapter.verifyWebhook({} as never),
    ];
    for (const call of calls) await expect(call).rejects.toBeInstanceOf(ProviderOperationUnsupportedError);
    expect(transport.calls()).toBe(0);
  });
});

// These tests inspect the actual SDK multipart body, including ordered bytes.
describe("OpenAI image editing", () => {
  const references = [0, 1].map(index => ({ mediaType: "image", contentType: "image/png", reference: { kind: "eikon-storage", storageId: `storage_${index}`, ownerId: "owner", assetId: `asset_reference00000${index}` } }));
  it.each([1, 2, 4])("prepares %s ordered images before credentials and sends one multipart edit", async count => {
    const { OPENAI_IMAGE_EDIT_CAPABILITY: capability } = await import("../src/index.js");
    const events: string[] = [];
    const imageResolver = vi.fn(async asset => { events.push("reference"); return { bytes: new Uint8Array([Number(asset.reference.storageId.split("_")[1])]), contentType: "image/png" }; });
    const fetch = vi.fn(async (url, init) => {
      events.push("transport");
      expect(url).toBe("https://api.openai.com/v1/images/edits");
      const body = init?.body as FormData;
      expect(body.get("model")).toBe("gpt-image-2");
      expect(body.get("n")).toBe("1");
      expect(body.get("output_format")).toBe("png");
      expect(body.get("size")).toBe("auto");
      expect(body.get("quality")).toBe("high");
      expect(body.get("stream")).toBe("false");
      const files = body.getAll(count === 1 ? "image" : "image[]") as File[];
      expect(files).toHaveLength(count);
      for (const [index, file] of files.entries()) {
        expect(file.name).toBe(`ref-${index}.png`);
        expect(file.type).toBe("image/png");
        expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([index % 2]));
      }
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${secret}`);
      return successResponse();
    });
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(() => events.push("credential")), imageResolver, fetch });
    const edit = GenerationRequestSchema.parse({ ...request({ resolution: "4K", inputAssets: Array.from({ length: count }, (_, i) => references[i % 2]) }), task: "image-to-image", operation: "edit", schemaRevision: capability.schemaRevision });
    const normalized = await adapter.normalizeInput(edit, capability);
    const result = await adapter.submitGeneration(normalized, context);
    expect(result).toMatchObject({ delivery: "synchronous", status: "completed" });
    expect(events).toEqual([...Array(count).fill("reference"), "credential", "transport"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["missing", "remote", "oversized", "mime", "count"])("rejects %s references without credentials or dispatch", async reason => {
    const { OPENAI_IMAGE_EDIT_CAPABILITY: capability } = await import("../src/index.js");
    let resolutions = 0;
    const fetch = vi.fn();
    const imageResolver = reason === "missing" ? undefined : vi.fn(async () => ({ bytes: new Uint8Array(reason === "oversized" ? 25_000_001 : 1), contentType: reason === "mime" ? "image/jpeg" : "image/png" }));
    const adapter = new OpenAIImageAdapter({ credentialBroker: broker(() => resolutions++), fetch, ...(imageResolver ? { imageResolver } : {}) });
    const edit = GenerationRequestSchema.parse({ ...request({ inputAssets: [references[0]] }), task: "image-to-image", operation: "edit", schemaRevision: capability.schemaRevision });
    const input = await adapter.normalizeInput(edit, capability);
    if (reason === "remote") input.native.values.references = [{ ...references[0], reference: { kind: "remote-untrusted", url: "https://untrusted.test/image", validationStatus: "pending" } }];
    if (reason === "count") input.native.values.references = Array(5).fill(references[0]);
    await expect(adapter.submitGeneration(input, context)).rejects.toBeInstanceOf(ProviderInputValidationError);
    expect(resolutions).toBe(0); expect(fetch).not.toHaveBeenCalled();
  });
});
