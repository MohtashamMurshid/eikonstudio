"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import OpenAI, { toFile } from "openai";
import type { Id } from "./_generated/dataModel";
import { Jimp } from "jimp";
import { builtInSkills, renderSkillPrompt } from "../lib/skill-library";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const;
const GPT_IMAGE_MODEL = "gpt-image-2" as const;

// Cost calculation constants
const COST_FACTORS = {
  basePrice: 0.0025,
  sizeMultiplier: { "1K": 0.8, "2K": 1.0, "4K": 2.0 } as Record<string, number>,
  modeMultiplier: { "text-to-image": 1.0, "image-editing": 1.2 } as Record<string, number>,
};

/** Rough multiplier so dashboard cost reflects pricier OpenAI image calls */
const OPENAI_IMAGE_COST_MULTIPLIER = 1.5;

function calculateCost(imageSize: string = "2K", mode: string = "text-to-image"): number {
  const size = ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "2K";
  const cost =
    COST_FACTORS.basePrice *
    (COST_FACTORS.sizeMultiplier[size] || 1.0) *
    (COST_FACTORS.modeMultiplier[mode] || 1.0);
  return Math.round(cost * 10000) / 10000;
}

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

/**
 * Background action to generate an image (Gemini or OpenAI GPT Image).
 * OpenAI requires OPENAI_API_KEY in Convex environment variables.
 */
export const generateImageBackground = internalAction({
  args: {
    generationId: v.id("generations"),
    prompt: v.string(),
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    apiKey: v.optional(v.string()),
    imageModel: v.union(
      v.literal("gemini-3.1-flash-image-preview"),
      v.literal("gpt-image-2")
    ),
    referenceImageUrls: v.optional(v.array(v.string())),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      generationId,
      prompt,
      mode,
      aspectRatio,
      imageSize,
      apiKey,
      imageModel,
      referenceImageUrls,
      userId,
    } = args;

    try {
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
        }

        for (const [skillName, promptText] of Object.entries(skillPromptMap)) {
          const skillRegex = new RegExp(`\\/${skillName}\\b`, "gi");
          finalPrompt = finalPrompt.replace(skillRegex, promptText);
        }
      }

      console.log("[Image Generation] Final prompt with skills:", finalPrompt);

      let resultBase64: string | null = null;
      let resultMimeType = "image/png";
      let completedModel: string = imageModel;

      if (imageModel === GPT_IMAGE_MODEL) {
        const openaiKey = apiKey || process.env.OPENAI_API_KEY;
        if (!openaiKey) {
          throw new Error(
            "OpenAI API key not configured. Add your own key in Settings or set OPENAI_API_KEY in the Convex environment."
          );
        }

        const openai = new OpenAI({ apiKey: openaiKey });
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
            } catch (e) {
              console.error("Error processing reference image for OpenAI:", e);
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
        const apiKeyToUse = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

        if (!apiKeyToUse) {
          throw new Error("No API key configured");
        }

        const ai = new GoogleGenAI({
          apiKey: apiKeyToUse,
        });

        const aspectRatioString = getAspectRatioString(aspectRatio);

        if (mode === "text-to-image") {
          const response = await ai.models.generateContent({
            model: GEMINI_IMAGE_MODEL,
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
            } catch (e) {
              console.error("Error processing reference image:", e);
            }
          }

          if (imageParts.length === 0) {
            throw new Error("Failed to process reference images");
          }

          const response = await ai.models.generateContent({
            model: GEMINI_IMAGE_MODEL,
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

        completedModel = GEMINI_IMAGE_MODEL;
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

      let estimatedCost = calculateCost(imageSize, mode);
      if (imageModel === GPT_IMAGE_MODEL) {
        estimatedCost = Math.round(estimatedCost * OPENAI_IMAGE_COST_MULTIPLIER * 10000) / 10000;
      }

      await ctx.runMutation(internal.generations.completeGeneration, {
        generationId,
        imageStorageId,
        thumbnailStorageId,
        estimatedCost,
        model: completedModel,
      });

      console.log(`Generation ${generationId} completed successfully`);
    } catch (error) {
      console.error(`Generation ${generationId} failed:`, error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      await ctx.runMutation(internal.generations.failGeneration, {
        generationId,
        errorMessage,
      });
    }
  },
});
