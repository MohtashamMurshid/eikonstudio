import { z } from "zod";

import {
  InputModalitySchema,
  MediaTypeSchema,
  ModelFamilyIdSchema,
  ModelReadinessSchema,
  OperationTypeSchema,
  ProviderIdSchema,
  TaskTypeSchema,
  type ModelFamilyId,
  type ProviderId,
} from "./vocabulary.js";

const boundedText = (max: number) => z.string().min(1).max(max).regex(/\S/, "Must contain a non-whitespace character");

export const FAMILY_PROVIDER: Readonly<Record<ModelFamilyId, ProviderId>> = {
  "gpt-image": "openai",
  sora: "openai",
  "nano-banana": "google",
  veo: "google",
  "gemini-omni": "google",
  flux: "bfl",
  seedream: "byteplus",
  seedance: "byteplus",
  kling: "kling",
  "grok-imagine": "xai",
};

export const ModelFamilySchema = z
  .object({
    id: ModelFamilyIdSchema,
    providerId: ProviderIdSchema,
    displayName: boundedText(120),
    mediaTypes: z.array(MediaTypeSchema).min(1).max(2),
  })
  .strict()
  .superRefine((family, context) => {
    if (FAMILY_PROVIDER[family.id] !== family.providerId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Family ${family.id} belongs to provider ${FAMILY_PROVIDER[family.id]}`, path: ["providerId"] });
    }
  });
export type ModelFamily = z.infer<typeof ModelFamilySchema>;

export const MODEL_FAMILIES = [
  { id: "gpt-image", providerId: "openai", displayName: "GPT Image", mediaTypes: ["image"] },
  { id: "sora", providerId: "openai", displayName: "Sora", mediaTypes: ["video"] },
  { id: "nano-banana", providerId: "google", displayName: "Nano Banana", mediaTypes: ["image"] },
  { id: "veo", providerId: "google", displayName: "Veo", mediaTypes: ["video"] },
  { id: "gemini-omni", providerId: "google", displayName: "Gemini Omni", mediaTypes: ["image", "video"] },
  { id: "flux", providerId: "bfl", displayName: "FLUX", mediaTypes: ["image"] },
  { id: "seedream", providerId: "byteplus", displayName: "Seedream", mediaTypes: ["image"] },
  { id: "seedance", providerId: "byteplus", displayName: "Seedance", mediaTypes: ["video"] },
  { id: "kling", providerId: "kling", displayName: "Kling", mediaTypes: ["video"] },
  { id: "grok-imagine", providerId: "xai", displayName: "Grok Imagine", mediaTypes: ["image", "video"] },
] as const satisfies readonly ModelFamily[];

export const MODEL_FAMILY_REGISTRY: Readonly<Record<ModelFamilyId, ModelFamily>> = Object.freeze(
  Object.fromEntries(MODEL_FAMILIES.map((family) => [family.id, ModelFamilySchema.parse(family)])) as Record<ModelFamilyId, ModelFamily>,
);

const MODEL_VARIANT_ID_PATTERN = /^(openai|google|bfl|byteplus|kling|xai)\/(gpt-image|sora|nano-banana|veo|gemini-omni|flux|seedream|seedance|kling|grok-imagine)\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export const ModelVariantIdSchema = z
  .string()
  .regex(MODEL_VARIANT_ID_PATTERN, "Expected provider/family/variant using canonical lowercase IDs")
  .superRefine((value, context) => {
    const [providerId, familyId] = value.split("/") as [ProviderId, ModelFamilyId, string];
    if (FAMILY_PROVIDER[familyId] !== providerId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Variant ID provider does not own its family" });
    }
  })
  .brand<"ModelVariantId">();
export type ModelVariantId = z.infer<typeof ModelVariantIdSchema>;

export const SchemaRevisionIdSchema = z.string().regex(/^schema_[a-z0-9][a-z0-9._-]{0,63}$/).brand<"SchemaRevisionId">();
export type SchemaRevisionId = z.infer<typeof SchemaRevisionIdSchema>;

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string().max(100_000), z.number().finite(), z.boolean(), z.null(), z.array(JsonValueSchema).max(256), z.record(JsonValueSchema)]),
);
export const JsonObjectSchema = z.record(JsonValueSchema);
export type JsonObject = Record<string, unknown>;

export const ModelParameterSchema = z
  .object({
    name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$/),
    description: boundedText(2_000).optional(),
    required: z.boolean(),
    schema: JsonObjectSchema,
  })
  .strict();
export type ModelParameter = z.infer<typeof ModelParameterSchema>;

export const OperationInputRoleSchema = z
  .object({
    role: z.enum(["prompt", "negative-prompt", "source", "reference", "mask", "audio"]),
    modality: InputModalitySchema,
    required: z.boolean(),
    minCount: z.number().int().min(0).max(32),
    maxCount: z.number().int().min(1).max(32),
  })
  .strict()
  .superRefine((role, context) => {
    if (role.minCount > role.maxCount) context.addIssue({ code: z.ZodIssueCode.custom, message: "minCount cannot exceed maxCount", path: ["minCount"] });
    if (role.required && role.minCount === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Required roles need a positive minCount", path: ["minCount"] });
    if (!role.required && role.minCount !== 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Optional roles require minCount 0", path: ["minCount"] });
  });

const ExecutionSupportSchema = z
  .object({
    mode: z.enum(["synchronous", "asynchronous"]),
    webhook: z.enum(["unsupported", "optional", "required"]),
    polling: z.enum(["unsupported", "optional", "required"]),
    cancellation: z.enum(["unsupported", "optional", "required"]),
  })
  .strict();

const OperationSchemaSchema = z
  .object({
    revision: SchemaRevisionIdSchema,
    parameters: z.array(ModelParameterSchema).max(128),
  })
  .strict();

const CommonCapabilityFields = {
  schemaRevision: SchemaRevisionIdSchema,
  operation: OperationTypeSchema,
  inputRoles: z.array(OperationInputRoleSchema).min(1).max(16),
  execution: ExecutionSupportSchema,
  inputSchema: OperationSchemaSchema,
};

export const ImageOperationCapabilitySchema = z
  .object({
    ...CommonCapabilityFields,
    task: z.enum(["text-to-image", "image-to-image"]),
    outputMedia: z.literal("image"),
    limits: z
      .object({
        maxReferences: z.number().int().min(0).max(32),
        maxOutputCount: z.number().int().min(1).max(16),
        maxInputBytes: z.number().int().positive().max(1_000_000_000),
        maxOutputBytes: z.number().int().positive().max(1_000_000_000),
      })
      .strict(),
  })
  .strict();

export const VideoOperationCapabilitySchema = z
  .object({
    ...CommonCapabilityFields,
    task: z.enum(["text-to-video", "image-to-video", "video-to-video"]),
    outputMedia: z.literal("video"),
    limits: z
      .object({
        maxReferences: z.number().int().min(0).max(32),
        maxOutputCount: z.number().int().min(1).max(8),
        maxDurationSeconds: z.number().positive().max(3_600),
        maxInputBytes: z.number().int().positive().max(10_000_000_000),
        maxOutputBytes: z.number().int().positive().max(10_000_000_000),
      })
      .strict(),
  })
  .strict();

export const ModelOperationCapabilitySchema = z.discriminatedUnion("outputMedia", [ImageOperationCapabilitySchema, VideoOperationCapabilitySchema]);
export type ModelOperationCapability = z.infer<typeof ModelOperationCapabilitySchema>;

export const ProviderNativeModelSnapshotSchema = z
  .object({
    modelId: boundedText(256),
    version: boundedText(128).optional(),
    endpoint: boundedText(512).optional(),
    capturedAt: z.string().datetime(),
  })
  .strict();
export type ProviderNativeModelSnapshot = z.infer<typeof ProviderNativeModelSnapshotSchema>;

export const ModelVariantSchema = z
  .object({
    id: ModelVariantIdSchema,
    familyId: ModelFamilyIdSchema,
    providerId: ProviderIdSchema,
    providerNative: ProviderNativeModelSnapshotSchema,
    displayName: boundedText(120),
    description: boundedText(2_000).optional(),
    readiness: ModelReadinessSchema,
    mediaTypes: z.array(MediaTypeSchema).min(1).max(2),
    capabilities: z.array(ModelOperationCapabilitySchema).min(1).max(32).optional(),
    preview: z.boolean(),
    discoveredAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((variant, context) => {
    if (FAMILY_PROVIDER[variant.familyId] !== variant.providerId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Provider does not own this family", path: ["providerId"] });
    }
    const [idProvider, idFamily] = variant.id.split("/");
    if (idProvider !== variant.providerId || idFamily !== variant.familyId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Variant ID must match providerId and familyId", path: ["id"] });
    }
    if ((variant.readiness === "ready" || variant.readiness === "degraded") && !variant.capabilities?.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Executable variants require operation capabilities and input schemas", path: ["capabilities"] });
    }
    const familyMediaTypes = MODEL_FAMILY_REGISTRY[variant.familyId].mediaTypes;
    const capabilityKeys = new Set<string>();
    for (const [index, mediaType] of variant.mediaTypes.entries()) {
      if (!familyMediaTypes.includes(mediaType)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Variant media type is not supported by its canonical family", path: ["mediaTypes", index] });
      }
    }
    for (const [index, capability] of (variant.capabilities ?? []).entries()) {
      const capabilityKey = `${capability.task}:${capability.operation}`;
      if (capabilityKeys.has(capabilityKey)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Each task and operation pair must have one canonical capability", path: ["capabilities", index] });
      }
      capabilityKeys.add(capabilityKey);
      if (!variant.mediaTypes.includes(capability.outputMedia)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Capability output must be declared by the variant", path: ["capabilities", index, "outputMedia"] });
      }
      if (capability.schemaRevision !== capability.inputSchema.revision) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Capability and input schema revisions must match", path: ["capabilities", index, "inputSchema", "revision"] });
      }
    }
  });
export type ModelVariant = z.infer<typeof ModelVariantSchema>;

export class ModelVariantNotExecutableError extends Error {
  constructor(readonly modelId: ModelVariantId, readonly task: z.infer<typeof TaskTypeSchema>) {
    super(`Model variant ${modelId} is not executable for ${task}`);
    this.name = "ModelVariantNotExecutableError";
  }
}

/** Submission gate: discovered metadata is never treated as executable by inference. */
export function assertModelVariantExecutable(
  variant: ModelVariant,
  task: z.infer<typeof TaskTypeSchema>,
  operation: z.infer<typeof OperationTypeSchema>,
): ModelOperationCapability {
  if (variant.readiness !== "ready" && variant.readiness !== "degraded") throw new ModelVariantNotExecutableError(variant.id, task);
  const capability = variant.capabilities?.find((candidate) => candidate.task === task && candidate.operation === operation);
  if (!capability?.inputSchema) throw new ModelVariantNotExecutableError(variant.id, task);
  return capability;
}

export function getModelFamily(id: ModelFamilyId): ModelFamily {
  return MODEL_FAMILY_REGISTRY[id];
}
