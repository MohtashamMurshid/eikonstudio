import type { Id } from "@/convex/_generated/dataModel";

/**
 * Convert data URL to Blob
 * @param dataUrl - The data URL to convert
 * @returns The blob
 */
export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return await response.blob();
};

/**
 * Extract a frame from a video at a specific time and return as Blob
 * @param videoUrl - The video URL or data URL
 * @param time - The time in seconds to extract the frame (default: 0 for first frame)
 * @param size - The size of the thumbnail (default: 250)
 * @returns Promise<Blob> - The extracted frame as a JPEG blob
 */
export const extractVideoFrame = async (
  videoUrl: string,
  time: number = 0,
  size: number = 250
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    // Set up video element
    video.onloadedmetadata = () => {
      // Ensure time is within video duration
      const seekTime = Math.min(time, video.duration - 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Calculate dimensions to maintain aspect ratio
        let width = size;
        let height = size;

        if (video.videoWidth > video.videoHeight) {
          height = (video.videoHeight / video.videoWidth) * size;
        } else {
          width = (video.videoWidth / video.videoHeight) * size;
        }

        canvas.width = size;
        canvas.height = size;

        // Center the frame
        const x = (size - width) / 2;
        const y = (size - height) / 2;

        // Fill with white background
        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(0, 0, size, size);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw video frame
        ctx.drawImage(video, x, y, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Could not create blob from canvas"));
            }
          },
          "image/jpeg",
          0.8
        );
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error("Could not load video"));
    };

    video.src = videoUrl;
  });
};

/**
 * Generate a full-size thumbnail from the first frame of a video
 * @param videoUrl - The video URL or data URL
 * @returns Promise<Blob> - The extracted frame as a JPEG blob
 */
export const generateVideoThumbnailFull = async (
  videoUrl: string
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      video.currentTime = 0; // First frame
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Use video's native resolution
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw full video frame
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Could not create blob from canvas"));
            }
          },
          "image/jpeg",
          0.9 // Higher quality for full-size thumbnail
        );
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error("Could not load video"));
    };

    video.src = videoUrl;
  });
};

/**
 * Upload blob to Convex storage
 * @param blob - The blob to upload
 * @param generateUploadUrl - Function to generate upload URL
 * @returns The storage ID
 */
export const uploadVideoToStorage = async (
  blob: Blob,
  generateUploadUrl: () => Promise<string>
): Promise<Id<"_storage">> => {
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const { storageId } = await response.json();
  return storageId;
};

/**
 * Get video duration from URL
 * @param videoUrl - The video URL
 * @returns Promise<number> - Duration in seconds
 */
export const getVideoDuration = async (videoUrl: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      resolve(video.duration);
    };

    video.onerror = () => {
      reject(new Error("Could not load video"));
    };

    video.src = videoUrl;
  });
};

/**
 * Check if video has audio track
 * @param videoUrl - The video URL
 * @returns Promise<boolean> - True if video has audio
 */
export const videoHasAudio = async (videoUrl: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      // Check if video has audio tracks
      const hasAudio = video.mozHasAudio ||
        Boolean(video.webkitAudioDecodedByteCount) ||
        Boolean(video.audioTracks && video.audioTracks.length > 0);

      resolve(hasAudio);
    };

    video.onerror = () => {
      resolve(false); // Assume no audio on error
    };

    video.src = videoUrl;
  });
};

/**
 * Download video file
 * @param videoUrl - The video URL
 * @param filename - The filename to save as
 */
export const downloadVideo = (videoUrl: string, filename: string = "video.mp4") => {
  const link = document.createElement("a");
  link.href = videoUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
