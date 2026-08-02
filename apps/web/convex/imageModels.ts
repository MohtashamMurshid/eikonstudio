import { v } from "convex/values";
import {
  IMAGE_MODEL_GEMINI_FLASH,
  IMAGE_MODEL_GEMINI_PRO,
  IMAGE_MODEL_GPT_IMAGE_2,
} from "../lib/image-models";

export const imageModelValidator = v.union(
  v.literal(IMAGE_MODEL_GEMINI_FLASH),
  v.literal(IMAGE_MODEL_GEMINI_PRO),
  v.literal(IMAGE_MODEL_GPT_IMAGE_2),
);

/** Historical rows may contain this retired preview alias; never expose it for new submissions. */
export const LEGACY_IMAGE_MODEL_GEMINI_PREVIEW = "gemini-3.1-flash-image-preview" as const;
export const storedImageModelValidator = v.union(
  imageModelValidator,
  v.literal(LEGACY_IMAGE_MODEL_GEMINI_PREVIEW),
);

export {
  IMAGE_MODEL_GEMINI_FLASH,
  IMAGE_MODEL_GEMINI_PRO,
  IMAGE_MODEL_GPT_IMAGE_2,
};
