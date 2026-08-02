import {
  EXECUTABLE_IMAGE_MODELS,
  EXECUTABLE_IMAGE_MODEL_NATIVE_IDS,
  type ExecutableImageModelNativeId,
} from "@eikonstudio/core";

export const IMAGE_MODEL_GPT_IMAGE_2 = "gpt-image-2" as const satisfies ExecutableImageModelNativeId;
export const IMAGE_MODEL_GEMINI_FLASH = "gemini-3.1-flash-image" as const satisfies ExecutableImageModelNativeId;
export const IMAGE_MODEL_GEMINI_PRO = "gemini-3-pro-image" as const satisfies ExecutableImageModelNativeId;
export const IMAGE_MODEL_GEMINI = IMAGE_MODEL_GEMINI_FLASH;

export type ImageModelId = ExecutableImageModelNativeId;
export type ImageProvider = "gemini" | "openai";

const executableByNativeId = new Map(
  EXECUTABLE_IMAGE_MODELS.map((model) => [model.nativeId, model]),
);

export const IMAGE_MODEL_IDS = EXECUTABLE_IMAGE_MODEL_NATIVE_IDS;

export function getImageModelProvider(model: ImageModelId): ImageProvider {
  return executableByNativeId.get(model)?.providerId === "openai" ? "openai" : "gemini";
}

export function getExecutableImageModel(model: ImageModelId) {
  const catalogModel = executableByNativeId.get(model);
  if (!catalogModel) throw new Error(`Unsupported Eikon image model: ${model}`);
  return catalogModel;
}

export function isImageModelId(value: string): value is ImageModelId {
  return (IMAGE_MODEL_IDS as readonly string[]).includes(value);
}
