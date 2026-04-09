"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Palette } from "lucide-react";
import type { Character, VideoMode, VideoResolution, VideoAspectRatio } from "../types";
import { MOOD_OPTIONS } from "../types";
import { CharacterLibrary } from "./character-library";

interface ScenePanelProps {
  selectedCharacters: Character[];
  onToggleCharacter: (character: Character) => void;
  location: string;
  onLocationChange: (value: string) => void;
  mood: string;
  onMoodChange: (value: string) => void;
  mode: VideoMode;
  effectiveMode: VideoMode;
  onModeChange: (mode: VideoMode) => void;
  resolution: VideoResolution;
  onResolutionChange: (res: VideoResolution) => void;
  aspectRatio: VideoAspectRatio;
  onAspectRatioChange: (ratio: VideoAspectRatio) => void;
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex bg-secondary/20 rounded-xl p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1.5 rounded-[10px] text-[11px] font-medium transition-all duration-200 ${
            value === opt.value
              ? "bg-foreground text-background shadow-sm"
              : "text-foreground/40 hover:text-foreground/60"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ScenePanel({
  selectedCharacters,
  onToggleCharacter,
  location,
  onLocationChange,
  mood,
  onMoodChange,
  mode,
  effectiveMode,
  onModeChange,
  resolution,
  onResolutionChange,
  aspectRatio,
  onAspectRatioChange,
}: ScenePanelProps) {
  const hasCharacterAvatars = selectedCharacters.some((c) => c.avatarUrl);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-5 p-4">
        {/* Cast */}
        <CharacterLibrary
          selectedCharacters={selectedCharacters}
          onToggleCharacter={onToggleCharacter}
        />

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Scene */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-wider">
            Scene
          </h3>

          <div>
            <label className="text-[10px] text-foreground/35 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location
            </label>
            <textarea
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="A rain-soaked Tokyo alley at midnight, neon signs reflecting in puddles..."
              rows={2}
              className="w-full px-3 py-2 bg-secondary/15 border border-border/40 rounded-xl text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/15 resize-none transition-colors duration-200"
            />
          </div>

          <div>
            <label className="text-[10px] text-foreground/35 mb-1 flex items-center gap-1">
              <Palette className="w-3 h-3" /> Mood
            </label>
            <Select value={mood} onValueChange={onMoodChange}>
              <SelectTrigger className="h-8 bg-secondary/15 border-border/40 rounded-xl text-xs w-full">
                <SelectValue placeholder="Select mood..." />
              </SelectTrigger>
              <SelectContent>
                {MOOD_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Settings */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-wider">
            Settings
          </h3>

          <div>
            <label className="text-[10px] text-foreground/35 mb-1.5 block">Mode</label>
            <SegmentedControl
              value={mode}
              options={[
                { value: "text-to-video" as const, label: "Text" },
                { value: "image-to-video" as const, label: "Image" },
                { value: "frame-to-video" as const, label: "Frames" },
              ]}
              onChange={onModeChange}
            />
            {hasCharacterAvatars && (
              <p className="mt-1.5 text-[10px] text-emerald-400/80 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Soul Cast avatars will be sent as asset references
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-foreground/35 mb-1.5 block">Aspect Ratio</label>
            <SegmentedControl
              value={aspectRatio}
              options={[
                { value: "16:9" as const, label: "16:9" },
                { value: "9:16" as const, label: "9:16" },
              ]}
              onChange={onAspectRatioChange}
            />
          </div>

          <div>
            <label className="text-[10px] text-foreground/35 mb-1.5 block">Resolution</label>
            <SegmentedControl
              value={resolution}
              options={[
                { value: "720p" as const, label: "720p" },
                { value: "1080p" as const, label: "1080p" },
              ]}
              onChange={onResolutionChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
