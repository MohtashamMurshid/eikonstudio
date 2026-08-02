import { describe, expect, it } from "vitest";

import {
  IMAGE_MODEL_GEMINI_FLASH,
  IMAGE_MODEL_GEMINI_PRO,
  IMAGE_MODEL_GPT_IMAGE_2,
} from "./image-models";
import { estimateImageGenerationCost } from "./image-costs";
import { estimateCostForExisting } from "./cost-calculator";

describe("integrated image model cost estimates", () => {
  it("uses current Google output-image prices", () => {
    expect(estimateImageGenerationCost("1K", "text-to-image", IMAGE_MODEL_GEMINI_FLASH)).toBe(0.067);
    expect(estimateImageGenerationCost("2K", "text-to-image", IMAGE_MODEL_GEMINI_FLASH)).toBe(0.101);
    expect(estimateImageGenerationCost("4K", "text-to-image", IMAGE_MODEL_GEMINI_FLASH)).toBe(0.151);

    expect(estimateImageGenerationCost("1K", "text-to-image", IMAGE_MODEL_GEMINI_PRO)).toBe(0.134);
    expect(estimateImageGenerationCost("2K", "text-to-image", IMAGE_MODEL_GEMINI_PRO)).toBe(0.134);
    expect(estimateImageGenerationCost("4K", "text-to-image", IMAGE_MODEL_GEMINI_PRO)).toBe(0.24);
  });

  it("uses GPT Image 2 quality-mapped output estimates", () => {
    expect(estimateImageGenerationCost("1K", "text-to-image", IMAGE_MODEL_GPT_IMAGE_2)).toBe(0.053);
    expect(estimateImageGenerationCost("2K", "text-to-image", IMAGE_MODEL_GPT_IMAGE_2)).toBe(0.053);
    expect(estimateImageGenerationCost("4K", "text-to-image", IMAGE_MODEL_GPT_IMAGE_2)).toBe(0.211);
  });

  it("adds a bounded input allowance for image editing", () => {
    expect(estimateImageGenerationCost("2K", "image-editing", IMAGE_MODEL_GEMINI_PRO)).toBe(0.1608);
    expect(estimateImageGenerationCost("4K", "image-editing", IMAGE_MODEL_GPT_IMAGE_2)).toBe(0.2532);
  });

  it("preserves historical preview estimates and fails unknown IDs to the legacy baseline", () => {
    expect(estimateImageGenerationCost("2K", "text-to-image", "gemini-3.1-flash-image-preview")).toBe(0.0025);
    expect(estimateImageGenerationCost("2K", "text-to-image", "unknown-model")).toBe(0.0025);
    expect(estimateCostForExisting("2K", "text-to-image")).toBe(0.0025);
  });
});
