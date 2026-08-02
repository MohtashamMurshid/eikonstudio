import {
  IMAGE_MODEL_GEMINI_FLASH,
  IMAGE_MODEL_GEMINI_PRO,
  IMAGE_MODEL_GPT_IMAGE_2,
} from "./image-models";

export type EstimatedImageSize = "1K" | "2K" | "4K";
export type EstimatedGenerationMode = "text-to-image" | "image-editing";

const LEGACY_GEMINI_PREVIEW = "gemini-3.1-flash-image-preview";

/**
 * Approximate output-image prices in USD, checked 2026-08-02.
 *
 * Google publishes direct per-image equivalents. GPT Image 2 is token-priced;
 * these values use the official medium-quality square estimate for 1K/2K and
 * the high-quality square estimate for 4K, matching Eikon's quality mapping.
 * Historical preview rows retain the former Eikon estimate instead of being
 * silently repriced with a current model.
 * Sources:
 * - https://ai.google.dev/gemini-api/docs/pricing
 * - https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency
 */
const OUTPUT_IMAGE_COST_USD: Readonly<Record<string, Readonly<Record<EstimatedImageSize, number>>>> = {
  [IMAGE_MODEL_GEMINI_FLASH]: { "1K": 0.067, "2K": 0.101, "4K": 0.151 },
  [IMAGE_MODEL_GEMINI_PRO]: { "1K": 0.134, "2K": 0.134, "4K": 0.24 },
  [IMAGE_MODEL_GPT_IMAGE_2]: { "1K": 0.053, "2K": 0.053, "4K": 0.211 },
  [LEGACY_GEMINI_PREVIEW]: { "1K": 0.002, "2K": 0.0025, "4K": 0.005 },
};

const DEFAULT_COSTS = OUTPUT_IMAGE_COST_USD[LEGACY_GEMINI_PREVIEW];
const EDIT_INPUT_ALLOWANCE = 1.2;

export function estimateImageGenerationCost(
  imageSize: string = "2K",
  mode: string = "text-to-image",
  modelId: string = IMAGE_MODEL_GEMINI_FLASH,
): number {
  const normalizedSize = (["1K", "2K", "4K"].includes(imageSize) ? imageSize : "2K") as EstimatedImageSize;
  const outputCost = (OUTPUT_IMAGE_COST_USD[modelId] ?? DEFAULT_COSTS)[normalizedSize];
  const estimate = outputCost * (mode === "image-editing" ? EDIT_INPUT_ALLOWANCE : 1);
  return Math.round(estimate * 10000) / 10000;
}
