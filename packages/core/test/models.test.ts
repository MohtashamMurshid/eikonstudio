import { describe, expect, it } from "vitest";

import {
  FAMILY_PROVIDER,
  MODEL_FAMILIES,
  MODEL_FAMILY_IDS,
  MODEL_FAMILY_REGISTRY,
  ModelFamilySchema,
  ModelVariantIdSchema,
  ModelVariantNotExecutableError,
  ModelVariantSchema,
  ProviderIdSchema,
  assertModelVariantExecutable,
  getModelFamily,
} from "../src/index.js";

const imageCapability = {
  schemaRevision: "schema_image_v1",
  operation: "generate",
  task: "text-to-image",
  inputRoles: [{ role: "prompt", modality: "text", required: true, minCount: 1, maxCount: 1 }],
  outputMedia: "image",
  limits: { maxReferences: 0, maxOutputCount: 4, maxInputBytes: 10_000_000, maxOutputBytes: 50_000_000 },
  execution: { mode: "asynchronous", webhook: "optional", polling: "required", cancellation: "optional" },
  inputSchema: {
    revision: "schema_image_v1",
    parameters: [{ name: "prompt", required: true, schema: { type: "string", maxLength: 100_000 } }],
  },
} as const;

const validVariant = {
  id: "google/veo/veo-3.1-preview",
  familyId: "veo",
  providerId: "google",
  providerNative: { modelId: "veo-3.1-preview", version: "2026-07-15", endpoint: "models/veo-3.1:generate", capturedAt: "2026-08-02T12:00:00.000Z" },
  displayName: "Veo 3.1 Preview",
  readiness: "ready",
  mediaTypes: ["video"],
  capabilities: [{
    ...imageCapability,
    schemaRevision: "schema_video_v1",
    task: "text-to-video",
    outputMedia: "video",
    limits: { maxReferences: 1, maxOutputCount: 2, maxDurationSeconds: 30, maxInputBytes: 50_000_000, maxOutputBytes: 2_000_000_000 },
    inputSchema: { revision: "schema_video_v1", parameters: [] },
  }],
  preview: true,
  discoveredAt: "2026-08-02T12:00:00.000Z",
  updatedAt: "2026-08-02T12:00:00.000Z",
} as const;

const imageVariant = ModelVariantSchema.parse({
  ...validVariant,
  id: "openai/gpt-image/gpt-image-2",
  familyId: "gpt-image",
  providerId: "openai",
  providerNative: { modelId: "gpt-image-2-native", version: "2026-08", endpoint: "/v1/images", capturedAt: "2026-08-02T12:00:00.000Z" },
  mediaTypes: ["image"],
  capabilities: [imageCapability],
});

describe("canonical identifiers and executable model registry", () => {
  it("contains each PRD family exactly once with canonical ownership", () => {
    expect(MODEL_FAMILIES).toHaveLength(10);
    expect(new Set(MODEL_FAMILIES.map(({ id }) => id))).toEqual(new Set(MODEL_FAMILY_IDS));
    for (const id of MODEL_FAMILY_IDS) {
      expect(getModelFamily(id)).toEqual(MODEL_FAMILY_REGISTRY[id]);
      expect(MODEL_FAMILY_REGISTRY[id].providerId).toBe(FAMILY_PROVIDER[id]);
    }
  });

  it("rejects unknown or malformed provider and model IDs", () => {
    for (const value of ["OpenAI", "black-forest-labs", "fal", ""]) expect(ProviderIdSchema.safeParse(value).success).toBe(false);
    for (const value of ["google/veo", "Google/veo/veo-3", "google/unknown/veo-3", "google/veo/has spaces", "google:veo:veo-3", "openai/flux/foo"]) {
      expect(ModelVariantIdSchema.safeParse(value).success).toBe(false);
    }
  });

  it("keeps immutable Eikon identity distinct from provider-native snapshots", () => {
    expect(imageVariant.id).toBe("openai/gpt-image/gpt-image-2");
    expect(imageVariant.providerNative).toMatchObject({ modelId: "gpt-image-2-native", version: "2026-08", endpoint: "/v1/images" });
    expect(ModelFamilySchema.safeParse({ ...MODEL_FAMILIES[0], providerId: "google" }).success).toBe(false);
    expect(ModelVariantSchema.safeParse({ ...validVariant, providerId: "openai" }).success).toBe(false);
  });

  it("allows discovered metadata without executable schema but fails submission closed", () => {
    const discovered = ModelVariantSchema.parse({ ...imageVariant, readiness: "discovered", capabilities: undefined });
    expect(discovered.capabilities).toBeUndefined();
    expect(() => assertModelVariantExecutable(discovered, "text-to-image", "generate")).toThrow(ModelVariantNotExecutableError);
    expect(ModelVariantSchema.safeParse({ ...discovered, readiness: "ready" }).success).toBe(false);
  });

  it("requires strict bounded operation-specific capabilities for ready/degraded variants", () => {
    expect(assertModelVariantExecutable(imageVariant, "text-to-image", "generate").outputMedia).toBe("image");
    expect(() => assertModelVariantExecutable(imageVariant, "image-to-image", "generate")).toThrow(ModelVariantNotExecutableError);
    expect(ModelVariantSchema.safeParse({
      ...imageVariant,
      capabilities: [{ ...imageCapability, limits: { ...imageCapability.limits, maxOutputCount: 17 } }],
    }).success).toBe(false);
    expect(ModelVariantSchema.safeParse({
      ...imageVariant,
      capabilities: [{ ...imageCapability, inputSchema: { ...imageCapability.inputSchema, revision: "schema_other_v1" } }],
    }).success).toBe(false);
    expect(ModelVariantSchema.safeParse({
      ...imageVariant,
      capabilities: [imageCapability, { ...imageCapability }],
    }).success).toBe(false);
    for (const inputRole of [
      { role: "reference", modality: "image", required: true, minCount: 0, maxCount: 1 },
      { role: "reference", modality: "image", required: false, minCount: 1, maxCount: 1 },
    ]) {
      expect(ModelVariantSchema.safeParse({ ...imageVariant, capabilities: [{ ...imageCapability, inputRoles: [inputRole] }] }).success).toBe(false);
    }
    expect(ModelVariantSchema.safeParse({
      ...imageVariant,
      capabilities: [{ ...imageCapability, task: "text-to-video" }],
    }).success).toBe(false);
    expect(ModelVariantSchema.safeParse({
      ...imageVariant,
      mediaTypes: ["video"],
      capabilities: [{
        ...imageCapability,
        task: "text-to-video",
        outputMedia: "video",
        schemaRevision: "schema_video_v1",
        inputSchema: { ...imageCapability.inputSchema, revision: "schema_video_v1" },
        limits: { ...imageCapability.limits, maxDurationSeconds: 30 },
      }],
    }).success).toBe(false);
    const multiOperation = ModelVariantSchema.parse({
      ...imageVariant,
      capabilities: [
        { ...imageCapability, operation: "edit", task: "image-to-image" },
        { ...imageCapability, operation: "remix", task: "image-to-image", schemaRevision: "schema_remix_v1", inputSchema: { ...imageCapability.inputSchema, revision: "schema_remix_v1" } },
      ],
    });
    expect(assertModelVariantExecutable(multiOperation, "image-to-image", "edit").operation).toBe("edit");
    expect(assertModelVariantExecutable(multiOperation, "image-to-image", "remix").operation).toBe("remix");
  });
});
