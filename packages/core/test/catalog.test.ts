import { describe, expect, it } from "vitest";

import {
  EXECUTABLE_IMAGE_MODEL_NATIVE_IDS,
  FAMILY_PROVIDER,
  MODEL_CATALOG,
  MODEL_CATALOG_CHECKED_AT,
  MODEL_FAMILY_IDS,
  ModelCatalogEntrySchema,
} from "../src/index.js";

const OFFICIAL_HOSTS = {
  openai: ["developers.openai.com"],
  google: ["ai.google.dev", "docs.cloud.google.com"],
  bfl: ["docs.bfl.ai"],
  byteplus: ["docs.byteplus.com"],
  kling: ["kling.ai"],
  xai: ["docs.x.ai"],
} as const;

describe("source-backed canonical model catalog", () => {
  it("strictly validates every entry and covers all ten PRD families", () => {
    expect(MODEL_CATALOG_CHECKED_AT).toBe("2026-08-02");
    expect(MODEL_CATALOG).toHaveLength(93);
    expect(new Set(MODEL_CATALOG.map((model) => model.familyId))).toEqual(new Set(MODEL_FAMILY_IDS));
    for (const model of MODEL_CATALOG) expect(ModelCatalogEntrySchema.parse(model)).toEqual(model);
  });

  it("uses unique stable Eikon IDs with canonical provider ownership", () => {
    const ids = MODEL_CATALOG.map((model) => model.id);
    expect(new Set(ids)).toHaveLength(ids.length);
    for (const model of MODEL_CATALOG) {
      expect(model.providerId).toBe(FAMILY_PROVIDER[model.familyId]);
      expect(model.id.startsWith(`${model.providerId}/${model.familyId}/`)).toBe(true);
    }
  });

  it("links only to HTTPS first-party provider sources", () => {
    for (const model of MODEL_CATALOG) {
      const source = new URL(model.sourceUrl);
      expect(source.protocol).toBe("https:");
      expect(OFFICIAL_HOSTS[model.providerId]).toContain(source.hostname as never);
      expect(model.checkedAt).toBe(MODEL_CATALOG_CHECKED_AT);
    }
  });

  it("pins the three truly integrated image IDs and rejects stale aliases", () => {
    expect(EXECUTABLE_IMAGE_MODEL_NATIVE_IDS).toEqual([
      "gpt-image-2",
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
    ]);
    const nativeIds = MODEL_CATALOG.map((model) => model.nativeId);
    expect(nativeIds).toContain("gpt-image-2");
    expect(nativeIds).toContain("gemini-3-pro-image");
    expect(nativeIds).not.toContain("gemini-3.1-flash-image-preview");
    expect(MODEL_CATALOG.filter((model) => model.execution.integrated).map((model) => model.nativeId)).toEqual(
      expect.arrayContaining([...EXECUTABLE_IMAGE_MODEL_NATIVE_IDS]),
    );
    expect(MODEL_CATALOG.filter((model) => model.execution.integrated)).toHaveLength(3);
  });

  it("keeps unpublished or conflicting identifiers discovered and uncertain", () => {
    const seedance25 = MODEL_CATALOG.find((model) => model.displayName === "Dreamina Seedance 2.5");
    expect(seedance25).toMatchObject({ nativeId: null, providerLifecycle: "uncertain", readiness: "discovered" });
    expect(seedance25?.execution.integrated).toBe(false);
  });
});