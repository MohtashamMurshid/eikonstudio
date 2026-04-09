import { useState } from "react";
import type { GeneratedVideo, VideoMode } from "../types";
import type { Id } from "@/convex/_generated/dataModel";
import { extractVideoFrame, dataUrlToBlob, uploadVideoToStorage } from "@/lib/video-utilities";

interface SaveVideoGenerationParams {
  prompt: string;
  videoStorageId: Id<"_storage">;
  thumbnailStorageId: Id<"_storage">;
  mode: VideoMode;
  aspectRatio: string;
  resolution: string;
  duration?: number;
  referenceImageStorageIds?: Id<"_storage">[];
  hasAudio?: boolean;
}

interface CharacterAvatar {
  url: string;
  name: string;
}

interface UseVideoGenerationOptions {
  apiKey: string;
  mode: VideoMode;
  referenceImages: Array<File | null>;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  characterAvatars?: CharacterAvatar[];
  onError?: (message: string) => void;
  generateUploadUrl: () => Promise<string>;
  onSaveVideoGeneration?: (params: SaveVideoGenerationParams) => Promise<void>;
  onSaveError?: (message: string) => void;
}

const MAX_REFERENCE_IMAGES = 3;

export const useVideoGeneration = (options: UseVideoGenerationOptions) => {
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const generateVideo = async () => {
    const {
      mode,
      referenceImages,
      prompt,
      aspectRatio,
      resolution,
      apiKey,
      characterAvatars,
      onError,
      generateUploadUrl,
    } = options;

    if (!prompt.trim()) {
      onError?.("Please enter a prompt");
      return;
    }

    const hasCharacterAvatars = characterAvatars && characterAvatars.length > 0;

    if ((mode === "image-to-video" || mode === "frame-to-video") && !referenceImages[0] && !hasCharacterAvatars) {
      onError?.(`${mode} mode requires at least one reference image`);
      return;
    }

    if (mode === "frame-to-video" && !referenceImages[1]) {
      onError?.("frame-to-video mode requires two images (first and last frames)");
      return;
    }

    setIsLoading(true);
    setGeneratedVideo(null);
    setProgress(0);
    setProgressStage("Initializing...");

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return Math.min(prev + 0.05, 98);
        if (prev >= 80) return prev + 0.2;
        if (prev >= 60) return prev + 0.4;
        if (prev >= 40) return prev + 0.6;
        if (prev >= 20) return prev + 0.8;
        return prev + 1.0;
      });
    }, 500);

    try {
      setProgressStage("Preparing request...");

      // Veo 3.1 reference images are for a single subject (person/character/product).
      // When the user selects multiple characters we only send the first one's avatar
      // as a reference image and rely on the prompt for additional cast members.
      const avatarFiles: File[] = [];
      if (hasCharacterAvatars && mode === "image-to-video") {
        setProgressStage("Loading character avatar...");
        const avatar = characterAvatars![0];
        try {
          const response = await fetch(avatar.url);
          const blob = await response.blob();
          const ext = blob.type.split("/")[1] || "png";
          avatarFiles.push(new File([blob], `${avatar.name}.${ext}`, { type: blob.type }));
        } catch (err) {
          console.warn(`Failed to fetch avatar for ${avatar.name}:`, err);
        }
      }

      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("prompt", prompt);
      formData.append("aspectRatio", aspectRatio);
      formData.append("resolution", resolution);
      if (apiKey) {
        formData.append("apiKey", apiKey);
      }

      if (mode === "image-to-video") {
        setProgressStage("Uploading reference images...");
        let imageCount = 0;
        avatarFiles.forEach((file) => {
          if (imageCount < MAX_REFERENCE_IMAGES + 1) {
            formData.append("images", file);
            imageCount++;
          }
        });
        referenceImages.forEach((img) => {
          if (img && imageCount < MAX_REFERENCE_IMAGES + 1) {
            formData.append("images", img);
            imageCount++;
          }
        });
      } else if (mode === "frame-to-video") {
        setProgressStage("Uploading frame images...");
        if (referenceImages[0]) formData.append("images", referenceImages[0]);
        if (referenceImages[1]) formData.append("images", referenceImages[1]);
      }

      setProgressStage("Generating video...");
      setProgress(20);

      const response = await fetch("/api/generate-video", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          `${errorData.error}${errorData.details ? `: ${errorData.details}` : ""}`
        );
      }

      setProgressStage("Processing video...");
      setProgress(90);

      const data = await response.json();
      clearInterval(progressInterval);

      setProgress(100);
      setProgressStage("Complete!");

      setGeneratedVideo(data);
      setIsLoading(false);
      setProgress(0);
      setProgressStage("");

      if (options.onSaveVideoGeneration) {
        setIsSaving(true);
        setProgressStage("Saving to history...");

        try {
          const videoBlob = await dataUrlToBlob(data.url);

          setProgressStage("Creating thumbnail...");
          const thumbnailBlob = await extractVideoFrame(data.url, 0, 250);

          let referenceImageStorageIds: Id<"_storage">[] | undefined;
          if (mode === "image-to-video" || mode === "frame-to-video") {
            setProgressStage("Uploading reference images...");
            const refIds: Id<"_storage">[] = [];
            for (const img of referenceImages) {
              if (img) {
                const imgBlob = new Blob([await img.arrayBuffer()], {
                  type: img.type,
                });
                const refId = await uploadVideoToStorage(imgBlob, generateUploadUrl);
                refIds.push(refId);
              }
            }
            if (refIds.length > 0) {
              referenceImageStorageIds = refIds;
            }
          }

          setProgressStage("Uploading to cloud storage...");
          const [videoStorageId, thumbnailStorageId] = await Promise.all([
            uploadVideoToStorage(videoBlob, generateUploadUrl),
            uploadVideoToStorage(thumbnailBlob, generateUploadUrl),
          ]);

          await options.onSaveVideoGeneration!({
            prompt,
            videoStorageId,
            thumbnailStorageId,
            mode,
            aspectRatio,
            resolution,
            duration: data.duration,
            referenceImageStorageIds,
            hasAudio: data.metadata?.hasAudio,
          });

          setIsSaving(false);
          setProgressStage("");
        } catch (saveError) {
          console.error("Error saving video generation to storage:", saveError);
          setIsSaving(false);
          setProgressStage("");
          options.onSaveError?.(
            "Failed to save to history. Please download the video manually."
          );
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      setProgress(0);
      setProgressStage("");
      console.error("Error generating video:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      onError?.(`Error generating video: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  return {
    generatedVideo,
    isLoading,
    progress,
    progressStage,
    isSaving,
    generateVideo,
    setGeneratedVideo,
  };
};
