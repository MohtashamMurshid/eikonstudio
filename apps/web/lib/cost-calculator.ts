import { estimateImageGenerationCost } from "./image-costs";

/** Current integrated-model cost estimator; pricing evidence lives in image-costs.ts. */

export type ImageSize = "1K" | "2K" | "4K";
export type GenerationMode = "text-to-image" | "image-editing";


/**
 * Calculate the estimated cost for a single image generation
 */
export function calculateCost(
  imageSize: string = "2K",
  mode: GenerationMode = "text-to-image",
  modelId?: string,
): number {
  return estimateImageGenerationCost(imageSize, mode, modelId);
}

/**
 * Estimate cost for an existing generation record (for backfilling)
 * Uses default assumptions when specific data isn't available
 */
export function estimateCostForExisting(
  imageSize?: string,
  mode?: string
): number {
  const normalizedMode: GenerationMode = 
    mode === "image-editing" ? "image-editing" : "text-to-image";
  
  return calculateCost(imageSize || "2K", normalizedMode, "gemini-3.1-flash-image-preview");
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get the model name used for generation
 */
export function getModelName(model = "gemini-3.1-flash-image"): string {
  return model;
}

