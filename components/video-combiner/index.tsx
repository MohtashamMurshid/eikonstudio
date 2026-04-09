"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { VideoPlayer } from "@/components/ui/video-player";
import { cn } from "@/lib/utils";
import type {
  VideoAspectRatio,
  VideoCombinerProps,
  VideoMode,
  VideoResolution,
} from "./types";
import { useToast } from "./hooks/use-toast";
import { useVideoUpload } from "./hooks/use-video-upload";
import { useVideoGeneration } from "./hooks/use-video-generation";
import { useVideoActions } from "./hooks/use-video-actions";
import {
  calculateVideoCost,
  getEstimatedDuration,
  getVideoModelName,
} from "@/lib/video-cost-calculator";

const MODE_OPTIONS: Array<{
  value: VideoMode;
  label: string;
  eyebrow: string;
  description: string;
  helper: string;
}> = [
  {
    value: "text-to-video",
    label: "Prompt",
    eyebrow: "Text to video",
    description: "Build a shot from pure direction.",
    helper: "Lead with subject, action, lens, mood, and movement.",
  },
  {
    value: "image-to-video",
    label: "Animate",
    eyebrow: "Image to video",
    description: "Bring a still frame to life.",
    helper: "Upload up to 3 references and describe the motion arc.",
  },
  {
    value: "frame-to-video",
    label: "Interpolate",
    eyebrow: "Frame to video",
    description: "Blend between first and last frames.",
    helper: "Stage a clear opening and ending composition for the transition.",
  },
];

const PROMPT_RECIPES: Record<VideoMode, string[]> = {
  "text-to-video": [
    "close-up portrait, subtle dolly in, soft studio haze",
    "wide city rooftop at dusk, handheld drift, neon reflections",
    "fashion editorial, slow orbital camera, dramatic rim light",
  ],
  "image-to-video": [
    "animate the subject with a slow push-in and realistic cloth motion",
    "keep composition stable, add ambient movement and cinematic parallax",
    "introduce wind, shallow depth of field, and a polished commercial finish",
  ],
  "frame-to-video": [
    "ease from frame one to frame two with smooth body motion",
    "preserve identity and lighting while transitioning camera position",
    "create a premium ad-style morph with clean motion continuity",
  ],
};

const CAMERA_MOVES = [
  "slow dolly in",
  "locked-off hero shot",
  "orbital camera move",
  "handheld micro-shake",
  "fast whip reveal",
];

const ASPECT_RATIO_OPTIONS: VideoAspectRatio[] = ["16:9", "9:16"];
const RESOLUTION_OPTIONS: VideoResolution[] = ["720p", "1080p"];

export function VideoCombiner({ apiKey }: VideoCombinerProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<VideoMode>("text-to-video");
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [resolution, setResolution] = useState<VideoResolution>("720p");

  const { toast, showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const activeMode = MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[0];
  const visibleReferenceSlots = mode === "frame-to-video" ? 2 : mode === "image-to-video" ? 3 : 0;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (file) {
      videoUpload.handleImageUpload(file, index);
      event.target.value = "";
    }
  };

  const handleModeChange = (nextMode: VideoMode) => {
    setMode(nextMode);
    if (nextMode === "text-to-video") {
      videoUpload.clearAllImages();
    }
  };

  const appendPromptFragment = (fragment: string) => {
    setPrompt((currentPrompt) => {
      if (!currentPrompt.trim()) {
        return fragment;
      }

      const trimmedPrompt = currentPrompt.trimEnd();
      const joiner = /[,.]$/.test(trimmedPrompt) ? " " : ", ";
      return `${trimmedPrompt}${joiner}${fragment}`;
    });

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const canGenerate =
    prompt.trim().length > 0 &&
    (mode === "text-to-video" ||
      (mode === "image-to-video" && videoUpload.hasAnyImages) ||
      (mode === "frame-to-video" &&
        videoUpload.referenceImages[0].file &&
        videoUpload.referenceImages[1].file));

  const handleGenerate = () => {
    if (!canGenerate) return;
    videoGeneration.generateVideo();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canGenerate && !videoGeneration.isLoading) {
        handleGenerate();
      }
    }
  };

  const refCount = videoUpload.getImageFiles().filter((file) => file !== null).length;
  const estimatedCost = calculateVideoCost(resolution, mode, refCount);
  const promptLength = prompt.trim().length;
  const currentDuration = videoGeneration.generatedVideo?.duration ?? getEstimatedDuration();
  const previewAspectClass = aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]";

  const getReferenceLabel = (index: number) => {
    if (mode === "frame-to-video") {
      return index === 0 ? "First frame" : "Last frame";
    }

    return `Reference ${index + 1}`;
  };

  const promptPlaceholder =
    mode === "text-to-video"
      ? "A model steps through a glossy tunnel, slow dolly in, silver fabric ripples, specular highlights, premium fashion ad."
      : mode === "image-to-video"
        ? "Animate the frame with subtle camera drift, natural subject motion, layered depth, and polished studio lighting."
        : "Transition smoothly between both frames, preserve subject identity, consistent lighting, and elegant camera motion.";

  return (
    <div className="relative z-10 min-h-[calc(100vh-200px)] text-white select-none">
      {toast.visible && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-500"
              : toast.type === "error"
                ? "bg-red-500"
                : toast.type === "warning"
                  ? "bg-amber-500"
                  : "bg-blue-500"
          } text-white`}
        >
          {toast.message}
        </div>
      )}

      <div className="relative flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/45">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/70">
                  Video Studio
                </span>
                <span>Higgsfield-inspired</span>
              </div>

              <div className="space-y-3">
                <Logo variant="default" size="sm" colorScheme="light" className="opacity-90" />
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Direct motion with a cleaner cinematic video flow
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base">
                    Keep the existing generation engine, but work from a darker editorial surface with quicker prompt framing,
                    cleaner reference staging, and a dedicated preview monitor.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Model</p>
                <p className="mt-2 text-sm font-medium text-white">{getVideoModelName()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Duration</p>
                <p className="mt-2 text-sm font-medium text-white">{currentDuration}s clip</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Estimate</p>
                <p className="mt-2 text-sm font-medium text-white">${estimatedCost.toFixed(3)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Status</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {videoGeneration.isLoading
                    ? "Rendering"
                    : videoGeneration.generatedVideo
                      ? "Rendered"
                      : canGenerate
                        ? "Ready"
                        : "Drafting"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.85fr)]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Capture mode</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">Choose the generation workflow</h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/55">
                      {activeMode.eyebrow}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {MODE_OPTIONS.map((option) => {
                      const isActive = option.value === mode;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleModeChange(option.value)}
                          className={cn(
                            "rounded-2xl border px-4 py-4 text-left transition-all",
                            isActive
                              ? "border-white bg-white text-black shadow-[0_16px_40px_rgba(255,255,255,0.12)]"
                              : "border-white/10 bg-black/30 text-white hover:border-white/30 hover:bg-white/[0.05]"
                          )}
                        >
                          <p className={cn("text-[11px] uppercase tracking-[0.2em]", isActive ? "text-black/55" : "text-white/35")}>
                            {option.eyebrow}
                          </p>
                          <p className="mt-2 text-base font-semibold">{option.label}</p>
                          <p className={cn("mt-2 text-sm", isActive ? "text-black/70" : "text-white/55")}>{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Director prompt</p>
                      <p className="mt-2 text-sm text-white/60">{activeMode.helper}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/45">
                      {promptLength} chars
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-white/10 bg-[#050505] p-4">
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={promptPlaceholder}
                      className="min-h-[180px] w-full resize-none bg-transparent text-base leading-7 text-white placeholder:text-white/28 focus:outline-none"
                    />
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/35">Prompt recipes</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {PROMPT_RECIPES[mode].map((recipe) => (
                          <button
                            key={recipe}
                            type="button"
                            onClick={() => appendPromptFragment(recipe)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-white/70 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                          >
                            {recipe}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/35">Camera moves</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CAMERA_MOVES.map((move) => (
                          <button
                            key={move}
                            type="button"
                            onClick={() => appendPromptFragment(move)}
                            className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                          >
                            {move}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {visibleReferenceSlots > 0 && (
                  <div className="rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Reference board</p>
                        <p className="mt-2 text-sm text-white/60">
                          {mode === "frame-to-video"
                            ? "Upload a first and last frame to guide the interpolation."
                            : "Upload up to 3 frames to define identity, styling, and motion cues."}
                        </p>
                      </div>
                      {videoUpload.hasAnyImages && (
                        <button
                          type="button"
                          onClick={videoUpload.clearAllImages}
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:border-white/25 hover:text-white"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: visibleReferenceSlots }).map((_, index) => {
                        const reference = videoUpload.referenceImages[index];
                        const label = getReferenceLabel(index);

                        return reference.preview ? (
                          <div
                            key={label}
                            className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#050505]"
                          >
                            <div className="relative h-48 w-full">
                              <Image src={reference.preview} alt={label} fill unoptimized className="object-cover" />
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-3">
                              <p className="text-sm font-medium text-white">{label}</p>
                              <p className="mt-1 truncate text-xs text-white/55">{reference.file?.name}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => videoUpload.clearImage(index)}
                              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm text-white transition hover:bg-black"
                              aria-label={`Remove ${label}`}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            key={label}
                            type="button"
                            onClick={() => fileInputRefs[index].current?.click()}
                            className="group flex h-48 flex-col items-start justify-between rounded-[22px] border border-dashed border-white/18 bg-[#050505] p-4 text-left transition hover:border-white/40 hover:bg-white/[0.04]"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/80">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{label}</p>
                              <p className="mt-1 text-xs text-white/45">
                                Add a still to anchor composition, identity, and motion.
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Aspect ratio</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {ASPECT_RATIO_OPTIONS.map((option) => {
                        const isActive = aspectRatio === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setAspectRatio(option)}
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm transition",
                              isActive
                                ? "border-white bg-white text-black"
                                : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white"
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Resolution</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {RESOLUTION_OPTIONS.map((option) => {
                        const isActive = resolution === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setResolution(option)}
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm transition",
                              isActive
                                ? "border-white bg-white text-black"
                                : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white"
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">Ready to render in {currentDuration}s</p>
                    <p className="text-sm text-white/50">
                      Press Enter to render. Estimated cost: ${estimatedCost.toFixed(3)}
                    </p>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={!canGenerate || videoGeneration.isLoading}
                    className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90 sm:min-w-[180px]"
                  >
                    {videoGeneration.isLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Rendering
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate video
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {[0, 1, 2].map((index) => (
              <input
                key={index}
                ref={fileInputRefs[index]}
                type="file"
                accept="image/*"
                onChange={(event) => handleFileSelect(event, index)}
                className="hidden"
              />
            ))}
          </section>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Preview monitor</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {videoGeneration.generatedVideo ? "Rendered output" : "Live composition preview"}
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/55">
                  {videoGeneration.isSaving
                    ? "Saving to history"
                    : videoGeneration.isLoading
                      ? "Generating"
                      : videoGeneration.generatedVideo
                        ? "Ready"
                        : "Idle"}
                </span>
              </div>

              <div className={cn("mt-5", aspectRatio === "9:16" && "mx-auto max-w-[360px]")}>
                <div className={cn("relative overflow-hidden rounded-[26px] border border-white/10 bg-[#030303]", previewAspectClass)}>
                  {videoGeneration.isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.18),transparent_42%),linear-gradient(180deg,#070707_0%,#020202_100%)] px-6">
                      <div className="relative mb-6">
                        <svg className="h-28 w-28 -rotate-90 transform">
                          <circle
                            className="text-white/10"
                            strokeWidth="4"
                            stroke="currentColor"
                            fill="transparent"
                            r="52"
                            cx="56"
                            cy="56"
                          />
                          <circle
                            className="text-white transition-all duration-300 ease-out"
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
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black">E</div>
                        </div>
                      </div>
                      <p className="text-3xl font-semibold text-white">{Math.round(videoGeneration.progress)}%</p>
                      <p className="mt-2 text-sm text-white/55">{videoGeneration.progressStage || "Building your clip..."}</p>
                    </div>
                  ) : videoGeneration.generatedVideo ? (
                    <VideoPlayer
                      src={videoGeneration.generatedVideo.url}
                      autoPlay
                      loop
                      className="h-full w-full"
                      maxHeight="720px"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,#0b0b0b_0%,#030303_100%)]">
                      <div className="flex h-full flex-col justify-between p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                            {activeMode.eyebrow}
                          </span>
                          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/40">
                            {resolution} / {aspectRatio}
                          </span>
                        </div>

                        <div className="space-y-4">
                          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">
                            No render yet
                          </div>
                          <div className="max-w-xl">
                            <p className="text-sm uppercase tracking-[0.24em] text-white/35">Prompt preview</p>
                            <p className="mt-3 text-xl font-medium leading-tight text-white sm:text-2xl">
                              {prompt.trim() || "Describe the scene, camera, motion, and finishing details to preview your next shot."}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                              {refCount} refs
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                              {currentDuration}s clip
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                              Press Enter to render
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Prompt and output notes</p>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  {videoGeneration.generatedVideo?.prompt || prompt || "Your prompt will appear here once you start shaping the shot."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {videoGeneration.generatedVideo?.metadata?.mode || mode}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {videoGeneration.generatedVideo?.metadata?.resolution || resolution}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {videoGeneration.generatedVideo?.metadata?.aspectRatio || aspectRatio}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {currentDuration}s
                  </span>
                  {videoGeneration.generatedVideo?.metadata?.hasAudio && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Audio</span>
                  )}
                </div>
              </div>

              {videoGeneration.generatedVideo && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    onClick={() => videoGeneration.setGeneratedVideo(null)}
                    className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-5 text-white hover:bg-white/[0.12]"
                  >
                    New render
                  </Button>
                  <Button
                    onClick={videoActions.downloadVideoFile}
                    className="h-11 rounded-full border border-white/10 bg-white px-5 text-black hover:bg-white/90"
                  >
                    Download
                  </Button>
                  <Button
                    onClick={videoActions.copyVideoUrl}
                    className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-5 text-white hover:bg-white/[0.12]"
                  >
                    Copy URL
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Render checklist</p>
                <ul className="mt-4 space-y-3 text-sm text-white/62">
                  <li className="flex gap-3">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Lock subject, action, and camera move in the first sentence.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Keep lighting and environment cues explicit for more stable outputs.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {mode === "frame-to-video"
                      ? "Use two clearly distinct keyframes so the interpolation has a readable path."
                      : mode === "image-to-video"
                        ? "Reference images help preserve identity while the prompt drives movement."
                        : "Use style and motion modifiers sparingly so the shot stays coherent."}
                  </li>
                </ul>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Session details</p>
                <div className="mt-4 space-y-3 text-sm text-white/62">
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                    <span className="text-white/45">Mode</span>
                    <span className="text-white">{activeMode.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                    <span className="text-white/45">References</span>
                    <span className="text-white">{refCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                    <span className="text-white/45">Aspect</span>
                    <span className="text-white">{aspectRatio}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Resolution</span>
                    <span className="text-white">{resolution}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
