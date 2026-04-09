"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Logo } from "@/components/logo";
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import type { VideoCombinerProps, VideoMode, VideoResolution, VideoAspectRatio, Character } from "./types";
import { useToast } from "./hooks/use-toast";
import { useVideoUpload } from "./hooks/use-video-upload";
import { useVideoGeneration } from "./hooks/use-video-generation";
import { useVideoActions } from "./hooks/use-video-actions";
import { calculateVideoCost } from "@/lib/video-cost-calculator";
import { buildVideoPrompt } from "@/lib/prompt-builder";
import { ScenePanel } from "./components/scene-panel";
import { StudioCanvas } from "./components/studio-canvas";
import { PromptBar } from "./components/prompt-bar";

export function VideoCombiner({ apiKey }: VideoCombinerProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<VideoMode>("text-to-video");
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [resolution, setResolution] = useState<VideoResolution>("720p");

  // Scene state
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);
  const [location, setLocation] = useState("");
  const [mood, setMood] = useState("");

  // Panel state
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const { toast, showToast } = useToast();

  const generateUploadUrl = useMutation(api.videoGenerations.generateUploadUrl);
  const saveVideoGeneration = useMutation(api.videoGenerations.saveVideoGeneration);

  const videoUpload = useVideoUpload();

  // Collect avatar URLs from selected characters that have them
  const characterAvatars = selectedCharacters
    .filter((c) => c.avatarUrl)
    .map((c) => ({ url: c.avatarUrl!, name: c.name }));

  const videoGeneration = useVideoGeneration({
    apiKey,
    mode,
    referenceImages: videoUpload.getImageFiles(),
    prompt: buildVideoPrompt({
      characters: selectedCharacters,
      location: location || undefined,
      mood: mood || undefined,
      action: prompt,
    }),
    aspectRatio,
    resolution,
    characterAvatars,
    onError: (message) => showToast(message, "error"),
    generateUploadUrl,
    onSaveVideoGeneration: async (params) => {
      await saveVideoGeneration(params);
    },
    onSaveError: (message) => showToast(message, "warning"),
  });

  const videoActions = useVideoActions({
    generatedVideo: videoGeneration.generatedVideo,
    onError: (message) => showToast(message, "error"),
    onSuccess: (message) => showToast(message, "success"),
  });

  const handleToggleCharacter = useCallback((character: Character) => {
    setSelectedCharacters((prev) => {
      const exists = prev.find((c) => c._id === character._id);
      if (exists) return prev.filter((c) => c._id !== character._id);
      if (prev.length >= 3) return prev;
      return [...prev, character];
    });
  }, []);

  const hasCharacterImages = characterAvatars.length > 0;

  // Text mode uses character descriptions in the prompt text.
  // Image mode additionally sends avatar images as Veo style references.
  const effectiveMode: VideoMode = mode;

  const canGenerate =
    prompt.trim().length > 0 &&
    (mode === "text-to-video" ||
      (mode === "image-to-video" && (videoUpload.hasAnyImages || hasCharacterImages)) ||
      (mode === "frame-to-video" &&
        !!videoUpload.referenceImages[0].file &&
        !!videoUpload.referenceImages[1].file));

  const handleGenerate = () => {
    if (!canGenerate) return;
    videoGeneration.generateVideo();
  };

  const handleModeChange = (newMode: VideoMode) => {
    setMode(newMode);
    if (newMode === "text-to-video") videoUpload.clearAllImages();
  };

  const refCount = videoUpload.getImageFiles().filter((f) => f !== null).length;
  const estimatedCost = calculateVideoCost(resolution, mode, refCount);

  const scenePanelContent = (
    <ScenePanel
      selectedCharacters={selectedCharacters}
      onToggleCharacter={handleToggleCharacter}
      location={location}
      onLocationChange={setLocation}
      mood={mood}
      onMoodChange={setMood}
      mode={mode}
      effectiveMode={effectiveMode}
      onModeChange={handleModeChange}
      resolution={resolution}
      onResolutionChange={setResolution}
      aspectRatio={aspectRatio}
      onAspectRatioChange={setAspectRatio}
    />
  );

  return (
    <div className="select-none flex flex-col h-full">
      {/* Toast */}
      {toast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 text-white ${
            toast.type === "success"
              ? "bg-emerald-500"
              : toast.type === "error"
              ? "bg-red-500"
              : toast.type === "warning"
              ? "bg-amber-500"
              : "bg-blue-500"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Studio Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3">
          {/* Desktop panel toggle */}
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="hidden lg:flex p-1.5 rounded-xl hover:bg-secondary/40 text-foreground/40 hover:text-foreground transition-all duration-200"
            title={panelOpen ? "Collapse panel" : "Expand panel"}
          >
            {panelOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
          {/* Mobile scene setup button */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 text-foreground/50 hover:text-foreground text-xs transition-all duration-200"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Scene Setup
          </button>
          <Logo
            variant="default"
            size="sm"
            colorScheme="dark"
            className="opacity-50 hover:opacity-80 transition-opacity duration-300"
          />
          <span className="text-xs font-medium text-foreground/25 hidden sm:block">
            Cinema Studio
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {selectedCharacters.length > 0 && (
            <span className="text-[11px] text-foreground/35">
              {selectedCharacters.length} cast
            </span>
          )}
          {location && (
            <span className="text-[11px] text-foreground/35 hidden sm:block truncate max-w-[120px]">
              {location}
            </span>
          )}
        </div>
      </div>

      {/* Main body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel -- desktop */}
        {panelOpen && (
          <div className="hidden lg:flex w-[280px] shrink-0 border-r border-border/60 bg-card/30 flex-col overflow-hidden">
            {scenePanelContent}
          </div>
        )}

        {/* Mobile drawer overlay */}
        {mobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-card border-r border-border/60 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border/60">
                <span className="text-sm font-medium text-foreground">Scene Setup</span>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-secondary/40 text-foreground/40 hover:text-foreground transition-all duration-200"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{scenePanelContent}</div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 flex flex-col bg-background/50 overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <StudioCanvas
              isLoading={videoGeneration.isLoading}
              progress={videoGeneration.progress}
              progressStage={videoGeneration.progressStage}
              generatedVideo={videoGeneration.generatedVideo}
              isSaving={videoGeneration.isSaving}
              onNewVideo={() => videoGeneration.setGeneratedVideo(null)}
              onDownload={videoActions.downloadVideoFile}
              onCopyUrl={videoActions.copyVideoUrl}
            />
          </div>

          {/* Bottom prompt bar */}
          <PromptBar
            prompt={prompt}
            onPromptChange={setPrompt}
            mode={mode}
            effectiveMode={effectiveMode}
            canGenerate={canGenerate}
            isLoading={videoGeneration.isLoading}
            estimatedCost={estimatedCost}
            onGenerate={handleGenerate}
            referenceImages={videoUpload.referenceImages}
            onImageUpload={(file, index) => videoUpload.handleImageUpload(file, index)}
            onClearImage={(index) => videoUpload.clearImage(index)}
            hasAnyImages={videoUpload.hasAnyImages}
            characterAvatarPreviews={characterAvatars}
          />
        </div>
      </div>
    </div>
  );
}
