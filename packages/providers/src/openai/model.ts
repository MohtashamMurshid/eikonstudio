import { ModelOperationCapabilitySchema, ModelVariantSchema, SchemaRevisionIdSchema, type ModelVariant } from "@eikonstudio/core";

export const OPENAI_IMAGE_MODEL_ID = "openai/gpt-image/gpt-image-2" as const;
export const OPENAI_IMAGE_NATIVE_MODEL_ID = "gpt-image-2" as const;
export const OPENAI_IMAGE_SCHEMA_REVISION = SchemaRevisionIdSchema.parse("schema_openai_gpt_image_2_text_v1");
export const OPENAI_IMAGE_MAX_OUTPUT_BYTES = 25_000_000;
export const OPENAI_IMAGE_SIZES = ["auto", "1024x1024", "1536x1024", "1024x1536"] as const;
export const OPENAI_IMAGE_QUALITIES = ["auto", "medium", "high"] as const;

export const OPENAI_IMAGE_CAPABILITY = ModelOperationCapabilitySchema.parse({
  schemaRevision: OPENAI_IMAGE_SCHEMA_REVISION,
  operation: "generate",
  task: "text-to-image",
  inputRoles: [{ role: "prompt", modality: "text", required: true, minCount: 1, maxCount: 1 }],
  outputMedia: "image",
  limits: { maxReferences: 0, maxOutputCount: 1, maxInputBytes: 128_000, maxOutputBytes: OPENAI_IMAGE_MAX_OUTPUT_BYTES },
  execution: { mode: "synchronous", webhook: "unsupported", polling: "unsupported", cancellation: "unsupported" },
  inputSchema: {
    revision: OPENAI_IMAGE_SCHEMA_REVISION,
    parameters: [{ name: "prompt", required: true, schema: { type: "string", minLength: 1, maxLength: 32_000 } }],
  },
});

export const OPENAI_IMAGE_MODEL: ModelVariant = ModelVariantSchema.parse({
  id: OPENAI_IMAGE_MODEL_ID,
  familyId: "gpt-image",
  providerId: "openai",
  providerNative: { modelId: OPENAI_IMAGE_NATIVE_MODEL_ID, endpoint: "/v1/images/generations", capturedAt: "2026-09-01T00:00:00.000Z" },
  displayName: "GPT Image 2",
  readiness: "ready",
  mediaTypes: ["image"],
  capabilities: [OPENAI_IMAGE_CAPABILITY],
  preview: false,
  discoveredAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
});
