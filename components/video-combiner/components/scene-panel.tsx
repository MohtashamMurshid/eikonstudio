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
    <div className="flex bg-secondary/30 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
            value === opt.value
              ? "bg-foreground text-background shadow-sm"
              : "text-foreground/50 hover:text-foreground/70"
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
  onModeChange,
  resolution,
  onResolutionChange,
  aspectRatio,
  onAspectRatioChange,
}: ScenePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-5 p-3">
        {/* Cast */}
        <CharacterLibrary
          selectedCharacters={selectedCharacters}
          onToggleCharacter={onToggleCharacter}
        />

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Scene */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-medium text-foreground/50 uppercase tracking-wider">
            Scene
          </h3>

          <div>
            <label className="text-[10px] text-foreground/40 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location
            </label>
            <textarea
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="A rain-soaked Tokyo alley at midnight, neon signs reflecting in puddles..."
              rows={2}
              className="w-full px-2.5 py-2 bg-secondary/20 border border-border/50 rounded-lg text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-foreground/40 mb-1 flex items-center gap-1">
              <Palette className="w-3 h-3" /> Mood
            </label>
            <Select value={mood} onValueChange={onMoodChange}>
              <SelectTrigger className="h-8 bg-secondary/20 border-border/50 text-xs w-full">
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
        <div className="h-px bg-border" />

        {/* Settings */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-medium text-foreground/50 uppercase tracking-wider">
            Settings
          </h3>

          <div>
            <label className="text-[10px] text-foreground/40 mb-1.5 block">Mode</label>
            <SegmentedControl
              value={mode}
              options={[
                { value: "text-to-video" as const, label: "Text" },
                { value: "image-to-video" as const, label: "Image" },
                { value: "frame-to-video" as const, label: "Frames" },
              ]}
              onChange={onModeChange}
            />
          </div>

          <div>
            <label className="text-[10px] text-foreground/40 mb-1.5 block">Aspect Ratio</label>
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
            <label className="text-[10px] text-foreground/40 mb-1.5 block">Resolution</label>
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
