/**
 * Gemini API Cost Calculator
 * 
 * Pricing based on Google AI Studio pricing (as of 2024):
 * - Standard image generation: ~$0.0025 per image
 * - 4K image generation: ~$0.005 per image
 * - Image editing (with reference images): ~$0.003 per image
 */

export type ImageSize = "1K" | "2K" | "4K";
export type GenerationMode = "text-to-image" | "image-editing";

interface CostFactors {
  basePrice: number;
  sizeMultiplier: Record<ImageSize, number>;
  modeMultiplier: Record<GenerationMode, number>;
}

const COST_FACTORS: CostFactors = {
  basePrice: 0.0025, // Base price per image in USD
  sizeMultiplier: {
    "1K": 0.8,  // 1K is cheaper
    "2K": 1.0,  // 2K is standard
    "4K": 2.0,  // 4K costs double
  },
  modeMultiplier: {
    "text-to-image": 1.0,
    "image-editing": 1.2, // Editing with reference images costs slightly more
  },
};

/**
 * Calculate the estimated cost for a single image generation
 */
export function calculateCost(
  imageSize: string = "2K",
  mode: GenerationMode = "text-to-image"
): number {
  const size = (["1K", "2K", "4K"].includes(imageSize) ? imageSize : "2K") as ImageSize;
  
  const cost = 
    COST_FACTORS.basePrice * 
    COST_FACTORS.sizeMultiplier[size] * 
    COST_FACTORS.modeMultiplier[mode];
  
  // Round to 4 decimal places
  return Math.round(cost * 10000) / 10000;
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
  
  return calculateCost(imageSize || "2K", normalizedMode);
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
export function getModelName(): string {
  return "gemini-3-pro-image-preview";
}

