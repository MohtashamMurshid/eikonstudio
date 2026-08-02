"use node";

import { createHash, randomBytes } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";

const providerValidator = v.union(v.literal("gemini"), v.literal("openai"));

const providerKeyTestResultValidator = v.object({
  valid: v.boolean(),
  message: v.string(),
});

const gatewayResponseValidator = v.object({
  url: v.string(),
  prompt: v.string(),
  description: v.string(),
  metadata: v.object({
    imageSize: v.string(),
    aspectRatio: v.string(),
    mode: v.literal("text-to-image"),
    provider: providerValidator,
    model: v.string(),
  }),
});

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const;
const OPENAI_IMAGE_MODEL = "gpt-image-2" as const;

type CreatePlatformApiKeyResult = {
  apiKey: string;
  keyPreview: string;
  rotated: boolean;
};

type GatewayImageResult = {
  url: string;
  prompt: string;
  description: string;
  metadata: {
    imageSize: string;
    aspectRatio: string;
    mode: "text-to-image";
    provider: "gemini" | "openai";
    model: string;
  };
};

function hashPlatformApiKey(platformApiKey: string): string {
  return createHash("sha256").update(platformApiKey).digest("hex");
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

function openAiSizeAndQuality(
  aspectRatio: string,
  imageSize: string,
): {
  size: "auto" | "1024x1024" | "1536x1024" | "1024x1536";
  quality: "low" | "medium" | "high" | "auto";
} {
  const normalizedSize = ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "2K";

  if (normalizedSize === "4K") {
    return { size: "auto", quality: "high" };
  }

  if (normalizedSize === "2K") {
    return { size: "auto", quality: "medium" };
  }

  switch (aspectRatio) {
    case "landscape":
    case "wide":
      return { size: "1536x1024", quality: "auto" };
    case "portrait":
      return { size: "1024x1536", quality: "auto" };
    default:
      return { size: "1024x1024", quality: "auto" };
  }
}

export const testProviderApiKey = action({
  args: {
    provider: providerValidator,
    apiKey: v.string(),
  },
  returns: providerKeyTestResultValidator,
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.auth.getCurrentUser, {});
    if (!user) {
      throw new Error("Must be authenticated");
    }

    try {
      if (args.provider === "gemini") {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models?key=${args.apiKey}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          return { valid: true, message: "Gemini API key is valid" };
        }

        const error = (await response.json()) as {
          error?: { message?: string };
        };
        return {
          valid: false,
          message: error.error?.message || "Invalid Gemini API key",
        };
      }

      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
        },
      });

      if (response.ok) {
        return { valid: true, message: "OpenAI API key is valid" };
      }

      const error = (await response.json()) as {
        error?: { message?: string };
      };
      return {
        valid: false,
        message: error.error?.message || "Invalid OpenAI API key",
      };
    } catch {
      return {
        valid: false,
        message: "Failed to verify API key. Please try again.",
      };
    }
  },
});

export const createPlatformApiKey = action({
  args: {},
  returns: v.object({
    apiKey: v.string(),
    keyPreview: v.string(),
    rotated: v.boolean(),
  }),
  handler: async (ctx): Promise<CreatePlatformApiKeyResult> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser, {});
    if (!user) {
      throw new Error("Must be authenticated");
    }
    const apiKey = `eikon_live_${randomBytes(24).toString("hex")}`;
    const keyPrefix = apiKey.slice(0, 18);
    const createdAt = Date.now();

    const rotationResult: { rotated: boolean } = await ctx.runMutation(internal.apiKeys.rotatePlatformApiKeyInternal, {
      userId: user._id,
      keyHash: hashPlatformApiKey(apiKey),
      keyPrefix,
      createdAt,
    });

    return {
      apiKey,
      keyPreview: `${keyPrefix}...`,
      rotated: rotationResult.rotated,
    };
  },
});

export const generateGatewayImage = action({
  args: {
    platformApiKey: v.string(),
    provider: providerValidator,
    prompt: v.string(),
    imageSize: v.string(),
    aspectRatio: v.string(),
    model: v.optional(v.string()),
  },
  returns: gatewayResponseValidator,
  handler: async (ctx, args): Promise<GatewayImageResult> => {
    const platformKey = await ctx.runQuery(
      internal.apiKeys.getPlatformApiKeyByHashInternal,
      {
        keyHash: hashPlatformApiKey(args.platformApiKey),
      },
    );

    if (!platformKey) {
      throw new Error("Invalid API key");
    }

    const providerKey = await ctx.runQuery(internal.apiKeys.getProviderApiKeyInternal, {
      userId: platformKey.userId,
      provider: args.provider,
    });

    if (!providerKey) {
      const providerLabel = args.provider === "gemini" ? "Gemini" : "OpenAI";
      throw new Error(`${providerLabel} is not configured for this account`);
    }

    let resultUrl: string | null = null;
    let model = args.model;

    if (args.provider === "gemini") {
      model = model || GEMINI_IMAGE_MODEL;
      if (model !== GEMINI_IMAGE_MODEL) {
        throw new Error(`Unsupported Gemini model: ${model}`);
      }

      const ai = new GoogleGenAI({
        apiKey: providerKey.apiKey,
      });

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: args.prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: getAspectRatioString(args.aspectRatio),
            imageSize: args.imageSize,
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          resultUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    } else {
      model = model || OPENAI_IMAGE_MODEL;
      if (model !== OPENAI_IMAGE_MODEL) {
        throw new Error(`Unsupported OpenAI model: ${model}`);
      }

      const openai = new OpenAI({ apiKey: providerKey.apiKey });
      const { size, quality } = openAiSizeAndQuality(args.aspectRatio, args.imageSize);
      const response = await openai.images.generate({
        model,
        prompt: args.prompt,
        n: 1,
        size,
        quality,
      });

      const imageBase64 = response.data?.[0]?.b64_json;
      if (imageBase64) {
        resultUrl = `data:image/png;base64,${imageBase64}`;
      }
    }

    if (!resultUrl) {
      throw new Error("No image data returned by provider");
    }

    await ctx.runMutation(internal.apiKeys.markPlatformApiKeyUsedInternal, {
      keyId: platformKey.keyId,
      usedAt: Date.now(),
    });

    return {
      url: resultUrl,
      prompt: args.prompt,
      description: "",
      metadata: {
        imageSize: args.imageSize,
        aspectRatio: args.aspectRatio,
        mode: "text-to-image" as const,
        provider: args.provider,
        model,
      },
    };
  },
});
