"use node";

import { GenerationRequestSchema, type NormalizedErrorResult } from "@eikonstudio/core";
import { randomUUID } from "node:crypto";
import {
  OPENAI_IMAGE_CAPABILITY,
  OPENAI_IMAGE_MODEL_ID,
  OPENAI_IMAGE_SCHEMA_REVISION,
  OpenAIImageAdapter,
  type ProviderCredentialReference,
  type ServerCredentialBroker,
} from "@eikonstudio/providers";

export type DurableOpenAIImageResult = {
  imageBuffer: Buffer;
  mimeType: "image/png";
  completedModel: "gpt-image-2";
  providerRequestId: string;
};

export class DurableOpenAITextToImageError extends Error {
  constructor(
    readonly transportEntered: boolean,
    readonly httpStatus: number | undefined,
    readonly normalized: NormalizedErrorResult,
  ) {
    super("Durable OpenAI text-to-image execution failed.");
    this.name = "DurableOpenAITextToImageError";
  }
}

type ExecuteArgs = {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  credential: ProviderCredentialReference;
  fetch: typeof fetch;
  withCredential: ServerCredentialBroker["withCredential"];
};

export async function generateDurableOpenAITextToImage(args: ExecuteArgs): Promise<DurableOpenAIImageResult> {
  let transportEntered = false;
  const adapter = new OpenAIImageAdapter({
    credentialBroker: { withCredential: args.withCredential },
    fetch: async (input, init) => {
      transportEntered = true;
      return await args.fetch(input, init);
    },
  });

  try {
    const request = GenerationRequestSchema.parse({
      modelId: OPENAI_IMAGE_MODEL_ID,
      task: "text-to-image",
      operation: "generate",
      schemaRevision: OPENAI_IMAGE_SCHEMA_REVISION,
      input: {
        prompt: args.prompt,
        inputAssets: [],
        outputCount: 1,
        aspectRatio: studioAspectRatio(args.aspectRatio),
        resolution: args.resolution,
      },
    });
    const input = await adapter.normalizeInput(request, OPENAI_IMAGE_CAPABILITY);
    const result = await adapter.submitGeneration(input, {
      credential: args.credential,
      requestId: randomUUID(),
    });
    if (result.delivery !== "synchronous" || result.status !== "completed" || result.outputs.length !== 1) {
      throw new TypeError("OpenAI returned an unsupported delivery result.");
    }
    const output = result.outputs[0];
    if (output?.mediaType !== "image" || output.contentType !== "image/png") {
      throw new TypeError("OpenAI returned an unsupported image result.");
    }
    return {
      imageBuffer: Buffer.from(output.bytes),
      mimeType: "image/png",
      completedModel: "gpt-image-2",
      providerRequestId: result.providerRequestId,
    };
  } catch (cause) {
    if (cause instanceof DurableOpenAITextToImageError) throw cause;
    const correlationId = `corr_${randomUUID()}`;
    throw new DurableOpenAITextToImageError(transportEntered, errorStatus(cause), adapter.normalizeError(cause, correlationId));
  }
}

export function studioAspectRatio(value: string): string {
  if (value === "portrait") return "9:16";
  if (value === "landscape") return "16:9";
  if (value === "wide") return "21:9";
  return "1:1";
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}
