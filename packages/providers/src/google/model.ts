import { EXECUTABLE_IMAGE_MODELS, ModelOperationCapabilitySchema, ModelVariantSchema, SchemaRevisionIdSchema } from "@eikonstudio/core";

export const GOOGLE_IMAGE_NATIVE_MODELS = ["gemini-3.1-flash-image", "gemini-3-pro-image"] as const;
export const GOOGLE_IMAGE_MAX_OUTPUT_BYTES = 15_000_000; // Preserve the prior 20 MB base64 ceiling.
export const GOOGLE_IMAGE_SCHEMA_REVISION = SchemaRevisionIdSchema.parse("schema_google_gemini_image_text_v1");
export const GOOGLE_IMAGE_EDIT_SCHEMA_REVISION = SchemaRevisionIdSchema.parse("schema_google_gemini_image_edit_v1");
export const GOOGLE_IMAGE_CAPABILITY = ModelOperationCapabilitySchema.parse({
  schemaRevision: GOOGLE_IMAGE_SCHEMA_REVISION,
  operation: "generate",
  task: "text-to-image",
  inputRoles: [{ role: "prompt", modality: "text", required: true, minCount: 1, maxCount: 1 }],
  outputMedia: "image",
  limits: { maxReferences: 0, maxOutputCount: 1, maxInputBytes: 400_000, maxOutputBytes: GOOGLE_IMAGE_MAX_OUTPUT_BYTES },
  execution: { mode: "synchronous", webhook: "unsupported", polling: "unsupported", cancellation: "unsupported" },
  inputSchema: {
    revision: GOOGLE_IMAGE_SCHEMA_REVISION,
    parameters: [{ name: "prompt", required: true, schema: { type: "string", minLength: 1, maxLength: 100_000 } }],
  },
});
export const GOOGLE_IMAGE_EDIT_CAPABILITY = ModelOperationCapabilitySchema.parse({
  ...GOOGLE_IMAGE_CAPABILITY,
  schemaRevision: GOOGLE_IMAGE_EDIT_SCHEMA_REVISION,
  operation: "edit",
  task: "image-to-image",
  inputRoles: [...GOOGLE_IMAGE_CAPABILITY.inputRoles, { role: "reference", modality: "image", required: true, minCount: 1, maxCount: 4 }],
  limits: { ...GOOGLE_IMAGE_CAPABILITY.limits, maxReferences: 4, maxInputBytes: 100_400_000 },
  inputSchema: { ...GOOGLE_IMAGE_CAPABILITY.inputSchema, revision: GOOGLE_IMAGE_EDIT_SCHEMA_REVISION },
});
export const GOOGLE_IMAGE_MODELS = GOOGLE_IMAGE_NATIVE_MODELS.map((modelId) => {
  const catalog = EXECUTABLE_IMAGE_MODELS.find((model) => model.providerId === "google" && model.nativeId === modelId);
  if (!catalog) throw new Error("Google image adapter requires an existing executable catalog entry.");
  return ModelVariantSchema.parse({
    id: catalog.id,
    familyId: "nano-banana",
    providerId: "google",
    providerNative: { modelId, endpoint: `/v1beta/models/${modelId}:generateContent`, capturedAt: "2026-09-06T00:00:00.000Z" },
    displayName: catalog.displayName,
    readiness: "ready",
    mediaTypes: ["image"],
    capabilities: [GOOGLE_IMAGE_CAPABILITY, GOOGLE_IMAGE_EDIT_CAPABILITY],
    preview: false,
    discoveredAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
  });
});
