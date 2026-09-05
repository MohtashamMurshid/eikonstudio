"use node";

import { GenerationRequestSchema, type NormalizedErrorResult } from "@eikonstudio/core";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import {
  OPENAI_IMAGE_CAPABILITY,
  OPENAI_IMAGE_MODEL_ID,
  OPENAI_IMAGE_SCHEMA_REVISION,
  OPENAI_IMAGE_EDIT_CAPABILITY,
  OPENAI_IMAGE_EDIT_SCHEMA_REVISION,
  GOOGLE_IMAGE_CAPABILITY,
  GOOGLE_IMAGE_EDIT_CAPABILITY,
  GOOGLE_IMAGE_SCHEMA_REVISION,
  GOOGLE_IMAGE_EDIT_SCHEMA_REVISION,
  GOOGLE_IMAGE_MODELS,
  GoogleImageAdapter,
  IMAGE_MAX_REFERENCE_BYTES,
  ProviderInputValidationError,
  OpenAIImageAdapter,
  type ProviderCredentialReference,
  type ServerCredentialBroker,
} from "@eikonstudio/providers";

export type DurableImageResult = {
  imageBuffer: Buffer;
  mimeType: string;
  completedModel: string;
  providerRequestId: string;
};

export class DurableImageProviderError extends Error {
  constructor(
    readonly transportEntered: boolean,
    readonly httpStatus: number | undefined,
    readonly normalized: NormalizedErrorResult,
  ) {
    super("Durable image provider execution failed.");
    this.name = "DurableImageProviderError";
  }
}

type ExecuteArgs = {
  model: string;
  mode: "text-to-image" | "image-editing";
  ownerId: string;
  referenceStorageIds: string[];
  readImage: (storageId: string) => Promise<Blob | null>;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  credential: ProviderCredentialReference;
  fetch: typeof fetch;
  withCredential: ServerCredentialBroker["withCredential"];
};

export async function generateDurableImage(args: ExecuteArgs): Promise<DurableImageResult> {
  let transportEntered = false;
  const editing = args.mode === "image-editing";
  const google = args.credential.providerId === "google";
  const googleModel = GOOGLE_IMAGE_MODELS.find((model) => model.providerNative.modelId === args.model);
  const blobs = new Map<string, Blob>();
  const Adapter = google ? GoogleImageAdapter : OpenAIImageAdapter;
  const adapter = new Adapter({
    imageResolver: async (asset) => {
      const reference = asset.reference;
      const blob = blobs.get(reference.storageId);
      if (reference.ownerId !== args.ownerId || !blob) throw new ProviderInputValidationError();
      return { contentType: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) };
    },
    credentialBroker: { withCredential: args.withCredential },
    fetch: async (input, init) => {
      transportEntered = true;
      return await args.fetch(input, init);
    },
  });

  try {
    if (
      (google ? !googleModel : args.credential.providerId !== "openai" || args.model !== "gpt-image-2") ||
      args.referenceStorageIds.length > 4 ||
      (editing && args.referenceStorageIds.length === 0)
    )
      throw new ProviderInputValidationError();
    const inputAssets = [];
    if (editing) {
      for (const storageId of args.referenceStorageIds) {
        const blob = await args.readImage(storageId);
        if (!blob || blob.size < 1 || blob.size > IMAGE_MAX_REFERENCE_BYTES) throw new ProviderInputValidationError();
        blobs.set(storageId, blob);
        inputAssets.push({
          mediaType: "image",
          contentType: blob.type,
          reference: {
            kind: "eikon-storage",
            ownerId: args.ownerId,
            storageId,
            assetId: `asset_${createHash("sha256").update(`${args.ownerId}:${storageId}`).digest("hex").slice(0, 32)}`,
          },
        });
      }
    }
    const capability = google
      ? editing
        ? GOOGLE_IMAGE_EDIT_CAPABILITY
        : GOOGLE_IMAGE_CAPABILITY
      : editing
        ? OPENAI_IMAGE_EDIT_CAPABILITY
        : OPENAI_IMAGE_CAPABILITY;
    const schemaRevision = google
      ? editing
        ? GOOGLE_IMAGE_EDIT_SCHEMA_REVISION
        : GOOGLE_IMAGE_SCHEMA_REVISION
      : editing
        ? OPENAI_IMAGE_EDIT_SCHEMA_REVISION
        : OPENAI_IMAGE_SCHEMA_REVISION;
    const request = GenerationRequestSchema.parse({
      modelId: google ? googleModel!.id : OPENAI_IMAGE_MODEL_ID,
      task: editing ? "image-to-image" : "text-to-image",
      operation: editing ? "edit" : "generate",
      schemaRevision,
      input: {
        prompt: args.prompt,
        inputAssets,
        outputCount: 1,
        aspectRatio: studioAspectRatio(args.aspectRatio),
        resolution: args.resolution,
      },
    });
    const input = await adapter.normalizeInput(request, capability);
    const result = await adapter.submitGeneration(input, {
      credential: args.credential,
      requestId: randomUUID(),
    });
    if (result.delivery !== "synchronous" || result.status !== "completed" || result.outputs.length !== 1) {
      throw new TypeError("The provider returned an unsupported delivery result.");
    }
    const output = result.outputs[0];
    if (output?.mediaType !== "image" || !["image/png", "image/jpeg", "image/webp"].includes(output.contentType)) {
      throw new TypeError("The provider returned an unsupported image result.");
    }
    return {
      imageBuffer: Buffer.from(output.bytes),
      mimeType: output.contentType,
      completedModel: args.model,
      providerRequestId: result.providerRequestId,
    };
  } catch (cause) {
    if (cause instanceof DurableImageProviderError) throw cause;
    const correlationId = `corr_${randomUUID()}`;
    throw new DurableImageProviderError(transportEntered, errorStatus(cause), adapter.normalizeError(cause, correlationId));
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
