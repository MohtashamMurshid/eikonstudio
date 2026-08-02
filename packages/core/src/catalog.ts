import { z } from "zod";

import {
  MediaTypeSchema,
  ModelFamilyIdSchema,
  ModelReadinessSchema,
  ProviderIdSchema,
  type ModelFamilyId,
  type ProviderId,
} from "./vocabulary.js";
import { FAMILY_PROVIDER, ModelVariantIdSchema } from "./models.js";

export const MODEL_CATALOG_CHECKED_AT = "2026-08-02" as const;

export const CatalogTaskSchema = z.enum([
  "text-to-image", "image-to-image", "inpainting", "outpainting", "erase", "deblur",
  "virtual-try-on", "grounding-search", "finetune-inference", "style-transfer",
  "subject-generation", "series-generation", "text-to-video", "image-to-video",
  "reference-to-video", "video-to-video", "video-editing", "video-extension",
  "audio-generation", "multi-shot", "avatar", "lip-sync", "motion-control",
]);
export type CatalogTask = z.infer<typeof CatalogTaskSchema>;

export const ProviderLifecycleSchema = z.enum(["active", "preview", "deprecated", "uncertain"]);
export type ProviderLifecycle = z.infer<typeof ProviderLifecycleSchema>;

export const ExecutionSupportSchema = z
  .object({
    integrated: z.boolean(),
    notes: z.string().min(1).max(1_000),
  })
  .strict();

export const ModelCatalogEntrySchema = z
  .object({
    id: ModelVariantIdSchema,
    nativeId: z.string().min(1).max(256).nullable(),
    displayName: z.string().min(1).max(120),
    aliases: z.array(z.string().min(1).max(120)).max(8),
    providerId: ProviderIdSchema,
    familyId: ModelFamilyIdSchema,
    apiSurface: z.string().min(1).max(120),
    mediaTypes: z.array(MediaTypeSchema).min(1).max(2),
    tasks: z.array(CatalogTaskSchema).min(1),
    providerLifecycle: ProviderLifecycleSchema,
    readiness: ModelReadinessSchema,
    execution: ExecutionSupportSchema,
    availabilityNotes: z.string().min(1).max(2_000),
    sourceUrl: z.string().url().startsWith("https://"),
    checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .superRefine((entry, context) => {
    const [idProvider, idFamily] = entry.id.split("/");
    if (FAMILY_PROVIDER[entry.familyId] !== entry.providerId || idProvider !== entry.providerId || idFamily !== entry.familyId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog ID, provider, and family ownership must agree" });
    }
    if (entry.readiness === "ready" && (!entry.execution.integrated || entry.nativeId === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Ready entries require an integrated canonical native ID", path: ["readiness"] });
    }
    if (entry.execution.integrated && entry.readiness !== "ready") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Integrated entries must be Eikon ready", path: ["execution", "integrated"] });
    }
    if (entry.nativeId === null && entry.providerLifecycle !== "uncertain") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Entries without a canonical native ID must remain uncertain", path: ["nativeId"] });
    }
  });
export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntrySchema>;

type EntryInput = Omit<ModelCatalogEntry, "id" | "checkedAt" | "execution"> & {
  id: string;
  execution?: ModelCatalogEntry["execution"];
};

const notIntegrated = { integrated: false, notes: "Cataloged from official provider documentation; no Eikon execution adapter is integrated." } as const;
const integrated = { integrated: true, notes: "Integrated in the Eikon image creator and public generation gateway." } as const;

function entry(value: EntryInput): ModelCatalogEntry {
  return ModelCatalogEntrySchema.parse({ checkedAt: MODEL_CATALOG_CHECKED_AT, execution: notIntegrated, ...value });
}

const OPENAI_MODEL = "https://developers.openai.com/api/docs/models";
const OPENAI_DEPRECATIONS = "https://developers.openai.com/api/docs/deprecations";
const GOOGLE_IMAGE = "https://ai.google.dev/gemini-api/docs/image-generation";
const GOOGLE_VEO = "https://ai.google.dev/gemini-api/docs/veo";
const GOOGLE_VEO_ENTERPRISE = "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate";
const BFL_GENERATE = "https://docs.bfl.ai/quick_start/generating_images";
const BFL_LORA = "https://docs.bfl.ai/flux_2/flux2_lora_inference";
const BYTEPLUS_MODELS = "https://docs.byteplus.com/en/docs/ModelArk/1330310";
const BYTEPLUS_SEEDANCE = "https://docs.byteplus.com/en/docs/ModelArk/2291680";
const KLING_IMAGE = "https://kling.ai/document-api/guides/capability-map/image";
const KLING_VIDEO = "https://kling.ai/document-api/guides/capability-map/video";
const XAI_MODELS = "https://docs.x.ai/developers/models";

const imageTasks: CatalogTask[] = ["text-to-image", "image-to-image"];
const videoTasks: CatalogTask[] = ["text-to-video", "image-to-video"];
const discovered = "discovered" as const;
const active = "active" as const;

export const MODEL_CATALOG = [
  // OpenAI — GPT Image and Sora
  entry({ id: "openai/gpt-image/gpt-image-2", nativeId: "gpt-image-2", displayName: "GPT Image 2", aliases: [], providerId: "openai", familyId: "gpt-image", apiSurface: "OpenAI Images API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: active, readiness: "ready", execution: integrated, availabilityNotes: "Current model; provider access remains account and organization dependent.", sourceUrl: "https://developers.openai.com/api/docs/models/gpt-image-2" }),
  entry({ id: "openai/gpt-image/gpt-image-1-5", nativeId: "gpt-image-1.5", displayName: "GPT Image 1.5", aliases: [], providerId: "openai", familyId: "gpt-image", apiSurface: "OpenAI Images API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: "deprecated", readiness: "deprecated", availabilityNotes: "Accessible until the announced 2026-12-01 shutdown.", sourceUrl: OPENAI_DEPRECATIONS }),
  entry({ id: "openai/gpt-image/gpt-image-1", nativeId: "gpt-image-1", displayName: "GPT Image 1", aliases: [], providerId: "openai", familyId: "gpt-image", apiSurface: "OpenAI Images API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: "deprecated", readiness: "deprecated", availabilityNotes: "Accessible until the announced 2026-10-23 shutdown.", sourceUrl: OPENAI_DEPRECATIONS }),
  entry({ id: "openai/gpt-image/gpt-image-1-mini", nativeId: "gpt-image-1-mini", displayName: "gpt-image-1-mini", aliases: [], providerId: "openai", familyId: "gpt-image", apiSurface: "OpenAI Images API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: "deprecated", readiness: "deprecated", availabilityNotes: "Cost-efficient legacy variant; accessible until the announced 2026-12-01 shutdown.", sourceUrl: OPENAI_DEPRECATIONS }),
  entry({ id: "openai/gpt-image/chatgpt-image-latest", nativeId: "chatgpt-image-latest", displayName: "chatgpt-image-latest", aliases: [], providerId: "openai", familyId: "gpt-image", apiSurface: "OpenAI Images API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: "deprecated", readiness: "deprecated", availabilityNotes: "Deprecated ChatGPT snapshot alias; OpenAI recommends GPT Image 2. Shutdown 2026-12-01.", sourceUrl: "https://developers.openai.com/api/docs/models/chatgpt-image-latest" }),
  entry({ id: "openai/sora/sora-2", nativeId: "sora-2", displayName: "Sora 2", aliases: [], providerId: "openai", familyId: "sora", apiSurface: "OpenAI Videos API", mediaTypes: ["video"], tasks: [...videoTasks, "audio-generation"], providerLifecycle: "deprecated", readiness: "deprecated", availabilityNotes: "Videos API and model are scheduled to shut down 2026-09-24.", sourceUrl: OPENAI_DEPRECATIONS }),
  entry({ id: "openai/sora/sora-2-pro", nativeId: "sora-2-pro", displayName: "Sora 2 Pro", aliases: [], providerId: "openai", familyId: "sora", apiSurface: "OpenAI Videos API", mediaTypes: ["video"], tasks: [...videoTasks, "audio-generation"], providerLifecycle: "deprecated", readiness: "deprecated", availabilityNotes: "Higher-quality, up-to-1080p variant; scheduled to shut down 2026-09-24.", sourceUrl: OPENAI_DEPRECATIONS }),

  // Google — Nano Banana
  entry({ id: "google/nano-banana/gemini-3-1-flash-lite-image", nativeId: "gemini-3.1-flash-lite-image", displayName: "Gemini 3.1 Flash Lite Image", aliases: ["Nano Banana 2 Lite"], providerId: "google", familyId: "nano-banana", apiSurface: "Gemini API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: active, readiness: discovered, availabilityNotes: "Stable Google model; not integrated in Eikon.", sourceUrl: GOOGLE_IMAGE }),
  entry({ id: "google/nano-banana/gemini-3-1-flash-image", nativeId: "gemini-3.1-flash-image", displayName: "Gemini 3.1 Flash Image", aliases: ["Nano Banana 2"], providerId: "google", familyId: "nano-banana", apiSurface: "Gemini API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: active, readiness: "ready", execution: integrated, availabilityNotes: "Stable model; provider availability depends on Gemini API account and region.", sourceUrl: "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image" }),
  entry({ id: "google/nano-banana/gemini-3-pro-image", nativeId: "gemini-3-pro-image", displayName: "Gemini 3 Pro Image", aliases: ["Nano Banana Pro"], providerId: "google", familyId: "nano-banana", apiSurface: "Gemini API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: active, readiness: "ready", execution: integrated, availabilityNotes: "Stable professional-grade model; provider availability depends on Gemini API account and region.", sourceUrl: "https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image" }),
  entry({ id: "google/nano-banana/gemini-2-5-flash-image", nativeId: "gemini-2.5-flash-image", displayName: "Gemini 2.5 Flash Image", aliases: ["Nano Banana"], providerId: "google", familyId: "nano-banana", apiSurface: "Gemini API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: "deprecated", readiness: "deprecated", availabilityNotes: "Stable legacy pioneer with retirement scheduled for 2026-10-02.", sourceUrl: GOOGLE_IMAGE }),

  // Google — Veo (surface-specific IDs are intentionally separate)
  entry({ id: "google/veo/veo-3-1-generate-preview", nativeId: "veo-3.1-generate-preview", displayName: "Veo 3.1 Preview", aliases: ["Veo 3.1"], providerId: "google", familyId: "veo", apiSurface: "Gemini API", mediaTypes: ["video"], tasks: [...videoTasks, "audio-generation"], providerLifecycle: "preview", readiness: discovered, availabilityNotes: "Gemini API preview; no shutdown announced as of the checked date. Do not confuse with Enterprise endpoint IDs.", sourceUrl: GOOGLE_VEO }),
  entry({ id: "google/veo/veo-3-1-fast-generate-preview", nativeId: "veo-3.1-fast-generate-preview", displayName: "Veo 3.1 Fast Preview", aliases: ["Veo 3.1 Fast"], providerId: "google", familyId: "veo", apiSurface: "Gemini API", mediaTypes: ["video"], tasks: [...videoTasks, "audio-generation"], providerLifecycle: "preview", readiness: discovered, availabilityNotes: "Gemini API preview; no shutdown announced as of the checked date.", sourceUrl: GOOGLE_VEO }),
  entry({ id: "google/veo/veo-3-1-lite-generate-preview", nativeId: "veo-3.1-lite-generate-preview", displayName: "Veo 3.1 Lite Preview", aliases: ["Veo 3.1 Lite"], providerId: "google", familyId: "veo", apiSurface: "Gemini API", mediaTypes: ["video"], tasks: [...videoTasks, "audio-generation"], providerLifecycle: "preview", readiness: discovered, availabilityNotes: "Lower-cost Gemini API preview; no shutdown announced as of the checked date.", sourceUrl: GOOGLE_VEO }),
  entry({ id: "google/veo/veo-3-1-generate-001", nativeId: "veo-3.1-generate-001", displayName: "Veo 3.1", aliases: [], providerId: "google", familyId: "veo", apiSurface: "Gemini Enterprise Agent Platform", mediaTypes: ["video"], tasks: videoTasks, providerLifecycle: active, readiness: discovered, availabilityNotes: "GA Enterprise endpoint. Enterprise documentation currently says sound generation is unsupported.", sourceUrl: GOOGLE_VEO_ENTERPRISE }),
  entry({ id: "google/veo/veo-3-1-fast-generate-001", nativeId: "veo-3.1-fast-generate-001", displayName: "Veo 3.1 Fast", aliases: [], providerId: "google", familyId: "veo", apiSurface: "Gemini Enterprise Agent Platform", mediaTypes: ["video"], tasks: videoTasks, providerLifecycle: active, readiness: discovered, availabilityNotes: "GA Enterprise endpoint; separate from the Gemini API preview ID.", sourceUrl: GOOGLE_VEO_ENTERPRISE }),
  entry({ id: "google/veo/veo-3-1-lite-generate-001", nativeId: "veo-3.1-lite-generate-001", displayName: "Veo 3.1 Lite", aliases: [], providerId: "google", familyId: "veo", apiSurface: "Gemini Enterprise Agent Platform", mediaTypes: ["video"], tasks: videoTasks, providerLifecycle: "preview", readiness: discovered, availabilityNotes: "Enterprise preview endpoint; separate from the Gemini API preview ID.", sourceUrl: GOOGLE_VEO_ENTERPRISE }),
  entry({ id: "google/gemini-omni/gemini-omni-flash-preview", nativeId: "gemini-omni-flash-preview", displayName: "Gemini Omni Flash Preview", aliases: ["Gemini Omni Flash"], providerId: "google", familyId: "gemini-omni", apiSurface: "Gemini API", mediaTypes: ["video"], tasks: ["text-to-video", "image-to-video", "reference-to-video", "video-editing", "audio-generation"], providerLifecycle: "preview", readiness: discovered, availabilityNotes: "Preview conversational video generation and editing model.", sourceUrl: "https://ai.google.dev/gemini-api/docs/omni" }),

  // BFL — hosted base and specialized models
  ...([
    ["flux-2-max", "FLUX.2 [max]", ["text-to-image", "image-to-image", "grounding-search"], active, "Highest-quality current tier."],
    ["flux-2-pro-preview", "FLUX.2 [pro] Preview", imageTasks, "preview", "Rolling preview with latest weights."],
    ["flux-2-pro", "FLUX.2 [pro]", imageTasks, active, "Stable fixed production snapshot."],
    ["flux-2-flex", "FLUX.2 [flex]", imageTasks, active, "Adjustable steps and guidance."],
    ["flux-2-klein-4b", "FLUX.2 [klein] 4B", imageTasks, active, "Lightweight hosted tier."],
    ["flux-2-klein-9b-preview", "FLUX.2 [klein] 9B Preview", imageTasks, "preview", "Preview with latest KV-cached improvements."],
    ["flux-2-klein-9b", "FLUX.2 [klein] 9B", imageTasks, active, "Stable fixed snapshot."],
    ["flux-kontext-max", "FLUX.1 Kontext [max]", imageTasks, active, "Active legacy model; BFL recommends FLUX.2 for new integrations."],
    ["flux-kontext-pro", "FLUX.1 Kontext [pro]", imageTasks, active, "Active legacy model; BFL recommends FLUX.2 for new integrations."],
    ["flux-pro-1.1-ultra", "FLUX1.1 [pro] Ultra", ["text-to-image", "image-to-image"], active, "Raw is a parameter mode, not a separate model ID."],
    ["flux-pro-1.1", "FLUX1.1 [pro]", ["text-to-image"], active, "Current previous-generation endpoint."],
    ["flux-pro", "FLUX.1 [pro]", ["text-to-image"], active, "Compatibility endpoint still listed in the current quick start."],
    ["flux-dev", "FLUX.1 [dev]", ["text-to-image"], active, "Active BFL-hosted endpoint; distinct from local-only FLUX.2 dev."],
    ["flux-pro-1.0-fill", "FLUX.1 Fill [pro]", ["inpainting", "outpainting"], active, "Specialized mask/alpha fill endpoint."],
    ["flux-pro-1.0-expand", "FLUX.1 Expand [pro]", ["outpainting"], active, "Specialized prompt-guided expansion endpoint."],
  ] as const).map(([nativeId, displayName, tasks, providerLifecycle, availabilityNotes]) => entry({ id: `bfl/flux/${nativeId}`, nativeId, displayName, aliases: [], providerId: "bfl", familyId: "flux", apiSurface: "BFL hosted API", mediaTypes: ["image"], tasks: [...tasks], providerLifecycle, readiness: discovered, availabilityNotes, sourceUrl: BFL_GENERATE })),
  ...([
    ["flux-tools/outpainting-v1", "FLUX Outpainting", "outpainting", "Current generative scene-extension tool."],
    ["flux-tools/erase-v1", "FLUX Erase", "erase", "Current mask-driven removal tool."],
    ["flux-tools/deblur-v1", "FLUX Deblur", "deblur", "Current generative sharpening tool."],
    ["flux-tools/vto-v1", "FLUX Virtual Try-On v1", "virtual-try-on", "Active legacy version."],
    ["flux-tools/vto-v2", "FLUX Virtual Try-On v2", "virtual-try-on", "Current recommended version."],
  ] as const).map(([nativeId, displayName, task, availabilityNotes]) => entry({ id: `bfl/flux/${nativeId.replaceAll("/", "-")}`, nativeId, displayName, aliases: [], providerId: "bfl", familyId: "flux", apiSurface: "BFL FLUX Tools API", mediaTypes: ["image"], tasks: [task], providerLifecycle: active, readiness: discovered, availabilityNotes, sourceUrl: "https://docs.bfl.ai/release-notes" })),
  ...(["flux-2-klein-4b-finetuned", "flux-2-klein-9b-finetuned", "flux-2-klein-9b-kv-finetuned", "flux-2-klein-9b-kv-bf16-finetuned", "flux-2-klein-base-4b-finetuned", "flux-2-klein-base-9b-finetuned"] as const).map((nativeId) => entry({ id: `bfl/flux/${nativeId}`, nativeId, displayName: nativeId, aliases: [], providerId: "bfl", familyId: "flux", apiSurface: "BFL FLUX.2 LoRA inference", mediaTypes: ["image"], tasks: ["finetune-inference", "text-to-image", "image-to-image"], providerLifecycle: "preview", readiness: discovered, availabilityNotes: "Public beta; requires a compatible finetune owned by or shared with the caller's BFL organization.", sourceUrl: BFL_LORA })),

  // BytePlus — Seedream and Seedance
  ...([
    ["dola-seedream-5-0-pro-260628", "Dola Seedream 5.0 Pro", ["text-to-image", "image-to-image"], "AP only; interactive editing; no batch or streaming output yet."],
    ["seedream-5-0-260128", "Seedream 5.0 Lite", imageTasks, "AP and EU; supports batch and streaming output."],
    ["seedream-5-0-lite-260128", "Seedream 5.0 Lite", imageTasks, "Explicit alternate executable ID; AP and EU."],
    ["seedream-4-5-251128", "Seedream 4.5", imageTasks, "AP only; supports batch and streaming output."],
    ["seedream-4-0-250828", "Seedream 4.0", imageTasks, "AP only; supports batch and streaming output."],
  ] as const).map(([nativeId, displayName, tasks, availabilityNotes]) => entry({ id: `byteplus/seedream/${nativeId}`, nativeId, displayName, aliases: [], providerId: "byteplus", familyId: "seedream", apiSurface: "BytePlus ModelArk", mediaTypes: ["image"], tasks: [...tasks], providerLifecycle: active, readiness: discovered, availabilityNotes, sourceUrl: BYTEPLUS_MODELS })),
  ...([
    ["dreamina-seedance-2-0-260128", "Dreamina Seedance 2.0", [...videoTasks, "reference-to-video", "video-editing", "video-extension", "audio-generation"], "AP only; prepaid Seedance 2.0 resource pack required; 480p–4K."],
    ["dreamina-seedance-2-0-fast-260128", "Dreamina Seedance 2.0 Fast", [...videoTasks, "reference-to-video", "video-editing", "video-extension", "audio-generation"], "AP only; prepaid Seedance 2.0 resource pack required; 480p/720p."],
    ["dreamina-seedance-2-0-mini-260615", "Dreamina Seedance 2.0 Mini", [...videoTasks, "reference-to-video", "video-editing", "video-extension", "audio-generation"], "AP only; prepaid Seedance 2.0 resource pack required; 480p/720p."],
    ["seedance-1-5-pro-251215", "Seedance 1.5 Pro", [...videoTasks, "audio-generation"], "AP only."],
    ["seedance-1-0-pro-250528", "Seedance 1.0 Pro", videoTasks, "AP only."],
    ["seedance-1-0-pro-fast-251015", "Seedance 1.0 Pro Fast", videoTasks, "AP only."],
  ] as const).map(([nativeId, displayName, tasks, availabilityNotes]) => entry({ id: `byteplus/seedance/${nativeId}`, nativeId, displayName, aliases: [], providerId: "byteplus", familyId: "seedance", apiSurface: "BytePlus ModelArk", mediaTypes: ["video"], tasks: [...tasks], providerLifecycle: active, readiness: discovered, availabilityNotes, sourceUrl: BYTEPLUS_SEEDANCE })),
  entry({ id: "byteplus/seedance/dreamina-seedance-2-5-unknown", nativeId: null, displayName: "Dreamina Seedance 2.5", aliases: [], providerId: "byteplus", familyId: "seedance", apiSurface: "BytePlus ModelArk watchlist", mediaTypes: ["video"], tasks: videoTasks, providerLifecycle: "uncertain", readiness: discovered, availabilityNotes: "Officially announced by name, but API access is 'available soon' and no canonical dated executable model ID is published. Console slugs are not API IDs.", sourceUrl: BYTEPLUS_SEEDANCE }),

  // xAI — Grok Imagine
  entry({ id: "xai/grok-imagine/grok-imagine-image", nativeId: "grok-imagine-image", displayName: "Grok Imagine Image", aliases: ["grok-imagine-image-2026-03-02"], providerId: "xai", familyId: "grok-imagine", apiSurface: "xAI Image API", mediaTypes: ["image"], tasks: imageTasks, providerLifecycle: active, readiness: discovered, availabilityNotes: "Available in us-east-1, us-west-2, and us-saltlake-2; entitlement may vary by account and geography.", sourceUrl: "https://docs.x.ai/developers/models/grok-imagine-image" }),
  entry({ id: "xai/grok-imagine/grok-imagine-image-quality", nativeId: "grok-imagine-image-quality", displayName: "Grok Imagine Image Quality", aliases: ["grok-imagine-image-quality-20260403", "grok-imagine-image-quality-latest", "grok-imagine-image-pro"], providerId: "xai", familyId: "grok-imagine", apiSurface: "xAI Image API", mediaTypes: ["image"], tasks: [...imageTasks, "style-transfer"], providerLifecycle: active, readiness: discovered, availabilityNotes: "Recommended image model; available in us-east-1 and us-west-2. Official version aliases are not separate catalog variants.", sourceUrl: "https://docs.x.ai/developers/models/grok-imagine-image-quality" }),
  entry({ id: "xai/grok-imagine/grok-imagine-video-1-5", nativeId: "grok-imagine-video-1.5", displayName: "Grok Imagine Video 1.5", aliases: ["grok-imagine-video-1.5-preview", "grok-imagine-video-1.5-2026-05-30"], providerId: "xai", familyId: "grok-imagine", apiSurface: "xAI Video API", mediaTypes: ["video"], tasks: ["text-to-video", "image-to-video", "reference-to-video", "audio-generation"], providerLifecycle: active, readiness: discovered, availabilityNotes: "Available in us-east-1 and us-west-2. Reference audio is US-only and restricted to trusted partners.", sourceUrl: "https://docs.x.ai/developers/models/grok-imagine-video-1.5" }),
  entry({ id: "xai/grok-imagine/grok-imagine-video", nativeId: "grok-imagine-video", displayName: "Grok Imagine Video", aliases: [], providerId: "xai", familyId: "grok-imagine", apiSurface: "xAI Video API", mediaTypes: ["video"], tasks: [...videoTasks, "video-editing", "video-extension"], providerLifecycle: active, readiness: discovered, availabilityNotes: "Previous/general video model; editing and extension remain specific to this variant. Account and regional access varies.", sourceUrl: "https://docs.x.ai/developers/models/grok-imagine-video" }),

  // Kling — image variants
  ...([
    ["kling-v3", "Kling Image 3.0", ["text-to-image", "image-to-image", "subject-generation"], "Current promoted image model."],
    ["kling-v3-omni", "Kling Image 3.0 Omni", ["text-to-image", "image-to-image", "series-generation"], "Current promoted image composition/editing model."],
    ["kling-image-o1", "Kling Image O1", ["text-to-image", "image-to-image", "style-transfer"], "Current promoted precision editing model."],
    ["kling-v2-1", "Kling Image 2.1", ["text-to-image", "image-to-image", "series-generation"], "Publicly documented under View more models."],
    ["kling-v2-new", "Kling Image 2.0 New", ["text-to-image", "image-to-image"], "Discoverable, but current capability map marks direct T2I and I2I unsupported; entitlement must be tested."],
    ["kling-v2", "Kling Image 2.0", ["text-to-image", "image-to-image"], "Publicly documented older image model."],
    ["kling-v1-5", "Kling Image 1.5", imageTasks, "Publicly documented older image model."],
    ["kling-v1", "Kling Image 1.0", imageTasks, "Publicly documented older image model."],
  ] as const).map(([nativeId, displayName, tasks, availabilityNotes]) => entry({ id: `kling/kling/image-${nativeId}`, nativeId, displayName, aliases: [], providerId: "kling", familyId: "kling", apiSurface: "Kling legacy image API", mediaTypes: ["image"], tasks: [...tasks], providerLifecycle: nativeId === "kling-v2-new" ? "uncertain" : active, readiness: discovered, availabilityNotes, sourceUrl: KLING_IMAGE })),

  // Kling — current path-version and legacy video IDs
  ...([
    ["kling-3.0-turbo", "Kling 3.0 Turbo", [...videoTasks, "audio-generation"], "API 2.0 path-version ID; new and promoted."],
    ["kling-3.0", "Kling 3.0", [...videoTasks, "motion-control", "audio-generation"], "API 2.0 path-version ID; current and promoted."],
    ["kling-3.0-omni", "Kling 3.0 Omni", [...videoTasks, "video-editing", "reference-to-video", "audio-generation"], "API 2.0 path-version ID; current and marked Hot."],
    ["kling-o1", "Kling O1", [...videoTasks, "video-editing", "reference-to-video"], "API 2.0 path-version ID; current and promoted."],
    ["kling-2.6", "Kling 2.6", [...videoTasks, "motion-control", "audio-generation"], "API 2.0 path-version ID; current."],
    ["kling-2.5-turbo", "Kling 2.5 Turbo", videoTasks, "API 2.0 path-version ID; current."],
  ] as const).map(([nativeId, displayName, tasks, availabilityNotes]) => entry({ id: `kling/kling/video-${nativeId}`, nativeId, displayName, aliases: [], providerId: "kling", familyId: "kling", apiSurface: "Kling API 2.0", mediaTypes: ["video"], tasks: [...tasks], providerLifecycle: active, readiness: discovered, availabilityNotes, sourceUrl: KLING_VIDEO })),
  ...([
    ["kling-v3", "Kling 3.0 (legacy ID)", [...videoTasks, "motion-control", "audio-generation"], "Legacy model_name for Kling 3.0; distinct API surface from current path ID."],
    ["kling-v3-omni", "Kling 3.0 Omni (legacy ID)", [...videoTasks, "video-editing", "reference-to-video", "audio-generation"], "Legacy model_name for Kling 3.0 Omni."],
    ["kling-video-o1", "Kling O1 (legacy ID)", [...videoTasks, "video-editing", "reference-to-video"], "Legacy model_name for Kling O1."],
    ["kling-v2-6", "Kling 2.6 (legacy ID)", [...videoTasks, "motion-control", "audio-generation"], "Legacy model_name for Kling 2.6."],
    ["kling-v2-5-turbo", "Kling 2.5 Turbo (legacy ID)", videoTasks, "Legacy model_name for Kling 2.5 Turbo."],
    ["kling-v2-1-master", "Kling 2.1 Master", videoTasks, "Publicly documented older model."],
    ["kling-v2-1", "Kling 2.1", ["image-to-video"], "Publicly documented older model; T2V unsupported."],
    ["kling-v2-master", "Kling 2.0 Master", videoTasks, "Publicly documented older model."],
    ["kling-v1-6", "Kling 1.6", [...videoTasks, "video-editing", "video-extension"], "Publicly documented older model."],
    ["kling-v1-5", "Kling 1.5", ["image-to-video", "video-extension"], "Publicly documented older model; T2V unsupported."],
    ["kling-v1", "Kling 1.0", [...videoTasks, "video-extension"], "Publicly documented older model."],
  ] as const).map(([nativeId, displayName, tasks, availabilityNotes]) => entry({ id: `kling/kling/legacy-video-${nativeId}`, nativeId, displayName, aliases: [], providerId: "kling", familyId: "kling", apiSurface: "Kling legacy video API", mediaTypes: ["video"], tasks: [...tasks], providerLifecycle: active, readiness: discovered, availabilityNotes, sourceUrl: KLING_VIDEO })),

  // Kling — specialty endpoint products
  ...([
    ["/v1/images/editing/expand", "Outpainting", ["image"], ["outpainting"], "Guided image expansion across image model versions.", "https://kling.ai/document-api/api/image/common/outpainting.md"],
    ["/v1/general/ai-multi-shot", "AI Multi-Shot", ["image"], ["multi-shot"], "Creates additional subject views from a frontal image.", "https://kling.ai/document-api/api/image/common/subject-completion.md"],
    ["kolors-virtual-try-on-v1", "Virtual Try-On V1", ["image"], ["virtual-try-on"], "Requires a dedicated Virtual Try-On package or balance.", "https://kling.ai/document-api/api/image/virtual-try-on.md"],
    ["kolors-virtual-try-on-v1-5", "Virtual Try-On V1.5", ["image"], ["virtual-try-on"], "Requires dedicated billing; supports upper and lower garment combination.", "https://kling.ai/document-api/api/image/virtual-try-on.md"],
    ["/v1/videos/avatar/image2video", "Kling Avatar", ["video"], ["avatar", "image-to-video"], "Photo plus audio/TTS talking-avatar endpoint with std and pro modes.", "https://kling.ai/document-api/api/video/avatar.md"],
    ["/v1/videos/advanced-lip-sync", "Kling Lip Sync", ["video"], ["lip-sync", "video-editing"], "Currently supports one-person lip sync.", "https://kling.ai/document-api/api/video/lip-sync.md"],
    ["/motion-control/kling-3.0", "Motion Control 3.0", ["video"], ["motion-control", "image-to-video"], "Active API 2.0 motion-control endpoint; marked Hot.", "https://kling.ai/document-api/api/video/motion-control.md"],
    ["/motion-control/kling-2.6", "Motion Control 2.6", ["video"], ["motion-control", "image-to-video"], "Active API 2.0 motion-control endpoint.", "https://kling.ai/document-api/api/video/motion-control/2-6.md"],
  ] as const).map(([nativeId, displayName, mediaTypes, tasks, availabilityNotes, sourceUrl]) => entry({ id: `kling/kling/tool-${nativeId.replaceAll("/", "-").replace(/^-+/, "")}`, nativeId, displayName, aliases: [], providerId: "kling", familyId: "kling", apiSurface: "Kling specialty API", mediaTypes: [...mediaTypes], tasks: [...tasks], providerLifecycle: active, readiness: discovered, availabilityNotes, sourceUrl })),
] as const satisfies readonly ModelCatalogEntry[];

export const MODEL_CATALOG_REGISTRY: Readonly<Record<string, ModelCatalogEntry>> = Object.freeze(
  Object.fromEntries(MODEL_CATALOG.map((model) => [model.id, model])),
);

export const EXECUTABLE_IMAGE_MODEL_NATIVE_IDS = [
  "gpt-image-2",
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
] as const;
export type ExecutableImageModelNativeId = (typeof EXECUTABLE_IMAGE_MODEL_NATIVE_IDS)[number];

export const EXECUTABLE_IMAGE_MODELS = EXECUTABLE_IMAGE_MODEL_NATIVE_IDS.map((nativeId) => {
  const model = MODEL_CATALOG.find((candidate) => candidate.nativeId === nativeId);
  if (!model || !model.execution.integrated || model.readiness !== "ready" || !model.mediaTypes.includes("image")) {
    throw new Error(`Executable image model ${nativeId} is missing a ready catalog entry`);
  }
  return model;
});

export function getCatalogModel(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG_REGISTRY[id];
}

export function getCatalogModelsByFamily(familyId: ModelFamilyId): readonly ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((model) => model.familyId === familyId);
}

export function getCatalogModelsByProvider(providerId: ProviderId): readonly ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((model) => model.providerId === providerId);
}
