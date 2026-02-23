import type { AspectRatio, GenerationMode, ImageSize } from "@eikon/sdk";
import { VALID_ASPECT_RATIOS, VALID_IMAGE_SIZES, VALID_MODES } from "./constants";

export function isImageSize(value: string): value is ImageSize {
  return VALID_IMAGE_SIZES.includes(value as ImageSize);
}

export function isAspectRatio(value: string): value is AspectRatio {
  return VALID_ASPECT_RATIOS.includes(value as AspectRatio);
}

export function isGenerationMode(value: string): value is GenerationMode {
  return VALID_MODES.includes(value as GenerationMode);
}
