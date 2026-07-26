import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";
import { type NextRequest, NextResponse } from "next/server";
import { debug } from "@/lib/debug";

type InlineImage = {
  base64Data: string;
  mimeType: string;
};

const MAX_ASSET_REFERENCES = 3;

async function fileToInlineImage(file: File): Promise<InlineImage> {
  return {
    base64Data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    mimeType: file.type || "image/png",
  };
}

export async function POST(request: NextRequest) {
  try {
    debug("Video API: Starting video generation request");

    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const resolution = (formData.get("resolution") as string) || "720p";
    const aspectRatio = (formData.get("aspectRatio") as string) || "16:9";
    const mode = (formData.get("mode") as string) || "text-to-video";
    const apiKey = formData.get("apiKey") as string | undefined;

    const imageFiles = formData.getAll("images") as File[];
    const characterImageFiles = formData.getAll("characterImages") as File[];
    const referenceImages = await Promise.all(imageFiles.map(fileToInlineImage));
    const characterImages = await Promise.all(
      characterImageFiles.slice(0, 1).map(fileToInlineImage),
    );

    debug("Video API: Prompt:", prompt);
    debug("Video API: Resolution:", resolution);
    debug("Video API: Aspect Ratio:", aspectRatio);
    debug("Video API: Mode:", mode);
    debug("Video API: Number of reference images:", referenceImages.length);
    debug("Video API: Number of character images:", characterImages.length);

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Missing required field",
          details: "'prompt' is required and cannot be empty",
        },
        { status: 400 },
      );
    }

    const validResolutions = ["720p", "1080p"];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        {
          error: "Invalid resolution",
          details: `resolution must be one of: ${validResolutions.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const validAspectRatios = ["16:9", "9:16"];
    if (!validAspectRatios.includes(aspectRatio)) {
      return NextResponse.json(
        {
          error: "Invalid aspectRatio",
          details: `aspectRatio must be one of: ${validAspectRatios.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const validModes = ["text-to-video", "image-to-video", "frame-to-video"];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        {
          error: "Invalid mode",
          details: `mode must be one of: ${validModes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (
      mode === "image-to-video" &&
      referenceImages.length === 0 &&
      characterImages.length === 0
    ) {
      return NextResponse.json(
        {
          error: "Missing reference images",
          details: "image-to-video mode requires a reference image or character avatar",
        },
        { status: 400 },
      );
    }

    if (mode === "frame-to-video" && referenceImages.length < 2) {
      return NextResponse.json(
        {
          error: "Missing reference images",
          details: "frame-to-video mode requires first and last frame images",
        },
        { status: 400 },
      );
    }

    const apiKeyToUse =
      apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKeyToUse) {
      return NextResponse.json(
        {
          error: "No API key configured",
          details:
            "Please provide an apiKey in the request or configure a server-side API key",
        },
        { status: 401 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    let resultUrl: string | null = null;
    let resultDuration: number | undefined;

    const pollForCompletion = async (operation: any, maxPolls = 60) => {
      let pollCount = 0;
      while (!operation.done && pollCount < maxPolls) {
        debug(`Video API: Polling attempt ${pollCount + 1}/${maxPolls}...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
        pollCount++;
      }
      return operation;
    };

    const downloadVideoFromOperation = async (
      operation: any,
    ): Promise<{ url: string; duration: number }> => {
      const generatedVideo = operation.response?.generatedVideos?.[0];
      const video = generatedVideo?.video;
      if (!video) {
        throw new Error("No video data found in response");
      }

      const outputPath = join(tmpdir(), `veo-${randomUUID()}.mp4`);
      try {
        await ai.files.download({ file: video, downloadPath: outputPath });
        const fileBuffer = await readFile(outputPath);
        return {
          url: `data:video/mp4;base64,${fileBuffer.toString("base64")}`,
          duration: video.duration || 8,
        };
      } finally {
        await unlink(outputPath).catch(() => undefined);
      }
    };

    const personGeneration =
      mode === "text-to-video" ? "allow_all" : "allow_adult";

    if (mode === "text-to-video") {
      debug("Video API: Using text-to-video mode with Veo 3.1");

      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt,
        config: {
          numberOfVideos: 1,
          resolution,
          aspectRatio,
          personGeneration,
        },
      });

      operation = await pollForCompletion(operation);
      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }
      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      const result = await downloadVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;
    } else if (mode === "image-to-video") {
      debug("Video API: Using image-to-video mode with Veo 3.1");

      const startingFrame = referenceImages[0] || characterImages[0];
      const remainingUserImages = referenceImages.slice(1);
      const characterReferences =
        referenceImages.length > 0 ? characterImages : [];

      const assetReferences = [
        ...characterReferences,
        ...remainingUserImages,
      ]
        .slice(0, MAX_ASSET_REFERENCES)
        .map((image) => ({
          image: {
            imageBytes: image.base64Data,
            mimeType: image.mimeType,
          },
          referenceType: VideoGenerationReferenceType.ASSET,
        }));

      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt,
        image: {
          imageBytes: startingFrame.base64Data,
          mimeType: startingFrame.mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution,
          aspectRatio,
          personGeneration,
          ...(assetReferences.length > 0 && {
            referenceImages: assetReferences,
          }),
        },
      });

      operation = await pollForCompletion(operation);
      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }
      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      const result = await downloadVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;
    } else if (mode === "frame-to-video") {
      debug("Video API: Using frame-to-video mode with first and last frames");

      const firstFrame = referenceImages[0];
      const lastFrame = referenceImages[1];
      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt,
        image: {
          imageBytes: firstFrame.base64Data,
          mimeType: firstFrame.mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution,
          aspectRatio,
          personGeneration,
          lastFrame: {
            imageBytes: lastFrame.base64Data,
            mimeType: lastFrame.mimeType,
          },
        },
      });

      operation = await pollForCompletion(operation);
      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }
      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      const result = await downloadVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;
    }

    if (!resultUrl) {
      throw new Error("No video generated");
    }

    return NextResponse.json(
      {
        url: resultUrl,
        prompt,
        duration: resultDuration || 8,
        metadata: {
          resolution,
          aspectRatio,
          mode,
          referenceImageCount:
            referenceImages.length + characterImages.length,
          hasAudio: true,
        },
      },
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Video API: Error:", error);

    const errorDetails =
      error && typeof error === "object"
        ? (error as any).body || (error as any).message || JSON.stringify(error)
        : String(error);

    return NextResponse.json(
      { error: "Failed to generate video", details: errorDetails },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Content-Type": "application/json" },
  });
}
