import type { AspectRatio, GenerationMode, ImageSize } from "@eikon/sdk";

export type CliConfig = {
  baseUrl: string;
  apiKey: string;
  defaultImageSize: ImageSize;
  defaultAspectRatio: AspectRatio;
  defaultMode: GenerationMode;
  outputDirectory: string;
};

export type SessionSettings = {
  baseUrl: string;
  apiKey: string;
  imageSize: ImageSize;
  aspectRatio: AspectRatio;
  mode: GenerationMode;
  referenceImages: string[];
};

export type SessionGenerationRecord = {
  id: string;
  createdAt: number;
  prompt: string;
  outputPath: string;
  mode: GenerationMode;
  imageSize: ImageSize;
  aspectRatio: AspectRatio;
};

export type SessionRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  settings: SessionSettings;
  generations: SessionGenerationRecord[];
};

export type ParsedArgs = {
  command: string | null;
  positional: string[];
  flags: Record<string, string | string[] | boolean>;
};
