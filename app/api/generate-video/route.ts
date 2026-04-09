import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";

export async function POST(request: NextRequest) {
  try {
    console.log("Video API: Starting video generation request");

    const formData = await request.formData();

    const prompt = formData.get("prompt") as string;
    const resolution = (formData.get("resolution") as string) || "720p";
    const aspectRatio = (formData.get("aspectRatio") as string) || "16:9";
    const mode = (formData.get("mode") as string) || "text-to-video";
    const apiKey = formData.get("apiKey") as string | undefined;

    const referenceImages: { base64Data: string; mimeType: string }[] = [];
    const imageFiles = formData.getAll("images") as File[];

    if (imageFiles.length > 0) {
      console.log(`Video API: Processing ${imageFiles.length} reference image files`);
      for (const imageFile of imageFiles) {
        const buffer = await imageFile.arrayBuffer();
        referenceImages.push({
          base64Data: Buffer.from(buffer).toString("base64"),
          mimeType: imageFile.type || "image/png",
        });
      }
    }

    console.log("Video API: Prompt:", prompt);
    console.log("Video API: Resolution:", resolution);
    console.log("Video API: Aspect Ratio:", aspectRatio);
    console.log("Video API: Mode:", mode);
    console.log("Video API: Number of reference images:", referenceImages.length);

    // --- Validation ---

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field", details: "'prompt' is required and cannot be empty" },
        { status: 400 },
      );
    }

    const validResolutions = ["720p", "1080p"];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: "Invalid resolution", details: `resolution must be one of: ${validResolutions.join(", ")}` },
        { status: 400 },
      );
    }

    const validAspectRatios = ["16:9", "9:16"];
    if (!validAspectRatios.includes(aspectRatio)) {
      return NextResponse.json(
        { error: "Invalid aspectRatio", details: `aspectRatio must be one of: ${validAspectRatios.join(", ")}` },
        { status: 400 },
      );
    }

    const validModes = ["text-to-video", "image-to-video", "frame-to-video"];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode", details: `mode must be one of: ${validModes.join(", ")}` },
        { status: 400 },
      );
    }

    if ((mode === "image-to-video" || mode === "frame-to-video") && referenceImages.length === 0) {
      return NextResponse.json(
        { error: "Missing reference images", details: `${mode} mode requires at least one reference image` },
        { status: 400 },
      );
    }

    if (mode === "frame-to-video" && referenceImages.length < 2) {
      return NextResponse.json(
        { error: "Missing reference images", details: "frame-to-video mode requires exactly 2 images (first and last frames)" },
        { status: 400 },
      );
    }

    const apiKeyToUse = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKeyToUse) {
      return NextResponse.json(
        { error: "No API key configured", details: "Please provide an apiKey in the request or configure a server-side API key" },
        { status: 401 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });

    let resultUrl: string | null = null;
    let resultDuration: number | undefined;

    // --- Helpers ---

    const pollForCompletion = async (operation: any, maxPolls = 60) => {
      let pollCount = 0;
      while (!operation.done && pollCount < maxPolls) {
        console.log(`Video API: Polling attempt ${pollCount + 1}/${maxPolls}...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
        pollCount++;
      }
      return operation;
    };

    const downloadVideoFromOperation = async (operation: any): Promise<{ url: string; duration: number }> => {
      const generatedVideo = operation.response?.generatedVideos?.[0];
      const video = generatedVideo?.video;
      if (!video) throw new Error("No video data found in response");

      const duration: number = video.duration || 8;

      const tmpPath = join(tmpdir(), `veo-${randomUUID()}.mp4`);
      try {
        await ai.files.download({ file: video, downloadPath: tmpPath });
        const fileBuffer = await readFile(tmpPath);
        const base64Data = fileBuffer.toString("base64");
        return { url: `data:video/mp4;base64,${base64Data}`, duration };
      } finally {
        unlink(tmpPath).catch(() => {});
      }
    };

    // Per Veo 3.1 docs:
    //   text-to-video & extension -> "allow_all"
    //   image-to-video / interpolation / referenceImages -> "allow_adult"
    const personGeneration = mode === "text-to-video" ? "allow_all" : "allow_adult";

    // --- Generate ---

    if (mode === "text-to-video") {
      console.log("Video API: Using text-to-video mode with Veo 3.1");

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

      console.log("Video API: Polling for video generation completion...");
      operation = await pollForCompletion(operation);

      if (!operation.done) throw new Error("Video generation timed out. Please try again.");
      if (operation.error) throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);

      const result = await downloadVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;

    } else if (mode === "image-to-video") {
      console.log("Video API: Using image-to-video mode with Veo 3.1");

      if (referenceImages.length === 0) throw new Error("No valid reference images provided");

      const startingFrame = referenceImages[0];

      // Additional images become Veo 3.1 asset reference images (max 3 per docs)
      const assetRefs = referenceImages.slice(1, 4).map((img) => ({
        image: { imageBytes: img.base64Data, mimeType: img.mimeType },
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
          ...(assetRefs.length > 0 && { referenceImages: assetRefs }),
        },
      });

      console.log("Video API: Polling for image-to-video generation completion...");
      operation = await pollForCompletion(operation);

      if (!operation.done) throw new Error("Video generation timed out. Please try again.");
      if (operation.error) throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);

      const result = await downloadVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;

    } else if (mode === "frame-to-video") {
      console.log("Video API: Using frame-to-video mode (first & last frames) with Veo 3.1");

      if (referenceImages.length < 2) throw new Error("frame-to-video mode requires exactly 2 images (first and last frames)");

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

      console.log("Video API: Polling for frame-to-video generation completion...");
      operation = await pollForCompletion(operation);

      if (!operation.done) throw new Error("Video generation timed out. Please try again.");
      if (operation.error) throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);

      const result = await downloadVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;
    }

    if (!resultUrl) throw new Error("No video generated");

    console.log("Video API: Video generated successfully");

    return NextResponse.json(
      {
        url: resultUrl,
        prompt,
        duration: resultDuration || 8,
        metadata: {
          resolution,
          aspectRatio,
          mode,
          referenceImageCount: referenceImages.length,
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

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { "Content-Type": "application/json" },
  });
}
