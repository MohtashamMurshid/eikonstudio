"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Zap, ImagePlus } from "lucide-react";
import type { VideoMode, ReferenceImage } from "../types";

interface CharacterAvatarPreview {
  name: string;
  url: string;
}

interface PromptBarProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  mode: VideoMode;
  effectiveMode: VideoMode;
  canGenerate: boolean;
  isLoading: boolean;
  estimatedCost: number;
  onGenerate: () => void;
  referenceImages: ReferenceImage[];
  onImageUpload: (file: File, index: number) => void;
  onClearImage: (index: number) => void;
  hasAnyImages: boolean;
  characterAvatarPreviews?: CharacterAvatarPreview[];
}

export function PromptBar({
  prompt,
  onPromptChange,
  mode,
  effectiveMode,
  canGenerate,
  isLoading,
  estimatedCost,
  onGenerate,
  referenceImages,
  onImageUpload,
  onClearImage,
  hasAnyImages,
  characterAvatarPreviews = [],
}: PromptBarProps) {
  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canGenerate && !isLoading) onGenerate();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file, index);
      e.target.value = "";
    }
  };

  const maxImages = mode === "frame-to-video" ? 2 : 3;
  const showImageControls = mode === "image-to-video" || mode === "frame-to-video";
  const hasCharacterAvatars = characterAvatarPreviews.length > 0;

  return (
    <div className="border-t border-border/50 bg-card/50">
      {/* Character avatar thumbnails -- always active as Veo 3.1 referenceImages */}
      {hasCharacterAvatars && (
        <div className="px-4 pt-3 pb-0">
          <div className="flex items-center gap-2.5">
            {characterAvatarPreviews.map((avatar, index) => (
              <div key={`avatar-${index}`} className="relative shrink-0">
                <img
                  src={avatar.url}
                  alt={avatar.name}
                  className="h-12 w-12 object-cover rounded-xl border border-emerald-500/30"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-emerald-900/80 text-emerald-200 text-[8px] text-center py-0.5 rounded-b-xl truncate px-0.5">
                  {avatar.name}
                </span>
              </div>
            ))}
            <span className="text-[10px] text-emerald-400/60 bg-emerald-400/8 px-2.5 py-1 rounded-xl border border-emerald-400/15">
              Asset references
            </span>
          </div>
        </div>
      )}

      {/* Reference image thumbnails */}
      {showImageControls && hasAnyImages && (
        <div className="px-4 pt-3 pb-0">
          <div className="flex items-center gap-2.5">
            {referenceImages.slice(0, maxImages).map((img, index) =>
              img.preview ? (
                <div key={index} className="relative shrink-0 group">
                  <img
                    src={img.preview}
                    alt={`Reference ${index + 1}`}
                    className="h-12 w-12 object-cover rounded-xl border border-border/40"
                  />
                  <button
                    onClick={() => onClearImage(index)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500/90 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all duration-200"
                  >
                    ×
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5 rounded-b-xl">
                    {mode === "frame-to-video" ? (index === 0 ? "First" : "Last") : `Ref ${index + 1}`}
                  </span>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Prompt input row */}
      <div className="flex items-end gap-2.5 p-4">
        {/* Image upload button */}
        {showImageControls && (
          <button
            onClick={() => {
              const nextSlot = referenceImages.findIndex((img) => !img.file);
              if (nextSlot !== -1 && nextSlot < maxImages) {
                fileInputRefs[nextSlot].current?.click();
              }
            }}
            className="shrink-0 p-2.5 rounded-2xl bg-secondary/25 hover:bg-secondary/40 text-foreground/40 hover:text-foreground transition-all duration-200"
            title="Add reference image"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
        )}

        {/* Prompt textarea */}
        <div className="flex-1 relative">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "text-to-video"
                ? "Describe the action in your scene..."
                : mode === "image-to-video"
                ? "Describe how to animate the image..."
                : "Describe the transition between frames..."
            }
            rows={1}
            className="w-full min-h-[44px] max-h-[120px] px-4 py-2.5 bg-secondary/15 border border-border/40 rounded-2xl text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/15 resize-none transition-colors duration-200"
            style={{ fontSize: "14px", lineHeight: "1.5" }}
          />
        </div>

        {/* Generate button */}
        <div className="shrink-0 flex items-center gap-2.5">
          <span className="text-[11px] text-foreground/25 hidden sm:block tabular-nums">
            ~${estimatedCost.toFixed(3)}
          </span>
          <Button
            onClick={onGenerate}
            disabled={!canGenerate || isLoading}
            className="h-[44px] w-[44px] rounded-2xl bg-foreground text-background hover:bg-foreground/90 p-0 transition-all duration-200"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      {[0, 1, 2].map((index) => (
        <input
          key={index}
          ref={fileInputRefs[index]}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(e, index)}
          className="hidden"
        />
      ))}
    </div>
  );
}
