import { getCatalogModel, ModelOperationCapabilitySchema, ModelVariantSchema, SchemaRevisionIdSchema } from "@eikonstudio/core";

export const GOOGLE_VEO_NATIVE_MODEL = "veo-3.1-generate-preview";
export const GOOGLE_VEO_TEXT_REVISION = SchemaRevisionIdSchema.parse("schema_google_veo_text_v1");
export const GOOGLE_VEO_IMAGE_REVISION = SchemaRevisionIdSchema.parse("schema_google_veo_frames_v1");
export const GOOGLE_VEO_MAX_STATUS_BYTES = 1_048_576;

const parameters = [
  { name: "negativePrompt", required: false, schema: { type: "string", maxLength: 100_000 } },
  { name: "prompt", required: true, schema: { type: "string", minLength: 1, maxLength: 100_000 } },
  { name: "aspectRatio", required: false, schema: { enum: ["16:9", "9:16"], default: "16:9" } },
  { name: "resolution", required: false, schema: { enum: ["720p", "1080p"], default: "720p" } },
  { name: "durationSeconds", required: false, schema: { enum: [4, 6, 8], default: 8 } },
  { name: "audio", required: false, schema: { const: true } },
];
export const GOOGLE_VEO_TEXT_CAPABILITY = ModelOperationCapabilitySchema.parse({
  schemaRevision: GOOGLE_VEO_TEXT_REVISION,
  operation: "generate", task: "text-to-video", outputMedia: "video",
  inputRoles: [{ role: "prompt", modality: "text", required: true, minCount: 1, maxCount: 1 }],
  limits: { maxReferences: 0, maxOutputCount: 1, maxDurationSeconds: 8, maxInputBytes: 800_000, maxOutputBytes: 250_000_000 },
  execution: { mode: "asynchronous", polling: "required", webhook: "unsupported", cancellation: "unsupported" },
  inputSchema: { revision: GOOGLE_VEO_TEXT_REVISION, parameters },
});
/** Ordered inputs: starting frame, followed by an optional ending frame. */
export const GOOGLE_VEO_IMAGE_CAPABILITY = ModelOperationCapabilitySchema.parse({
  ...GOOGLE_VEO_TEXT_CAPABILITY,
  schemaRevision: GOOGLE_VEO_IMAGE_REVISION, task: "image-to-video",
  inputRoles: [...GOOGLE_VEO_TEXT_CAPABILITY.inputRoles, { role: "source", modality: "image", required: true, minCount: 1, maxCount: 2 }],
  limits: { ...GOOGLE_VEO_TEXT_CAPABILITY.limits, maxReferences: 2, maxInputBytes: 50_800_000 },
  inputSchema: { revision: GOOGLE_VEO_IMAGE_REVISION, parameters: parameters.map(parameter => parameter.name === "durationSeconds" ? { ...parameter, schema: { ...parameter.schema, description: "Two input frames require an eight-second video." } } : parameter) },
});
const catalog = getCatalogModel("google/veo/veo-3-1-generate-preview");
if (!catalog || catalog.nativeId !== GOOGLE_VEO_NATIVE_MODEL) throw new Error("Veo requires its canonical Gemini API catalog entry.");
/** Adapter capability only. Public catalog readiness stays discovered until durable integration. */
export const GOOGLE_VEO_MODEL = ModelVariantSchema.parse({
  id: catalog.id, providerId: "google", familyId: "veo", displayName: catalog.displayName,
  providerNative: { modelId: GOOGLE_VEO_NATIVE_MODEL, endpoint: `/v1beta/models/${GOOGLE_VEO_NATIVE_MODEL}:predictLongRunning`, capturedAt: "2026-09-06T00:00:00.000Z" },
  readiness: "ready", preview: true, mediaTypes: ["video"],
  capabilities: [GOOGLE_VEO_TEXT_CAPABILITY, GOOGLE_VEO_IMAGE_CAPABILITY],
  discoveredAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:00:00.000Z",
});
