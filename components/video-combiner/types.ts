export interface GeneratedVideo {
  url: string;
  prompt: string;
  duration?: number;
  metadata?: {
    resolution: string;
    aspectRatio: string;
    mode: VideoMode;
    referenceImageCount?: number;
    hasAudio?: boolean;
  };
}

export type VideoMode = "text-to-video" | "image-to-video" | "frame-to-video";

export type VideoResolution = "720p" | "1080p";

export type VideoAspectRatio = "16:9" | "9:16";

export interface VideoCombinerProps {
  apiKey: string;
}

export interface ReferenceImage {
  file: File | null;
  preview: string | null;
}
