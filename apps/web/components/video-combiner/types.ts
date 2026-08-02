import type { Id } from "@/convex/_generated/dataModel";

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

export interface ReferenceImage {
  file: File | null;
  preview: string | null;
}

// Soul Cast character types

export interface CharacterAppearance {
  gender?: string;
  age?: string;
  height?: string;
  eyeColor?: string;
  hairColor?: string;
  hairStyle?: string;
  skinTone?: string;
  facialHair?: string;
  build?: string;
}

export interface Character {
  _id: Id<"characters">;
  userId: string;
  name: string;
  genre?: string;
  archetype?: string;
  appearance: CharacterAppearance;
  outfit?: string;
  details?: string;
  avatarStorageId?: Id<"_storage">;
  avatarUrl?: string | null;
  createdAt: number;
}

export interface SceneSettings {
  location: string;
  mood: string;
  selectedCharacters: Character[];
}

export const MOOD_OPTIONS = [
  "Cinematic",
  "Dramatic",
  "Mysterious",
  "Romantic",
  "Action",
  "Horror",
  "Comedy",
  "Melancholic",
  "Ethereal",
  "Noir",
  "Epic",
  "Peaceful",
] as const;

export const GENRE_OPTIONS = [
  "Sci-Fi",
  "Fantasy",
  "Noir",
  "Western",
  "Horror",
  "Romance",
  "Thriller",
  "Comedy",
  "Drama",
  "Action",
  "Documentary",
  "Anime",
] as const;

export const ARCHETYPE_OPTIONS = [
  "Hero",
  "Villain",
  "Mentor",
  "Sidekick",
  "Anti-Hero",
  "Femme Fatale",
  "Trickster",
  "Explorer",
  "Guardian",
  "Rebel",
] as const;
