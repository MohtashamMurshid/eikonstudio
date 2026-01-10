"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import type { Id } from "./_generated/dataModel";
import { Jimp } from "jimp";

// Cost calculation constants
const COST_FACTORS = {
  basePrice: 0.0025,
  sizeMultiplier: { "1K": 0.8, "2K": 1.0, "4K": 2.0 } as Record<string, number>,
  modeMultiplier: { "text-to-image": 1.0, "image-editing": 1.2 } as Record<string, number>,
};

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

// Predefined skills - must match the client-side constants for consistency
// These are checked first before querying user's custom skills
const PREDEFINED_SKILLS: Record<string, string> = {
  technical: "technical diagram, precise line work, labeled components, engineering schematic style, clean white background, professional technical illustration, blueprint aesthetic, detailed annotations, isometric or orthographic projection",
  infographic: "infographic design, data visualization, clean modern layout, bold typography, icon-based illustrations, color-coded sections, statistical charts, visual hierarchy, professional presentation style, flat design elements",
  anime: "anime art style, vibrant colors, detailed line work, expressive eyes, dynamic poses, cel shading, Japanese animation aesthetic, clean outlines, dramatic lighting",
  portrait: "professional portrait photography, soft studio lighting, shallow depth of field, catchlights in eyes, neutral background, high-end fashion photography style, sharp focus on subject",
  cinematic: "cinematic composition, dramatic lighting, anamorphic lens flare, film grain, movie still quality, 35mm film aesthetic, wide aspect ratio, depth and atmosphere",
  minimal: "minimalist design, clean lines, simple composition, negative space, limited color palette, geometric shapes, modern aesthetic, uncluttered layout",
  watercolor: "watercolor painting, soft edges, wet-on-wet technique, transparent washes, paper texture visible, organic color blending, artistic imperfections, traditional media aesthetic",
  "3d": "3D render, octane render quality, volumetric lighting, subsurface scattering, high polygon count, realistic materials, studio lighting setup, professional 3D visualization",
  pixel: "pixel art, 16-bit style, limited color palette, crisp edges, retro gaming aesthetic, dithering techniques, nostalgic video game art, sprite-like quality",
  sketch: "pencil sketch, hand-drawn illustration, crosshatching, graphite texture, artistic linework, rough edges, traditional drawing style, sketchbook aesthetic",
};

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
  // Read the image from buffer
  const image = await Jimp.read(imageBuffer);
  
  // Resize to fit within size x size while maintaining aspect ratio
  image.contain({ w: size, h: size });
  
  // Get the buffer as JPEG with quality
  return await image.getBuffer("image/jpeg", { quality: 70 });
}

/**
 * Background action to generate an image using Google GenAI
 * This runs server-side and cannot be canceled by the client
 */
export const generateImageBackground = internalAction({
  args: {
    generationId: v.id("generations"),
    prompt: v.string(),
    mode: v.union(v.literal("text-to-image"), v.literal("image-editing")),
    aspectRatio: v.string(),
    imageSize: v.string(),
    artStyle: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    // Reference image URLs for image-editing mode (from Convex storage)
    referenceImageUrls: v.optional(v.array(v.string())),
    // User ID for looking up custom skills
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      generationId,
      prompt,
      mode,
      aspectRatio,
      imageSize,
      artStyle,
      apiKey,
      referenceImageUrls,
      userId,
    } = args;

    try {
      // Update status to generating
      await ctx.runMutation(internal.generations.updateGenerationStatus, {
        generationId,
        status: "generating",
      });

      // Use provided API key or fall back to environment variable
      const apiKeyToUse = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

      if (!apiKeyToUse) {
        throw new Error("No API key configured");
      }

      const ai = new GoogleGenAI({
        apiKey: apiKeyToUse,
      });

      const aspectRatioString = getAspectRatioString(aspectRatio);

      // Build the final prompt
      let finalPrompt = prompt;

      // Parse and append skill prompts
      const skillNames = parseSkillsFromPrompt(prompt);
      if (skillNames.length > 0) {
        const skillPrompts: string[] = [];

        for (const skillName of skillNames) {
          // First check predefined skills
          if (PREDEFINED_SKILLS[skillName]) {
            skillPrompts.push(PREDEFINED_SKILLS[skillName]);
          } else if (userId) {
            // Check user's custom skills in the database
            const customSkill = await ctx.runQuery(internal.skills.getSkillByNameInternal, {
              userId,
              name: skillName,
            });
            if (customSkill) {
              skillPrompts.push(customSkill.promptText);
            }
          }
        }

        // Append all skill prompts to the final prompt
        if (skillPrompts.length > 0) {
          finalPrompt = `${finalPrompt}, ${skillPrompts.join(", ")}`;
        }
      }

      // Add art style if provided
      if (artStyle) {
        const styleText = artStyle.toLowerCase().includes("style")
          ? artStyle
          : `${artStyle} style`;
        finalPrompt = `${finalPrompt}, in ${styleText}`;
      }

      let resultBase64: string | null = null;
      let resultMimeType = "image/png";

      if (mode === "text-to-image") {
        // Text-to-image generation
        const response = await ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
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

        // Find the image in response parts
        for (const part of content.parts) {
          if (part.inlineData && part.inlineData.data) {
            resultBase64 = part.inlineData.data;
            resultMimeType = part.inlineData.mimeType || "image/png";
            break;
          }
        }
      } else if (mode === "image-editing") {
        // Image editing mode - need reference images
        if (!referenceImageUrls || referenceImageUrls.length === 0) {
          throw new Error("At least one reference image is required for image editing");
        }

        // Build image parts from reference URLs
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
          model: "gemini-3-pro-image-preview",
          contents: {
            parts: [...imageParts, { text: finalPrompt }],
          },
        });

        // Extract image from response
        const parts = response?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part?.inlineData?.data) {
            resultBase64 = part.inlineData.data;
            resultMimeType = part.inlineData.mimeType || "image/png";
            break;
          }
        }
      }

      if (!resultBase64) {
        throw new Error("No image data in response");
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(resultBase64, "base64");

      // Generate thumbnail using sharp
      const thumbnailBuffer = await generateThumbnail(imageBuffer);

      // Store image in Convex storage
      // Convert Buffer to Uint8Array for Blob compatibility
      const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: resultMimeType });
      const imageStorageId = await ctx.storage.store(imageBlob);

      // Store thumbnail in Convex storage
      const thumbnailBlob = new Blob([new Uint8Array(thumbnailBuffer)], { type: "image/jpeg" });
      const thumbnailStorageId = await ctx.storage.store(thumbnailBlob);

      // Calculate cost
      const estimatedCost = calculateCost(imageSize, mode);

      // Update the generation record with completed status and image data
      await ctx.runMutation(internal.generations.completeGeneration, {
        generationId,
        imageStorageId,
        thumbnailStorageId,
        estimatedCost,
        model: "gemini-3-pro-image-preview",
      });

      console.log(`Generation ${generationId} completed successfully`);
    } catch (error) {
      console.error(`Generation ${generationId} failed:`, error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // Update the generation record with failed status
      await ctx.runMutation(internal.generations.failGeneration, {
        generationId,
        errorMessage,
      });
    }
  },
});
