"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import OpenAI, { toFile } from "openai";
import type { Id } from "./_generated/dataModel";
import { Jimp } from "jimp";
import { createHash, randomUUID } from "node:crypto";
import { builtInSkills, renderSkillPrompt } from "../lib/skill-library";
import { estimateImageGenerationCost } from "../lib/image-costs";
import { IMAGE_MODEL_GPT_IMAGE_2 as GPT_IMAGE_MODEL, imageModelValidator } from "./imageModels";
import {
  durableExecutionDecision,
  providerFailureDisposition,
  requireProviderRequestIdentity,
} from "./durableExecutionPolicy";


function getAspectRatioString(ratio: string): string {
  switch (ratio) {
    case "portrait":
      return "9:16";
    case "landscape":
      return "16:9";
    case "wide":
      return "21:9";
    case "square":
    default:
      return "1:1";
  }
}

/**
 * Map studio aspect + resolution to OpenAI Image API size/quality.
 * Uses documented 1K presets; 2K/4K use auto size with medium/high quality.
 */
function openAiSizeAndQuality(
  aspectRatio: string,
  imageSize: string
): {
  size: "auto" | "1024x1024" | "1536x1024" | "1024x1536";
  quality: "low" | "medium" | "high" | "auto";
} {
  const k = ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "2K";
  if (k === "4K") {
    return { size: "auto", quality: "high" };
  }
  if (k === "2K") {
    return { size: "auto", quality: "medium" };
  }
  switch (aspectRatio) {
    case "landscape":
      return { size: "1536x1024", quality: "auto" };
    case "portrait":
      return { size: "1024x1536", quality: "auto" };
    case "wide":
      return { size: "1536x1024", quality: "auto" };
    default:
      return { size: "1024x1024", quality: "auto" };
  }
}

const builtInSkillMap = new Map(
  builtInSkills.map((skillDefinition) => [skillDefinition.name.toLowerCase(), skillDefinition]),
);

/**
 * Parse /skillnames from a prompt and return the skill names
 */
function parseSkillsFromPrompt(prompt: string): string[] {
  const skillPattern = /\/([a-zA-Z0-9-]+)/g;
  const matches = [...prompt.matchAll(skillPattern)];
  return matches.map((m) => m[1].toLowerCase());
}

/**
 * Generate a thumbnail from image buffer using jimp
 */
async function generateThumbnail(imageBuffer: Buffer, size = 250): Promise<Buffer> {
  const image = await Jimp.read(imageBuffer);
  image.contain({ w: size, h: size });
  return await image.getBuffer("image/jpeg", { quality: 70 });
}

async function urlToOpenAiUploadable(
  url: string,
  index: number
): Promise<Awaited<ReturnType<typeof toFile>>> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch reference image: ${url}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const mime = resp.headers.get("content-type") || "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  return await toFile(buf, `ref-${index}.${ext}`, { type: mime });
}

function getGenerationFailureMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "";
  const message = rawMessage.toLowerCase();

  if (
    message.includes("openai api key not configured") ||
    message.includes("no api key configured") ||
    message.includes("credential") ||
    message.includes("authentication") ||
    message.includes("unauthorized") ||
    message.includes("401")
  ) {
    return "Add a valid provider API key in Settings before generating images."
  }

  if (message.includes("rate limit") || message.includes("429")) {
    return "The image provider is rate limited right now. Please wait a moment and try again."
  }

  if (message.includes("reference image")) {
    return "One or more reference images could not be processed. Try re-uploading them and generating again."
  }

  if (
    message.includes("no image data") ||
    message.includes("no candidates returned") ||
    message.includes("no content parts found")
  ) {
    return "The image provider returned an empty response. Please try again."
  }

  if (message.includes("safety") || message.includes("blocked")) {
    return "The request was blocked by the model's safety system. Try a different prompt."
  }

  return "Image generation failed unexpectedly. Please try again."
}

type ExistingImageProvider = "google" | "openai";

type ProviderImageResult = {
  imageBuffer: Buffer;
  mimeType: string;
  completedModel: string;
  providerRequestId?: string;
};

async function executeExistingImageProvider(
  ctx: ActionCtx,
  args: {
    userId: string;
    providerSecret: string;
    credentialProvider: ExistingImageProvider;
    prompt: string;
    mode: "text-to-image" | "image-editing";
    aspectRatio: string;
    imageSize: string;
    imageModel: string;
    referenceImageUrls: string[];
  },
): Promise<ProviderImageResult> {
  let finalPrompt = args.prompt;
  const skillNames = parseSkillsFromPrompt(args.prompt);
  if (skillNames.length > 0) {
    const skillPromptMap: Record<string, string> = {};
    for (const skillName of skillNames) {
      const builtInSkill = builtInSkillMap.get(skillName);
      try {
        const customSkill = await ctx.runQuery(internal.skills.getSkillByNameInternal, {
          userId: args.userId,
          name: skillName,
        });
        if (customSkill) {
          skillPromptMap[skillName] = renderSkillPrompt({
            ...customSkill,
            category: customSkill.category as "style" | "composition" | "brand" | "lighting" | "mood" | "subject" | "other" | undefined,
          });
          continue;
        }
        if (builtInSkill) skillPromptMap[skillName] = renderSkillPrompt(builtInSkill);
      } catch {
        console.error(`[Image Generation] Failed to resolve skill /${skillName}`);
      }
    }
    for (const [skillName, promptText] of Object.entries(skillPromptMap)) {
      finalPrompt = finalPrompt.replace(new RegExp(`\\/${skillName}\\b`, "gi"), promptText);
    }
  }

  let resultBase64: string | null = null;
  let mimeType = "image/png";
  let providerRequestId: string | undefined;

  if (args.imageModel === GPT_IMAGE_MODEL) {
    if (args.credentialProvider !== "openai") throw new Error("Credential provider does not match the selected model");
    const openai = new OpenAI({ apiKey: args.providerSecret, maxRetries: 0, timeout: 240_000 });
    const { size, quality } = openAiSizeAndQuality(args.aspectRatio, args.imageSize);
    if (args.mode === "text-to-image") {
      const wrapped = await openai.images.generate({
        model: GPT_IMAGE_MODEL,
        prompt: finalPrompt,
        n: 1,
        size,
        quality,
        stream: false,
      }).withResponse();
      resultBase64 = wrapped.data.data?.[0]?.b64_json ?? null;
      providerRequestId = wrapped.request_id ?? undefined;
    } else {
      if (args.referenceImageUrls.length === 0) throw new Error("At least one reference image is required for image editing");
      const files: Awaited<ReturnType<typeof toFile>>[] = [];
      for (let index = 0; index < args.referenceImageUrls.length; index++) {
        try {
          files.push(await urlToOpenAiUploadable(args.referenceImageUrls[index], index));
        } catch {
          console.error("Error processing reference image for OpenAI");
        }
      }
      if (files.length === 0) throw new Error("Failed to process reference images");
      const wrapped = await openai.images.edit({
        model: GPT_IMAGE_MODEL,
        image: files.length === 1 ? files[0] : files,
        prompt: finalPrompt,
        n: 1,
        size,
        quality,
        stream: false,
      }).withResponse();
      resultBase64 = wrapped.data.data?.[0]?.b64_json ?? null;
      providerRequestId = wrapped.request_id ?? undefined;
    }
  } else {
    if (args.credentialProvider !== "google") throw new Error("Credential provider does not match the selected model");
    const ai = new GoogleGenAI({ apiKey: args.providerSecret, httpOptions: { timeout: 240_000 } });
    if (args.mode === "text-to-image") {
      const response = await ai.models.generateContent({
        model: args.imageModel,
        contents: { parts: [{ text: finalPrompt }] },
        config: {
          imageConfig: {
            aspectRatio: getAspectRatioString(args.aspectRatio),
            imageSize: args.imageSize,
          } as any,
        },
      });
      providerRequestId = response.responseId;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          resultBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
    } else {
      if (args.referenceImageUrls.length === 0) throw new Error("At least one reference image is required for image editing");
      const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
      for (const url of args.referenceImageUrls) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.byteLength > 25_000_000) {
            console.error("Reference image exceeds the size limit and was skipped");
            continue;
          }
          imageParts.push({
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: response.headers.get("content-type") || "image/png",
            },
          });
        } catch {
          console.error("Error processing reference image");
        }
      }
      if (imageParts.length === 0) throw new Error("Failed to process reference images");
      const response = await ai.models.generateContent({
        model: args.imageModel,
        contents: { parts: [...imageParts, { text: finalPrompt }] },
      });
      providerRequestId = response.responseId;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          resultBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
    }
  }

  if (!resultBase64) throw new Error("No image data in response");
  if (resultBase64.length > 20_000_000) throw new Error("Provider image output is too large");
  return {
    imageBuffer: Buffer.from(resultBase64, "base64"),
    mimeType,
    completedModel: args.imageModel,
    providerRequestId,
  };
}

/**
 * Background action to generate an image (Gemini or OpenAI GPT Image).
 * Credentials are resolved server-side from the owner/provider/handle binding.
 */
export const generateImageBackground = internalAction({
  args: {
    generationId: v.id("generations"),
    credentialHandle: v.string(),
    credentialProvider: v.union(v.literal("google"), v.literal("openai")),
    prompt: v.string(),
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    imageModel: imageModelValidator,
  },
  handler: async (ctx, args) => {
    const {
      generationId,
      credentialHandle,
      credentialProvider,
      prompt,
      mode,
      aspectRatio,
      imageSize,
      imageModel,
    } = args;

    try {
      const execution = await ctx.runQuery(internal.generations.getGenerationExecutionContext, {
        generationId,
        credentialHandle,
        credentialProvider,
      });
      const resolvedCredential = await ctx.runAction(
        internal.credentialActions.resolveCredentialForOperation,
        {
          ownerId: execution.ownerId,
          provider: credentialProvider,
          credentialHandle,
        },
      );
      const providerSecret = resolvedCredential.secretValue;
      const userId = execution.ownerId;
      const referenceImageUrls = execution.referenceImageUrls;
      await ctx.runMutation(internal.generations.updateGenerationStatus, {
        generationId,
        status: "generating",
      });

      let finalPrompt = prompt;
      const skillNames = parseSkillsFromPrompt(prompt);
      if (skillNames.length > 0) {
        const skillPromptMap: Record<string, string> = {};

        for (const skillName of skillNames) {
          const builtInSkill = builtInSkillMap.get(skillName);
          try {
            if (userId) {
              const customSkill = await ctx.runQuery(internal.skills.getSkillByNameInternal, {
                userId,
                name: skillName,
              });
              if (customSkill) {
                skillPromptMap[skillName] = renderSkillPrompt({
                  ...customSkill,
                  category: customSkill.category as "style" | "composition" | "brand" | "lighting" | "mood" | "subject" | "other" | undefined,
                });
                continue;
              }
            }

            if (builtInSkill) {
              skillPromptMap[skillName] = renderSkillPrompt(builtInSkill);
            }
          } catch {
            console.error(`[Image Generation] Failed to resolve skill /${skillName}`);
          }
        }

        for (const [skillName, promptText] of Object.entries(skillPromptMap)) {
          const skillRegex = new RegExp(`\\/${skillName}\\b`, "gi");
          finalPrompt = finalPrompt.replace(skillRegex, promptText);
        }
      }


      let resultBase64: string | null = null;
      let resultMimeType = "image/png";
      let completedModel: string = imageModel;

      if (imageModel === GPT_IMAGE_MODEL) {
        if (credentialProvider !== "openai") {
          throw new Error("Credential provider does not match the selected model");
        }
        const openai = new OpenAI({ apiKey: providerSecret, maxRetries: 0, timeout: 240_000 });
        const { size: openAiSize, quality: openAiQuality } = openAiSizeAndQuality(aspectRatio, imageSize);

        if (mode === "text-to-image") {
          const result = await openai.images.generate({
            model: GPT_IMAGE_MODEL,
            prompt: finalPrompt,
            n: 1,
            size: openAiSize,
            quality: openAiQuality,
            stream: false,
          });

          const b64 = result.data?.[0]?.b64_json;
          if (!b64) {
            throw new Error("No image data in OpenAI response");
          }
          resultBase64 = b64;
        } else {
          if (!referenceImageUrls || referenceImageUrls.length === 0) {
            throw new Error("At least one reference image is required for image editing");
          }

          const files: Awaited<ReturnType<typeof toFile>>[] = [];
          for (let i = 0; i < referenceImageUrls.length; i++) {
            try {
              files.push(await urlToOpenAiUploadable(referenceImageUrls[i], i));
            } catch {
              console.error("Error processing reference image for OpenAI");
            }
          }

          if (files.length === 0) {
            throw new Error("Failed to process reference images");
          }

          const result = await openai.images.edit({
            model: GPT_IMAGE_MODEL,
            image: files.length === 1 ? files[0] : files,
            prompt: finalPrompt,
            n: 1,
            size: openAiSize,
            quality: openAiQuality,
            stream: false,
          });

          const b64 = result.data?.[0]?.b64_json;
          if (!b64) {
            throw new Error("No image data in OpenAI edit response");
          }
          resultBase64 = b64;
        }
      } else {
        if (credentialProvider !== "google") {
          throw new Error("Credential provider does not match the selected model");
        }
        const ai = new GoogleGenAI({
          apiKey: providerSecret,
          httpOptions: { timeout: 240_000 },
        });

        const aspectRatioString = getAspectRatioString(aspectRatio);

        if (mode === "text-to-image") {
          const response = await ai.models.generateContent({
            model: imageModel,
            contents: {
              parts: [{ text: finalPrompt }],
            },
            config: {
              imageConfig: {
                aspectRatio: aspectRatioString,
                imageSize: imageSize,
              } as any,
            },
          });

          if (!response.candidates || response.candidates.length === 0) {
            throw new Error("No candidates returned from Gemini");
          }

          const content = response.candidates[0].content;
          if (!content || !content.parts) {
            throw new Error("No content parts found in response");
          }

          for (const part of content.parts) {
            if (part.inlineData && part.inlineData.data) {
              resultBase64 = part.inlineData.data;
              resultMimeType = part.inlineData.mimeType || "image/png";
              break;
            }
          }
        } else if (mode === "image-editing") {
          if (!referenceImageUrls || referenceImageUrls.length === 0) {
            throw new Error("At least one reference image is required for image editing");
          }

          const imageParts: any[] = [];
          for (const url of referenceImageUrls) {
            try {
              const resp = await fetch(url);
              if (!resp.ok) {
                console.error("Failed to fetch reference image:", url);
                continue;
              }
              const buf = Buffer.from(await resp.arrayBuffer());
              const b64 = buf.toString("base64");
              const mimeType = resp.headers.get("content-type") || "image/png";
              imageParts.push({ inlineData: { data: b64, mimeType } });
            } catch {
              console.error("Error processing reference image");
            }
          }

          if (imageParts.length === 0) {
            throw new Error("Failed to process reference images");
          }

          const response = await ai.models.generateContent({
            model: imageModel,
            contents: {
              parts: [...imageParts, { text: finalPrompt }],
            },
          });

          const parts = response?.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part?.inlineData?.data) {
              resultBase64 = part.inlineData.data;
              resultMimeType = part.inlineData.mimeType || "image/png";
              break;
            }
          }
        }

        completedModel = imageModel;
      }

      if (!resultBase64) {
        throw new Error("No image data in response");
      }

      const imageBuffer = Buffer.from(resultBase64, "base64");
      const thumbnailBuffer = await generateThumbnail(imageBuffer);

      const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: resultMimeType });
      const imageStorageId = await ctx.storage.store(imageBlob);

      const thumbnailBlob = new Blob([new Uint8Array(thumbnailBuffer)], { type: "image/jpeg" });
      const thumbnailStorageId = await ctx.storage.store(thumbnailBlob);

      const estimatedCost = estimateImageGenerationCost(imageSize, mode, imageModel);

      await ctx.runMutation(internal.generations.completeGeneration, {
        generationId,
        imageStorageId,
        thumbnailStorageId,
        estimatedCost,
        model: completedModel,
      });

      console.log(`Generation ${generationId} completed successfully`);
    } catch (error) {
      console.error(`Generation ${generationId} failed`);

      const errorMessage = getGenerationFailureMessage(error);

      await ctx.runMutation(internal.generations.failGeneration, {
        generationId,
        errorMessage,
      });
    }
  },
});

type ExecutionErrorCategory =
  | "authentication"
  | "billing-access"
  | "validation"
  | "rate-limit"
  | "moderation"
  | "provider-unavailable"
  | "timeout"
  | "cancelled"
  | "unknown";

function safeExecutionError(
  code: string,
  message: string,
  category: ExecutionErrorCategory = "unknown",
  retryable = false,
) {
  return {
    category,
    code,
    message,
    retryable,
    correlationId: `corr_${randomUUID()}`,
  };
}

function providerHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}

/** Durable image worker. Scheduler arguments contain only the opaque durable job ID. */
export const generateDurableImageBackground = internalAction({
  args: { jobId: v.id("durableGenerationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const initial = await ctx.runQuery(internal.durableJobs.getScheduledExecutionInternal, { jobId });
    if (!initial) return null;
    if (
      !["completed", "failed", "cancelled", "expired"].includes(initial.job.status) &&
      initial.job.expiresAt <= Date.now()
    ) {
      if (initial.job.submissionState === "ambiguous" || initial.job.cancellationRequested) {
        try {
          await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
            jobId,
            errorMessage: "Image generation requires explicit reconciliation and will not be retried automatically.",
          });
        } catch {
          // The legacy row may already be terminal or unavailable.
        }
        return null;
      }
      try {
        await ctx.runMutation(internal.durableJobs.transition, {
          ownerId: initial.job.ownerId,
          jobId,
          expectedStatus: initial.job.status,
          expectedRevision: initial.job.revision,
          targetStatus: "expired",
          eventId: `expired_${randomUUID()}`,
          eventFingerprint: "maximum-age-reached",
          occurredAt: Date.now(),
        });
      } catch {
        // Another worker may already have terminalized this job.
      }
      try {
        await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
          jobId,
          errorMessage: "Image generation expired before it could complete.",
        });
      } catch {
        // The legacy row may already be terminal or unavailable.
      }
      return null;
    }
    const decision = durableExecutionDecision({
      status: initial.job.status,
      submissionState: initial.job.submissionState,
      durableOutputCount: initial.outputs.length,
    });

    if (decision === "mirror-completed") {
      await ctx.runMutation(internal.generations.mirrorDurableGenerationCompleted, { jobId });
      return null;
    }
    if (decision === "no-op") {
      if (initial.job.status === "submitting" && initial.job.submissionState === "ambiguous") {
        await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
          jobId,
          errorMessage: "The provider outcome is unknown. This request will not be submitted again automatically.",
        });
      } else if (["failed", "cancelled", "expired"].includes(initial.job.status)) {
        await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
          jobId,
          errorMessage: initial.job.publicErrorMessage ?? "Image generation did not complete.",
        });
      }
      return null;
    }

    await ctx.scheduler.runAfter(290_000, internal.imageGeneration.generateDurableImageBackground, { jobId });

    const leaseOwner = "durable-image-worker";
    const leaseToken = `lease_${randomUUID()}`;
    const attemptKey = initial.attempt.attemptKey;
    const submissionKey = `submission:${attemptKey}`;

    const claim = async (status: typeof initial.job.status, revision: number) =>
      await ctx.runMutation(internal.durableJobs.claim, {
        ownerId: initial.job.ownerId,
        jobId,
        attemptKey,
        expectedStatus: status,
        expectedRevision: revision,
        leaseOwner,
        leaseToken,
        leaseDurationMs: 300_000,
        eventId: `claim_${randomUUID()}`,
        occurredAt: Date.now(),
      });

    if (decision === "mark-ambiguous") {
      try {
        const claimed = await claim("submitting", initial.job.revision);
        await ctx.runMutation(internal.durableJobs.recordSubmissionAmbiguous, {
          ownerId: initial.job.ownerId,
          jobId,
          expectedRevision: claimed.revision,
          attemptKey,
          leaseToken,
          leaseEpoch: claimed.leaseEpoch,
          submissionKey,
          eventId: `ambiguous_${randomUUID()}`,
          occurredAt: Date.now(),
        });
        await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
          jobId,
          errorMessage: "The provider outcome is unknown. This request will not be submitted again automatically.",
        });
      } catch {
        // Another live worker owns the lease or has already resolved the state.
      }
      return null;
    }

    if (decision === "fail-without-resubmit") {
      try {
        const claimed = await claim(initial.job.status, initial.job.revision);
        await ctx.runMutation(internal.durableJobs.transition, {
          ownerId: initial.job.ownerId,
          jobId,
          expectedStatus: initial.job.status,
          expectedRevision: claimed.revision,
          attemptKey,
          leaseToken,
          leaseEpoch: claimed.leaseEpoch,
          targetStatus: "failed",
          eventId: `failed_${randomUUID()}`,
          eventFingerprint: "interrupted-after-provider-submission",
          occurredAt: Date.now(),
          error: safeExecutionError(
            "INTERRUPTED_AFTER_PROVIDER_SUBMISSION",
            "Image generation was interrupted after provider submission and will not be retried automatically.",
          ),
        });
        await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
          jobId,
          errorMessage: "Image generation was interrupted after provider submission and was not retried.",
        });
      } catch {
        // Another delivery may have completed the guarded transition.
      }
      return null;
    }

    if (decision === "finalize-durable-output") {
      try {
        const claimed = await claim("persisting", initial.job.revision);
        await ctx.runMutation(internal.durableJobs.finalize, {
          ownerId: initial.job.ownerId,
          jobId,
          expectedRevision: claimed.revision,
          attemptKey,
          leaseToken,
          leaseEpoch: claimed.leaseEpoch,
          outputIds: initial.outputs.map((output) => output._id),
          eventId: `finalize_${randomUUID()}`,
          occurredAt: Date.now(),
        });
        await ctx.runMutation(internal.generations.mirrorDurableGenerationCompleted, { jobId });
      } catch {
        // Another delivery may hold the lease or have finalized already.
      }
      return null;
    }

    if (initial.job.provider !== "google" && initial.job.provider !== "openai") return null;
    if (!initial.generation.imageModel) return null;

    let execution;
    let providerSecret: string;
    try {
      execution = await ctx.runQuery(internal.generations.getGenerationExecutionContext, {
        generationId: initial.generation._id,
        credentialHandle: initial.job.credentialHandle,
        credentialProvider: initial.job.provider,
      });
      const resolved = await ctx.runAction(internal.credentialActions.resolveCredentialForOperation, {
        ownerId: initial.job.ownerId,
        provider: initial.job.provider,
        credentialHandle: initial.job.credentialHandle,
      });
      providerSecret = resolved.secretValue;
    } catch {
      try {
        const preparationClaim = await claim("queued", initial.job.revision);
        await ctx.runMutation(internal.durableJobs.transition, {
          ownerId: initial.job.ownerId,
          jobId,
          expectedStatus: "queued",
          expectedRevision: preparationClaim.revision,
          attemptKey,
          leaseToken,
          leaseEpoch: preparationClaim.leaseEpoch,
          targetStatus: "failed",
          eventId: `preparation_failed_${randomUUID()}`,
          eventFingerprint: "execution-preparation-failed",
          occurredAt: Date.now(),
          error: safeExecutionError(
            "EXECUTION_PREPARATION_FAILED",
            "Image generation could not be prepared securely.",
            "validation",
          ),
        });
        await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
          jobId,
          errorMessage: "Image generation could not be prepared. Check the provider credential and reference images.",
        });
      } catch {
        // Another delivery may own the lease or have already resolved the job.
      }
      return null;
    }

    let claimed;
    try {
      claimed = await claim("queued", initial.job.revision);
    } catch {
      return null;
    }
    const begin = await ctx.runMutation(internal.durableJobs.beginSubmission, {
      ownerId: initial.job.ownerId,
      jobId,
      expectedRevision: claimed.revision,
      attemptKey,
      leaseToken,
      leaseEpoch: claimed.leaseEpoch,
      eventId: `begin_${randomUUID()}`,
      occurredAt: Date.now(),
    });
    try {
      await ctx.runMutation(internal.generations.markDurableGenerationGenerating, { jobId });
    } catch {
      // Legacy read-model mirroring is advisory and must not strand a never-submitted in-flight job.
    }

    let providerResult: ProviderImageResult;
    try {
      providerResult = await executeExistingImageProvider(ctx, {
        userId: initial.job.ownerId,
        providerSecret,
        credentialProvider: initial.job.provider,
        prompt: initial.generation.prompt,
        mode: initial.generation.mode,
        aspectRatio: initial.generation.aspectRatio,
        imageSize: initial.generation.imageSize,
        imageModel: initial.generation.imageModel,
        referenceImageUrls: execution.referenceImageUrls,
      });
    } catch (error) {
      try {
        const renewed = await claim("submitting", begin.revision);
        if (providerFailureDisposition(providerHttpStatus(error)) === "definitive") {
          await ctx.runMutation(internal.durableJobs.transition, {
            ownerId: initial.job.ownerId,
            jobId,
            expectedStatus: "submitting",
            expectedRevision: renewed.revision,
            attemptKey,
            leaseToken,
            leaseEpoch: renewed.leaseEpoch,
            targetStatus: "failed",
            eventId: `rejected_${randomUUID()}`,
            eventFingerprint: "provider-definitive-rejection",
            occurredAt: Date.now(),
            error: safeExecutionError("PROVIDER_REJECTED", getGenerationFailureMessage(error), "validation"),
          });
          await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
            jobId,
            errorMessage: getGenerationFailureMessage(error),
          });
        } else {
          await ctx.runMutation(internal.durableJobs.recordSubmissionAmbiguous, {
            ownerId: initial.job.ownerId,
            jobId,
            expectedRevision: renewed.revision,
            attemptKey,
            leaseToken,
            leaseEpoch: renewed.leaseEpoch,
            submissionKey,
            eventId: `ambiguous_${randomUUID()}`,
            occurredAt: Date.now(),
          });
          await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
            jobId,
            errorMessage: "The provider outcome is unknown. This request will not be submitted again automatically.",
          });
        }
      } catch {
        // Lease expiry/reclaim prevents this worker from writing stale state.
      }
      return null;
    }

    let requestId: string;
    try {
      requestId = requireProviderRequestIdentity(providerResult.providerRequestId);
    } catch {
      try {
        const identityClaim = await claim("submitting", begin.revision);
        await ctx.runMutation(internal.durableJobs.transition, {
          ownerId: initial.job.ownerId,
          jobId,
          expectedStatus: "submitting",
          expectedRevision: identityClaim.revision,
          attemptKey,
          leaseToken,
          leaseEpoch: identityClaim.leaseEpoch,
          targetStatus: "failed",
          eventId: `identity_missing_${randomUUID()}`,
          eventFingerprint: "provider-request-identity-missing",
          occurredAt: Date.now(),
          error: safeExecutionError(
            "PROVIDER_REQUEST_ID_REQUIRED",
            "The provider completed without an auditable request identity; the output was not persisted.",
            "validation",
          ),
        });
        await ctx.runMutation(internal.generations.mirrorDurableGenerationFailure, {
          jobId,
          errorMessage: "The provider response could not be bound to an auditable request identity.",
        });
      } catch {
        // Lease expiry/reclaim prevents this worker from writing stale state.
      }
      return null;
    }

    const renewed = await claim("submitting", begin.revision);
    const accepted = await ctx.runMutation(internal.durableJobs.recordSubmissionAccepted, {
      ownerId: initial.job.ownerId,
      jobId,
      expectedRevision: renewed.revision,
      attemptKey,
      leaseToken,
      leaseEpoch: renewed.leaseEpoch,
      submissionKey,
      providerRequestId: requestId,
      eventId: `accepted_${randomUUID()}`,
      occurredAt: Date.now(),
    });
    const checksumSha256 = createHash("sha256").update(Uint8Array.from(providerResult.imageBuffer)).digest("hex");
    const completion = await ctx.runMutation(internal.durableJobs.recordProviderCompletion, {
      ownerId: initial.job.ownerId,
      jobId,
      expectedRevision: accepted.revision,
      attemptKey,
      leaseToken,
      leaseEpoch: renewed.leaseEpoch,
      providerRequestId: requestId,
      outputIdentityKind: "checksum",
      outputIdentity: checksumSha256,
      eventId: `completion_${randomUUID()}`,
      occurredAt: Date.now(),
    });

    const thumbnailBuffer = await generateThumbnail(providerResult.imageBuffer);
    const imageStorageId = await ctx.storage.store(
      new Blob([new Uint8Array(providerResult.imageBuffer)], { type: providerResult.mimeType }),
    );
    const thumbnailStorageId = await ctx.storage.store(
      new Blob([new Uint8Array(thumbnailBuffer)], { type: "image/jpeg" }),
    );
    const storageRenewal = await claim("persisting", completion.revision);
    const output = await ctx.runMutation(internal.durableJobs.recordDurableOutput, {
      ownerId: initial.job.ownerId,
      jobId,
      expectedRevision: storageRenewal.revision,
      attemptKey,
      leaseToken,
      leaseEpoch: storageRenewal.leaseEpoch,
      completionId: completion.completionId,
      outputKey: `output:${initial.job.jobKey}:1`,
      storageId: imageStorageId,
      thumbnailStorageId,
      mediaType: "image",
      contentType: providerResult.mimeType,
      byteSize: providerResult.imageBuffer.byteLength,
      checksumSha256,
      eventId: `output_${randomUUID()}`,
      occurredAt: Date.now(),
    });
    await ctx.runMutation(internal.durableJobs.finalize, {
      ownerId: initial.job.ownerId,
      jobId,
      expectedRevision: output.revision,
      attemptKey,
      leaseToken,
      leaseEpoch: storageRenewal.leaseEpoch,
      outputIds: [output.outputId],
      eventId: `finalize_${randomUUID()}`,
      occurredAt: Date.now(),
    });
    await ctx.runMutation(internal.generations.mirrorDurableGenerationCompleted, { jobId });
    return null;
  },
});
