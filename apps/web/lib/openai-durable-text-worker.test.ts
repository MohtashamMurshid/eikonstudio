import { afterEach, describe, expect, it, vi } from "vitest";

import { CredentialHandleSchema } from "@eikonstudio/core";
import {
  DurableOpenAITextToImageError,
  generateDurableOpenAITextToImage,
} from "../convex/openAiDurableTextToImage";

const originalFetch = globalThis.fetch;
const credential = {
  providerId: "openai" as const,
  handle: CredentialHandleSchema.parse("cred_123456789012"),
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("durable OpenAI text-to-image helper", () => {
  it("preflights, resolves inside the callback, begins submission, and uses only injected fetch", async () => {
    const events: string[] = [];
    globalThis.fetch = vi.fn(async () => {
      throw new Error("global fetch must not be used");
    }) as typeof fetch;
    let calls = 0;
    const injectedFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      events.push("transport");
      expect(calls).toBe(1);
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "gpt-image-2",
        prompt: "Draw a lighthouse",
        size: "1024x1536",
        quality: "auto",
      });
      return new Response(JSON.stringify({ data: [{ b64_json: "AAE=" }] }), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "req_durable_1" },
      });
    }) as typeof fetch;

    const result = await generateDurableOpenAITextToImage({
      prompt: "Draw a lighthouse",
      aspectRatio: "portrait",
      resolution: "1K",
      credential,
      fetch: injectedFetch,
      withCredential: async (reference, operation) => {
        events.push("credential");
        expect(reference).toEqual(credential);
        events.push("beginSubmission");
        return await operation("sk-local-only");
      },
    });

    expect(events).toEqual(["credential", "beginSubmission", "transport"]);
    expect(result).toEqual({
      imageBuffer: Buffer.from([0, 1]),
      mimeType: "image/png",
      completedModel: "gpt-image-2",
      providerRequestId: "req_durable_1",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("sk-local-only");
  });

  it("fails adapter preflight before credential resolution or transport", async () => {
    const withCredential = vi.fn();
    const injectedFetch = vi.fn() as unknown as typeof fetch;
    await expect(generateDurableOpenAITextToImage({
      prompt: "",
      aspectRatio: "square",
      resolution: "1K",
      credential,
      fetch: injectedFetch,
      withCredential,
    })).rejects.toMatchObject({ transportEntered: false });
    expect(withCredential).not.toHaveBeenCalled();
    expect(injectedFetch).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 408, 409, 422, 429, 500])("tracks HTTP %s as transport-entered", async (status) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "hostile-provider-message" } }), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof globalThis.fetch;
    let caught: unknown;
    try {
      await generateDurableOpenAITextToImage({
        prompt: "x",
        aspectRatio: "square",
        resolution: "2K",
        credential,
        fetch,
        withCredential: async (_reference, operation) => await operation("sk-secret"),
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DurableOpenAITextToImageError);
    expect(caught).toMatchObject({ transportEntered: true, httpStatus: status });
    expect(JSON.stringify(caught)).not.toContain("hostile-provider-message");
    expect(JSON.stringify(caught)).not.toContain("sk-secret");
  });
});
