import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    console.log("Video API: Starting video generation request");

    const formData = await request.formData();

    const prompt = formData.get("prompt") as string;
    const resolution = (formData.get("resolution") as string) || "720p";
    const aspectRatio = (formData.get("aspectRatio") as string) || "16:9";
    const mode = (formData.get("mode") as string) || "text-to-video";
    const apiKey = formData.get("apiKey") as string | undefined;

    // Handle reference images for image-to-video and frame-to-video modes
    const referenceImages: string[] = [];
    const imageFiles = formData.getAll("images") as File[];

    if (imageFiles.length > 0) {
      console.log(`Video API: Processing ${imageFiles.length} reference image files`);
      for (const imageFile of imageFiles) {
        const buffer = await imageFile.arrayBuffer();
        const base64 = `data:${imageFile.type};base64,${Buffer.from(buffer).toString("base64")}`;
        referenceImages.push(base64);
      }
    }

    // Handle Soul Cast character avatar images (Veo 3.1 referenceImages with "asset" type)
    const characterImageFiles = formData.getAll("characterImages") as File[];
    const characterImages: { base64Data: string; mimeType: string }[] = [];

    if (characterImageFiles.length > 0) {
      console.log(`Video API: Processing ${characterImageFiles.length} character avatar files`);
      for (const charImage of characterImageFiles) {
        const buffer = await charImage.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");
        const mimeType = charImage.type || "image/png";
        characterImages.push({ base64Data, mimeType });
      }
    }

    console.log("Video API: Prompt:", prompt);
    console.log("Video API: Resolution:", resolution);
    console.log("Video API: Aspect Ratio:", aspectRatio);
    console.log("Video API: Mode:", mode);
    console.log("Video API: Number of reference images:", referenceImages.length);
    console.log("Video API: Number of character images:", characterImages.length);

    // Validation
    if (!prompt || prompt.trim().length === 0) {
      console.log("Video API: Missing required field: prompt");
      return NextResponse.json(
        {
          error: "Missing required field",
          details: "'prompt' is required and cannot be empty",
        },
        { status: 400 }
      );
    }

    const validResolutions = ["720p", "1080p"];
    if (!validResolutions.includes(resolution)) {
      console.log("Video API: Invalid resolution:", resolution);
      return NextResponse.json(
        {
          error: "Invalid resolution",
          details: `resolution must be one of: ${validResolutions.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const validAspectRatios = ["16:9", "9:16"];
    if (!validAspectRatios.includes(aspectRatio)) {
      console.log("Video API: Invalid aspectRatio:", aspectRatio);
      return NextResponse.json(
        {
          error: "Invalid aspectRatio",
          details: `aspectRatio must be one of: ${validAspectRatios.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const validModes = ["text-to-video", "image-to-video", "frame-to-video"];
    if (!validModes.includes(mode)) {
      console.log("Video API: Invalid mode:", mode);
      return NextResponse.json(
        {
          error: "Invalid mode",
          details: `mode must be one of: ${validModes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if ((mode === "image-to-video" || mode === "frame-to-video") && referenceImages.length === 0 && characterImageFiles.length === 0) {
      console.log(`Video API: ${mode} mode requires at least one reference image or character image`);
      return NextResponse.json(
        {
          error: "Missing reference images",
          details: `${mode} mode requires at least one reference image or character avatar`,
        },
        { status: 400 }
      );
    }

    if (mode === "frame-to-video" && referenceImages.length < 2) {
      console.log("Video API: frame-to-video mode requires exactly 2 images (first & last frame)");
      return NextResponse.json(
        {
          error: "Missing reference images",
          details: "frame-to-video mode requires exactly 2 images (first and last frames)",
        },
        { status: 400 }
      );
    }

    const apiKeyToUse = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKeyToUse) {
      console.log("Video API: No API key available");
      return NextResponse.json(
        {
          error: "No API key configured",
          details:
            "Please provide an apiKey in the request or configure a server-side API key",
        },
        { status: 401 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: apiKeyToUse,
    });

    let resultUrl: string | null = null;
    let resultDuration: number | undefined;

    // Helper function to extract base64 data and mime type from data URL
    const parseDataUrl = (dataUrl: string): { base64Data: string; mimeType: string } => {
      const [meta, base64Data] = dataUrl.split(",", 2);
      const mimeType = meta.substring(5, meta.indexOf(";")) || "image/png";
      return { base64Data, mimeType };
    };

    // Helper function to poll for video generation completion
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

    // Helper function to extract video from operation response
    const extractVideoFromOperation = async (operation: any): Promise<{ url: string; duration: number }> => {
      if (operation.response?.generatedVideos && operation.response.generatedVideos.length > 0) {
        const generatedVideo = operation.response.generatedVideos[0];
        const video = generatedVideo.video;

        if (video && video.uri) {
          const videoUri = decodeURIComponent(video.uri);
          console.log("Video API: Fetching video from:", videoUri);

          const videoResponse = await fetch(`${videoUri}&key=${apiKeyToUse}`);
          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
          }

          const videoBlob = await videoResponse.blob();
          const buffer = Buffer.from(await videoBlob.arrayBuffer());
          const base64Data = buffer.toString("base64");
          
          return {
            url: `data:video/mp4;base64,${base64Data}`,
            duration: video.duration || 8,
          };
        }
      }
      throw new Error("No video data found in response");
    };

    // Build Veo 3.1 referenceImages payload from Soul Cast character avatars
    const characterReferenceImages: any[] = characterImages.map((img) => ({
      image: {
        imageBytes: img.base64Data,
        mimeType: img.mimeType,
      },
      referenceType: "asset",
    }));

    if (mode === "text-to-video") {
      console.log("Video API: Using text-to-video mode with Veo 3.1");
      if (characterReferenceImages.length > 0) {
        console.log(`Video API: Including ${characterReferenceImages.length} character reference image(s)`);
      }

      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
          ...(characterReferenceImages.length > 0 && { referenceImages: characterReferenceImages }),
        },
      });

      console.log("Video API: Polling for video generation completion...");
      operation = await pollForCompletion(operation);

      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }
      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      const result = await extractVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;
      console.log("Video API: Successfully fetched and converted video to base64");

    } else if (mode === "image-to-video") {
      console.log("Video API: Using image-to-video mode with Veo 3.1");

      if (referenceImages.length === 0 && characterImages.length === 0) {
        throw new Error("No valid reference images or character images provided");
      }

      // Determine the starting frame: user-uploaded image first, else first character avatar
      let startingFrame: { base64Data: string; mimeType: string };
      let remainingUserImages: string[] = [];

      if (referenceImages.length > 0) {
        startingFrame = parseDataUrl(referenceImages[0]);
        remainingUserImages = referenceImages.slice(1);
      } else {
        // Use first character avatar as starting frame, rest stay as references
        startingFrame = characterImages[0];
        console.log("Video API: Using first character avatar as starting frame");
      }

      console.log("Video API: Starting frame mime type:", startingFrame.mimeType);

      // Build reference images from remaining user images + character avatars
      // (skip the first character avatar if it was used as starting frame)
      const allReferenceImages: any[] = [];
      const charRefsToUse = referenceImages.length > 0
        ? characterReferenceImages
        : characterReferenceImages.slice(1);
      allReferenceImages.push(...charRefsToUse);

      for (const imgDataUrl of remainingUserImages) {
        const parsed = parseDataUrl(imgDataUrl);
        allReferenceImages.push({
          image: {
            imageBytes: parsed.base64Data,
            mimeType: parsed.mimeType,
          },
          referenceType: "asset",
        });
      }

      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: prompt,
        image: {
          imageBytes: startingFrame.base64Data,
          mimeType: startingFrame.mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
          ...(allReferenceImages.length > 0 && { referenceImages: allReferenceImages }),
        },
      });

      console.log("Video API: Polling for image-to-video generation completion...");
      operation = await pollForCompletion(operation);

      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }
      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      const result = await extractVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;
      console.log("Video API: Successfully fetched and converted image-to-video to base64");

    } else if (mode === "frame-to-video") {
      console.log("Video API: Using frame-to-video mode (first & last frames) with Veo 3.1");

      if (referenceImages.length < 2) {
        throw new Error("frame-to-video mode requires exactly 2 images (first and last frames)");
      }

      // Parse first and last frame images
      const firstFrame = parseDataUrl(referenceImages[0]);
      const lastFrame = parseDataUrl(referenceImages[1]);

      console.log("Video API: First frame mime type:", firstFrame.mimeType);
      console.log("Video API: Last frame mime type:", lastFrame.mimeType);

      // Enhanced prompt for frame interpolation
      const framePrompt = `${prompt}. Create a smooth video transition between the two frames.`;

      // Official Google structure for frame-to-video using image + lastFrame
      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: framePrompt,
        image: {
          imageBytes: firstFrame.base64Data,
          mimeType: firstFrame.mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
          lastFrame: {
            imageBytes: lastFrame.base64Data,
            mimeType: lastFrame.mimeType,
          },
        },
      });

      console.log("Video API: Polling for frame-to-video generation completion...");
      operation = await pollForCompletion(operation);

      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }
      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      const result = await extractVideoFromOperation(operation);
      resultUrl = result.url;
      resultDuration = result.duration;
      console.log("Video API: Successfully fetched and converted frame-to-video to base64");
    }

    if (!resultUrl) {
      throw new Error("No video generated");
    }

    console.log("Video API: Video generated successfully");

    return NextResponse.json(
      {
        url: resultUrl,
        prompt: prompt,
        duration: resultDuration || 8, // Veo typically generates 8-second videos
        metadata: {
          resolution: resolution,
          aspectRatio: aspectRatio,
          mode: mode,
          referenceImageCount: referenceImages.length,
          hasAudio: true, // Veo videos include audio
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Video API: Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorDetails =
      error && typeof error === "object"
        ? (error as any).body || (error as any).message || JSON.stringify(error)
        : String(error);

    return NextResponse.json(
      {
        error: "Failed to generate video",
        details: errorDetails,
      },
      {
        status: 500,
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
