import { z } from "zod";

export const PROVIDER_IDS = ["openai", "google", "bfl", "byteplus", "kling", "xai"] as const;
export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const MODEL_FAMILY_IDS = [
  "gpt-image",
  "sora",
  "nano-banana",
  "veo",
  "gemini-omni",
  "flux",
  "seedream",
  "seedance",
  "kling",
  "grok-imagine",
] as const;
export const ModelFamilyIdSchema = z.enum(MODEL_FAMILY_IDS);
export type ModelFamilyId = z.infer<typeof ModelFamilyIdSchema>;

export const MODEL_READINESS_STATES = ["discovered", "ready", "degraded", "deprecated", "disabled"] as const;
export const ModelReadinessSchema = z.enum(MODEL_READINESS_STATES);
export type ModelReadiness = z.infer<typeof ModelReadinessSchema>;

export const MEDIA_TYPES = ["image", "video"] as const;
export const MediaTypeSchema = z.enum(MEDIA_TYPES);
export type MediaType = z.infer<typeof MediaTypeSchema>;

export const INPUT_MODALITIES = ["text", "image", "video", "audio"] as const;
export const InputModalitySchema = z.enum(INPUT_MODALITIES);
export type InputModality = z.infer<typeof InputModalitySchema>;

export const TASK_TYPES = ["text-to-image", "image-to-image", "text-to-video", "image-to-video", "video-to-video"] as const;
export const TaskTypeSchema = z.enum(TASK_TYPES);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const OPERATION_TYPES = ["generate", "edit", "remix", "extend"] as const;
export const OperationTypeSchema = z.enum(OPERATION_TYPES);
export type OperationType = z.infer<typeof OperationTypeSchema>;

export const GENERATION_STATUSES = [
  "queued",
  "submitting",
  "processing",
  "persisting",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;
export const GenerationStatusSchema = z.enum(GENERATION_STATUSES);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export const TERMINAL_GENERATION_STATUSES = ["completed", "failed", "cancelled", "expired"] as const satisfies readonly GenerationStatus[];
export const TerminalGenerationStatusSchema = z.enum(TERMINAL_GENERATION_STATUSES);
export type TerminalGenerationStatus = z.infer<typeof TerminalGenerationStatusSchema>;
