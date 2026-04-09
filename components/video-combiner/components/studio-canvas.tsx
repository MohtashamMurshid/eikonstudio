"use client";

import { Film, Download, Copy, Plus } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";
import { VideoPlayer } from "@/components/ui/video-player";
import type { GeneratedVideo } from "../types";

interface StudioCanvasProps {
  isLoading: boolean;
  progress: number;
  progressStage: string;
  generatedVideo: GeneratedVideo | null;
  isSaving: boolean;
  onNewVideo: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
}

function EmptyCanvas() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div className="w-20 h-20 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center mb-5">
        <Film className="w-8 h-8 text-foreground/20" />
      </div>
      <h3 className="text-lg font-medium text-foreground/60 mb-2">
        Direct your scene
      </h3>
      <p className="text-sm text-foreground/30 max-w-sm">
        Set up your cast and location in the scene panel, describe the action, and generate your cinematic video.
      </p>
    </div>
  );
}

function ProgressCanvas({ progress, progressStage }: { progress: number; progressStage: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <div className="relative mb-8">
        <svg className="w-36 h-36 transform -rotate-90">
          <circle
            className="text-foreground/5"
            strokeWidth="3"
            stroke="currentColor"
            fill="transparent"
            r="64"
            cx="72"
            cy="72"
          />
          <circle
            className="text-foreground transition-all duration-500 ease-out"
            strokeWidth="3"
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="64"
            cx="72"
            cy="72"
            strokeDasharray={`${2 * Math.PI * 64}`}
            strokeDashoffset={`${2 * Math.PI * 64 * (1 - progress / 100)}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 bg-foreground rounded-2xl flex items-center justify-center">
            <LogoIcon className="w-11 h-11 text-background" />
          </div>
        </div>
      </div>
      <span className="text-3xl font-semibold text-foreground mb-2 tabular-nums">
        {Math.round(progress)}%
      </span>
      <p className="text-sm text-foreground/50">{progressStage}</p>
    </div>
  );
}

function VideoCanvas({
  video,
  isSaving,
  onNewVideo,
  onDownload,
  onCopyUrl,
}: {
  video: GeneratedVideo;
  isSaving: boolean;
  onNewVideo: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/50">Generated Video</span>
          {isSaving && (
            <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
              <div className="w-3 h-3 border-2 border-foreground/20 border-t-foreground/50 rounded-full animate-spin" />
              Saving...
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewVideo}
            className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground/70 hover:text-foreground text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
          <button
            onClick={onDownload}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-foreground/50 hover:text-foreground transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onCopyUrl}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-foreground/50 hover:text-foreground transition-colors"
            title="Copy URL"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center rounded-xl overflow-hidden bg-black/20">
        <VideoPlayer
          src={video.url}
          autoPlay
          loop
          className="rounded-xl w-full"
          maxHeight="calc(100vh - 320px)"
        />
      </div>

      {/* Metadata */}
      <div className="mt-3 p-3 bg-secondary/20 rounded-xl">
        <p className="text-xs text-foreground/60 line-clamp-2">
          <span className="font-medium text-foreground/80">Prompt:</span> {video.prompt}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-foreground/40">
          <span>{video.metadata?.resolution || "720p"}</span>
          <span>{video.metadata?.aspectRatio || "16:9"}</span>
          <span>{video.duration || 8}s</span>
          {video.metadata?.hasAudio && <span>Audio</span>}
        </div>
      </div>
    </div>
  );
}

export function StudioCanvas({
  isLoading,
  progress,
  progressStage,
  generatedVideo,
  isSaving,
  onNewVideo,
  onDownload,
  onCopyUrl,
}: StudioCanvasProps) {
  if (isLoading) {
    return <ProgressCanvas progress={progress} progressStage={progressStage} />;
  }

  if (generatedVideo) {
    return (
      <VideoCanvas
        video={generatedVideo}
        isSaving={isSaving}
        onNewVideo={onNewVideo}
        onDownload={onDownload}
        onCopyUrl={onCopyUrl}
      />
    );
  }

  return <EmptyCanvas />;
}
