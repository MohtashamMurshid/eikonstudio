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

    console.log("Video API: Prompt:", prompt);
    console.log("Video API: Resolution:", resolution);
    console.log("Video API: Aspect Ratio:", aspectRatio);
    console.log("Video API: Mode:", mode);
    console.log("Video API: Number of reference images:", referenceImages.length);

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

    if ((mode === "image-to-video" || mode === "frame-to-video") && referenceImages.length === 0) {
      console.log(`Video API: ${mode} mode requires at least one reference image`);
      return NextResponse.json(
        {
          error: "Missing reference images",
          details: `${mode} mode requires at least one reference image`,
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

    // Helper function to convert image data to inline part
    const toInlinePart = async (urlOrData: string): Promise<any> => {
      if (urlOrData.startsWith("data:")) {
        const [meta, base64Data] = urlOrData.split(",", 2);
        const mime = meta.substring(5, meta.indexOf(";")) || "image/png";
        return { inlineData: { data: base64Data, mimeType: mime } };
      }
      const resp = await fetch(urlOrData);
      if (!resp.ok)
        throw new Error(`Failed to fetch reference image: ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const b64 = buf.toString("base64");
      return {
        inlineData: {
          data: b64,
          mimeType: resp.headers.get("content-type") || "image/png",
        },
      };
    };

    if (mode === "text-to-video") {
      console.log("Video API: Using text-to-video mode with Veo 3.1");

      // Official Google structure for text-to-video
      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
        },
      });

      console.log("Video API: Polling for video generation completion...");

      // Poll the operation status until the video is ready
      // Veo typically takes 30-120 seconds for 8-second videos
      let pollCount = 0;
      const maxPolls = 60; // 10 minutes max (10 seconds per poll)

      while (!operation.done && pollCount < maxPolls) {
        console.log(`Video API: Polling attempt ${pollCount + 1}/${maxPolls}...`);
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

        operation = await ai.operations.getVideosOperation({
          operation: operation,
        });

        pollCount++;
      }

      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }

      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      // Extract video data from completed operation
      if (operation.response?.generatedVideos && operation.response.generatedVideos.length > 0) {
        const generatedVideo = operation.response.generatedVideos[0];
        const video = generatedVideo.video;

        if (video && video.uri) {
          // Fetch the actual video file using the URI + API key
          const videoUri = decodeURIComponent(video.uri);
          console.log("Video API: Fetching video from:", videoUri);

          const videoResponse = await fetch(`${videoUri}&key=${apiKeyToUse}`);

          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
          }

          const videoBlob = await videoResponse.blob();
          const buffer = Buffer.from(await videoBlob.arrayBuffer());
          const base64Data = buffer.toString("base64");
          resultUrl = `data:video/mp4;base64,${base64Data}`;

          console.log("Video API: Successfully fetched and converted video to base64");
        }

        resultDuration = video?.duration || 8;
      }

      if (!resultUrl) {
        console.error("Video API: Failed to extract video URL. Operation:", JSON.stringify(operation, null, 2));
        throw new Error("No video data found in response");
      }
    } else if (mode === "image-to-video") {
      console.log("Video API: Using image-to-video mode with Veo 3.1");

      // Convert reference images to the official format
      const referenceImagesPayload: any[] = [];

      for (const img of referenceImages) {
        if (img) {
          try {
            const buffer = await img.arrayBuffer();
            const base64Data = Buffer.from(buffer).toString("base64");

            referenceImagesPayload.push({
              image: {
                imageBytes: base64Data,
                mimeType: img.type,
              },
              referenceType: "ASSET", // or "STYLE" for style transfer
            });
          } catch (e) {
            console.log("Video API: Skipping invalid reference image:", e);
          }
        }
      }

      if (referenceImagesPayload.length === 0) {
        throw new Error("No valid reference images provided");
      }

      // Official Google structure for image-to-video with references
      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
          referenceImages: referenceImagesPayload,
        },
      });

      console.log("Video API: Polling for image-to-video generation completion...");

      let pollCount = 0;
      const maxPolls = 60;

      while (!operation.done && pollCount < maxPolls) {
        console.log(`Video API: Polling attempt ${pollCount + 1}/${maxPolls}...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));

        operation = await ai.operations.getVideosOperation({
          operation: operation,
        });

        pollCount++;
      }

      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }

      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      // Extract and fetch video from operation.response.generatedVideos
      if (operation.response?.generatedVideos && operation.response.generatedVideos.length > 0) {
        const generatedVideo = operation.response.generatedVideos[0];
        const video = generatedVideo.video;

        if (video && video.uri) {
          const videoUri = decodeURIComponent(video.uri);
          console.log("Video API: Fetching image-to-video from:", videoUri);

          const videoResponse = await fetch(`${videoUri}&key=${apiKeyToUse}`);

          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
          }

          const videoBlob = await videoResponse.blob();
          const buffer = Buffer.from(await videoBlob.arrayBuffer());
          const base64Data = buffer.toString("base64");
          resultUrl = `data:video/mp4;base64,${base64Data}`;

          console.log("Video API: Successfully fetched and converted image-to-video to base64");
        }

        resultDuration = video?.duration || 8;
      }

      if (!resultUrl) {
        console.error("Video API: Failed to extract video URL. Operation:", JSON.stringify(operation, null, 2));
        throw new Error("No video data found in response");
      }
    } else if (mode === "frame-to-video") {
      console.log("Video API: Using frame-to-video mode (first & last frames) with Veo 3.1");

      if (!referenceImages[0] || !referenceImages[1]) {
        throw new Error("frame-to-video mode requires exactly 2 images (first and last frames)");
      }

      // Convert first frame
      const firstFrameBuffer = await referenceImages[0].arrayBuffer();
      const firstFrameBase64 = Buffer.from(firstFrameBuffer).toString("base64");

      // Convert last frame
      const lastFrameBuffer = await referenceImages[1].arrayBuffer();
      const lastFrameBase64 = Buffer.from(lastFrameBuffer).toString("base64");

      // Enhanced prompt for frame interpolation
      const framePrompt = `${prompt}. Create a smooth video transition between the two frames.`;

      // Official Google structure for frame-to-video
      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: framePrompt,
        image: {
          imageBytes: firstFrameBase64,
          mimeType: referenceImages[0].type,
        },
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
          lastFrame: {
            imageBytes: lastFrameBase64,
            mimeType: referenceImages[1].type,
          },
        },
      });

      console.log("Video API: Polling for frame-to-video generation completion...");

      let pollCount = 0;
      const maxPolls = 60;

      while (!operation.done && pollCount < maxPolls) {
        console.log(`Video API: Polling attempt ${pollCount + 1}/${maxPolls}...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));

        operation = await ai.operations.getVideosOperation({
          operation: operation,
        });

        pollCount++;
      }

      if (!operation.done) {
        throw new Error("Video generation timed out. Please try again.");
      }

      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
      }

      // Extract and fetch video from operation.response.generatedVideos
      if (operation.response?.generatedVideos && operation.response.generatedVideos.length > 0) {
        const generatedVideo = operation.response.generatedVideos[0];
        const video = generatedVideo.video;

        if (video && video.uri) {
          const videoUri = decodeURIComponent(video.uri);
          console.log("Video API: Fetching frame-to-video from:", videoUri);

          const videoResponse = await fetch(`${videoUri}&key=${apiKeyToUse}`);

          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
          }

          const videoBlob = await videoResponse.blob();
          const buffer = Buffer.from(await videoBlob.arrayBuffer());
          const base64Data = buffer.toString("base64");
          resultUrl = `data:video/mp4;base64,${base64Data}`;

          console.log("Video API: Successfully fetched and converted frame-to-video to base64");
        }

        resultDuration = video?.duration || 8;
      }

      if (!resultUrl) {
        console.error("Video API: Failed to extract video URL. Operation:", JSON.stringify(operation, null, 2));
        throw new Error("No video data found in response");
      }
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
