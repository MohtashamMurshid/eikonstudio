import { downloadVideo } from "@/lib/video-utilities";
import type { GeneratedVideo } from "../types";

interface UseVideoActionsOptions {
  generatedVideo: GeneratedVideo | null;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export const useVideoActions = (options: UseVideoActionsOptions) => {
  const { generatedVideo, onError, onSuccess } = options;

  const downloadVideoFile = async () => {
    if (!generatedVideo?.url) return;

    try {
      const filename = `video-${Date.now()}.mp4`;
      downloadVideo(generatedVideo.url, filename);
      onSuccess?.("Video downloaded successfully");
    } catch (error) {
      console.error("Error downloading video:", error);
      onError?.("Failed to download video");
    }
  };

  const copyVideoUrl = async () => {
    if (!generatedVideo?.url) return;

    try {
      await navigator.clipboard.writeText(generatedVideo.url);
      onSuccess?.("Video URL copied to clipboard");
    } catch (error) {
      console.error("Error copying video URL:", error);
      onError?.("Failed to copy video URL");
    }
  };

  return {
    downloadVideoFile,
    copyVideoUrl,
  };
};
