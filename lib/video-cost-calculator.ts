/**
 * Google Veo API Cost Calculator
 *
 * Pricing based on Google Cloud pricing (estimates as of 2025):
 * - Standard 720p video generation: ~$0.10 per 8-second video
 * - 1080p video generation: ~$0.15 per 8-second video
 * - Image-to-video (with reference images): ~$0.12 per 8-second video
 * - Frame-to-video (first & last frame): ~$0.13 per 8-second video
 *
 * NOTE: These are estimates. Actual pricing should be verified from Google Cloud pricing docs.
 */

export type VideoResolution = "720p" | "1080p";
export type VideoGenerationMode = "text-to-video" | "image-to-video" | "frame-to-video";

interface VideoCostFactors {
  basePrice: number;
  resolutionMultiplier: Record<VideoResolution, number>;
  modeMultiplier: Record<VideoGenerationMode, number>;
  referenceImageFee: number;
}

const VIDEO_COST_FACTORS: VideoCostFactors = {
  basePrice: 0.10, // Base price per 8-second video in USD
  resolutionMultiplier: {
    "720p": 1.0,  // 720p is standard
    "1080p": 1.5, // 1080p costs 1.5x more
  },
  modeMultiplier: {
    "text-to-video": 1.0,     // Standard text-to-video
    "image-to-video": 1.2,    // Image-to-video with reference images
    "frame-to-video": 1.3,    // Frame-to-video (first & last frame)
  },
  referenceImageFee: 0.01, // Additional fee per reference image (up to 3)
};

/**
 * Calculate the estimated cost for a single video generation
 */
export function calculateVideoCost(
  resolution: string = "720p",
  mode: VideoGenerationMode = "text-to-video",
  referenceImageCount: number = 0
): number {
  const res = (["720p", "1080p"].includes(resolution) ? resolution : "720p") as VideoResolution;

  const cost =
    VIDEO_COST_FACTORS.basePrice *
    VIDEO_COST_FACTORS.resolutionMultiplier[res] *
    VIDEO_COST_FACTORS.modeMultiplier[mode] +
    (referenceImageCount * VIDEO_COST_FACTORS.referenceImageFee);

  // Round to 4 decimal places
  return Math.round(cost * 10000) / 10000;
}

/**
 * Estimate cost for an existing video generation record (for backfilling)
 * Uses default assumptions when specific data isn't available
 */
export function estimateVideoCostForExisting(
  resolution?: string,
  mode?: string,
  referenceImageCount?: number
): number {
  const normalizedMode: VideoGenerationMode =
    mode === "image-to-video" ? "image-to-video" :
    mode === "frame-to-video" ? "frame-to-video" :
    "text-to-video";

  return calculateVideoCost(resolution || "720p", normalizedMode, referenceImageCount || 0);
}

/**
 * Format cost for display
 */
export function formatVideoCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get the model name used for video generation
 */
export function getVideoModelName(): string {
  return "veo-3.1-generate-preview";
}

/**
 * Get estimated duration based on video configuration
 * (Currently Veo generates 8-second videos)
 */
export function getEstimatedDuration(): number {
  return 8; // seconds
}

/**
 * Get cost warning message based on resolution and mode
 */
export function getVideoCostWarning(
  resolution: string,
  mode: VideoGenerationMode,
  referenceImageCount: number = 0
): string | null {
  const cost = calculateVideoCost(resolution, mode, referenceImageCount);

  if (cost >= 0.15) {
    return `This video generation will cost approximately ${formatVideoCost(cost)}. High-resolution videos are more expensive.`;
  }

  if (referenceImageCount > 0) {
    return `This video generation will cost approximately ${formatVideoCost(cost)} (includes ${referenceImageCount} reference image${referenceImageCount > 1 ? 's' : ''}).`;
  }

  return null;
}
