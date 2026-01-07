"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/logo";
import { LogoIcon } from "@/components/logo-icon";
import type { VideoCombinerProps, VideoMode, VideoResolution, VideoAspectRatio, GeneratedVideo } from "./types";
import { useToast } from "./hooks/use-toast";
import { useVideoUpload } from "./hooks/use-video-upload";
import { useVideoGeneration } from "./hooks/use-video-generation";
import { useVideoActions } from "./hooks/use-video-actions";
import { calculateVideoCost } from "@/lib/video-cost-calculator";

export function VideoCombiner({ apiKey }: VideoCombinerProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<VideoMode>("text-to-video");
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [resolution, setResolution] = useState<VideoResolution>("720p");

  const { toast, showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Convex mutations
  const generateUploadUrl = useMutation(api.videoGenerations.generateUploadUrl);
  const saveVideoGeneration = useMutation(api.videoGenerations.saveVideoGeneration);

  const videoUpload = useVideoUpload();

  const videoGeneration = useVideoGeneration({
    apiKey,
    mode,
    referenceImages: videoUpload.getImageFiles(),
    prompt,
    aspectRatio,
    resolution,
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

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      videoUpload.handleImageUpload(file, index);
      e.target.value = "";
    }
  };

  const canGenerate = prompt.trim().length > 0 &&
    (mode === "text-to-video" || (mode === "image-to-video" && videoUpload.hasAnyImages) || (mode === "frame-to-video" && videoUpload.referenceImages[0].file && videoUpload.referenceImages[1].file));

  const handleGenerate = () => {
    if (!canGenerate) return;
    videoGeneration.generateVideo();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canGenerate && !videoGeneration.isLoading) {
        handleGenerate();
      }
    }
  };

  const refCount = videoUpload.getImageFiles().filter(f => f !== null).length;
  const estimatedCost = calculateVideoCost(resolution, mode, refCount);

  const isGenerating = videoGeneration.isLoading || videoGeneration.generatedVideo;

  return (
    <div className="select-none flex flex-col min-h-[calc(100vh-200px)]">
      {/* Toast */}
      {toast.visible && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          toast.type === "success" ? "bg-emerald-500" :
          toast.type === "error" ? "bg-red-500" :
          toast.type === "warning" ? "bg-amber-500" :
          "bg-blue-500"
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-0 sm:px-4 items-center transition-[padding] duration-500 ease-out"
        style={{
          paddingTop: isGenerating ? '2rem' : 'max(2rem, calc((100vh - 400px) / 2 - 100px))',
        }}
      >

        {/* Input Container */}
        <div className="w-full transition-all duration-500 ease-out">
          {/* Subtle Logo Branding */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <Logo
              variant="default"
              size="sm"
              colorScheme="dark"
              className="opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm transition-all duration-500 ease-out">
            {/* Reference Image Previews (for image-to-video and frame-to-video) */}
            {(mode === "image-to-video" || mode === "frame-to-video") && videoUpload.hasAnyImages && (
              <div className="p-3 sm:p-4 pb-0 border-b border-border/50">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {videoUpload.referenceImages.slice(0, mode === "frame-to-video" ? 2 : 3).map((img, index) => (
                    img.preview && (
                      <div key={index} className="relative shrink-0">
                        <img
                          src={img.preview}
                          alt={`Reference ${index + 1}`}
                          className="h-16 w-16 object-cover rounded-lg border border-border"
                        />
                        <button
                          onClick={() => videoUpload.clearImage(index)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                        >
                          ×
                        </button>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 rounded-b-lg">
                          {mode === "frame-to-video" ? (index === 0 ? "First" : "Last") : `Ref ${index + 1}`}
                        </span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Input */}
            <div className="p-3 sm:p-4 pb-2">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === "text-to-video"
                    ? "Describe the video you want to create..."
                    : mode === "image-to-video"
                    ? "Describe how you want to animate the image..."
                    : "Describe the transition between the two frames..."
                }
                className="w-full min-h-[60px] sm:min-h-[80px] max-h-[120px] sm:max-h-[160px] bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-foreground text-sm sm:text-base placeholder:text-foreground/40"
                style={{
                  fontSize: "16px",
                  lineHeight: "1.5",
                }}
              />
            </div>

            {/* Controls Bar */}
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Mode Dropdown */}
                <Select value={mode} onValueChange={(v) => {
                  setMode(v as VideoMode);
                  if (v === "text-to-video") {
                    videoUpload.clearAllImages();
                  }
                }}>
                  <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors min-w-[90px]">
                    <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="text-to-video" className="text-xs">Text to Video</SelectItem>
                    <SelectItem value="image-to-video" className="text-xs">Image to Video</SelectItem>
                    <SelectItem value="frame-to-video" className="text-xs">Frame to Video</SelectItem>
                  </SelectContent>
                </Select>

                {/* Add Images Button (for image modes) */}
                {(mode === "image-to-video" || mode === "frame-to-video") && (
                  <button
                    onClick={() => {
                      const nextSlot = videoUpload.referenceImages.findIndex(img => !img.file);
                      if (nextSlot !== -1 && nextSlot < (mode === "frame-to-video" ? 2 : 3)) {
                        fileInputRefs[nextSlot].current?.click();
                      }
                    }}
                    className="h-8 px-2 sm:px-2.5 flex items-center gap-1 sm:gap-1.5 bg-secondary/50 text-foreground text-xs rounded-lg hover:bg-secondary transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
                      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
                      <polyline points="21,15 16,10 5,21" strokeWidth={1.5} />
                    </svg>
                    <span className="hidden sm:inline">
                      {mode === "frame-to-video" ? "Frames" : "Images"}
                    </span>
                  </button>
                )}

                {/* Aspect Ratio Dropdown */}
                <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as VideoAspectRatio)}>
                  <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors">
                    <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
                    </svg>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="16:9" className="text-xs">16:9</SelectItem>
                    <SelectItem value="9:16" className="text-xs">9:16</SelectItem>
                  </SelectContent>
                </Select>

                {/* Resolution Dropdown */}
                <Select value={resolution} onValueChange={(v) => setResolution(v as VideoResolution)}>
                  <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors">
                    <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="720p" className="text-xs">720p</SelectItem>
                    <SelectItem value="1080p" className="text-xs">1080p</SelectItem>
                  </SelectContent>
                </Select>

                {/* Cost Display */}
                <span className="text-xs text-foreground/50 hidden sm:inline">
                  ~${estimatedCost.toFixed(3)}
                </span>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || videoGeneration.isLoading}
                className="h-10 sm:h-8 px-4 rounded-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-colors w-full sm:w-auto"
              >
                {videoGeneration.isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:mr-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="sm:hidden">Generate</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Mode Instructions (when not generating) */}
          {!videoGeneration.isLoading && !videoGeneration.generatedVideo && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {mode === "image-to-video" && !videoUpload.hasAnyImages && (
                <p className="text-xs text-foreground/50 text-center">
                  Add 1-3 reference images to animate
                </p>
              )}
              {mode === "frame-to-video" && (!videoUpload.referenceImages[0].file || !videoUpload.referenceImages[1].file) && (
                <p className="text-xs text-foreground/50 text-center">
                  Add first and last frame images to interpolate
                </p>
              )}
            </div>
          )}

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

        {/* Result Section */}
        {(videoGeneration.isLoading || videoGeneration.generatedVideo) && (
          <div className="w-full mt-4 sm:mt-8">
            <div className="bg-card border border-border rounded-xl sm:rounded-2xl overflow-hidden">
              {videoGeneration.isLoading ? (
                <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]">
                  {/* Video Progress UI */}
                  <div className="w-full h-full flex flex-col items-center justify-center px-8 select-none">
                    <div className="flex flex-col items-center">
                      {/* Logo with circular progress ring */}
                      <div className="relative mb-6">
                        <svg className="w-28 h-28 transform -rotate-90">
                          <circle
                            className="text-foreground/10"
                            strokeWidth="4"
                            stroke="currentColor"
                            fill="transparent"
                            r="52"
                            cx="56"
                            cy="56"
                          />
                          <circle
                            className="text-foreground transition-all duration-300 ease-out"
                            strokeWidth="4"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="52"
                            cx="56"
                            cy="56"
                            strokeDasharray={`${2 * Math.PI * 52}`}
                            strokeDashoffset={`${2 * Math.PI * 52 * (1 - videoGeneration.progress / 100)}`}
                          />
                        </svg>

                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="size-16 bg-foreground rounded-xl flex items-center justify-center">
                            <LogoIcon className="size-9 text-background" />
                          </div>
                        </div>
                      </div>

                      <span className="text-2xl font-semibold text-foreground mb-2">
                        {Math.round(videoGeneration.progress)}%
                      </span>

                      <p className="text-sm text-foreground/60">{videoGeneration.progressStage}</p>
                    </div>
                  </div>
                </div>
              ) : videoGeneration.generatedVideo ? (
                <div className="p-3 sm:p-4">
                  {/* Video Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm text-foreground/60">Generated Video</span>
                      {videoGeneration.isSaving && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground/50">
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Saving...</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <button
                        onClick={() => videoGeneration.setGeneratedVideo(null)}
                        className="h-7 sm:h-8 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground text-xs sm:text-sm transition-colors"
                        title="New Video"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>New</span>
                      </button>
                      <div className="w-px h-4 sm:h-5 bg-border hidden sm:block" />
                      <button
                        onClick={videoActions.downloadVideoFile}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Download"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={videoActions.copyVideoUrl}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Copy URL"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.5} />
                          <path strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Video Display */}
                  <div className="relative flex items-center justify-center">
                    <video
                      src={videoGeneration.generatedVideo.url}
                      controls
                      autoPlay
                      loop
                      className="max-w-full max-h-[300px] sm:max-h-[500px] object-contain rounded-lg sm:rounded-xl"
                    />
                  </div>

                  {/* Prompt Display */}
                  <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-secondary/30 rounded-lg sm:rounded-xl">
                    <p className="text-xs sm:text-sm text-foreground/70">
                      <span className="font-medium text-foreground/90">Prompt:</span> {videoGeneration.generatedVideo.prompt}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-foreground/50">
                      <span>{videoGeneration.generatedVideo.metadata?.resolution || resolution}</span>
                      <span>{videoGeneration.generatedVideo.metadata?.aspectRatio || aspectRatio}</span>
                      <span>{videoGeneration.generatedVideo.duration || 8}s</span>
                      {videoGeneration.generatedVideo.metadata?.hasAudio && <span>Audio</span>}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
