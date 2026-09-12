"use client";

import { Component, type ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useVideoGeneration } from "./hooks/use-video-generation";
import { creatorJobView } from "./creator-session";
import type { Id } from "@/convex/_generated/dataModel";

// Remount every account's form, subscriptions and callbacks together. Server APIs also fence ownerId.
export function VideoCombiner() {
  const { data: session, isPending } = authClient.useSession();
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isPending || isLoading) return <p role="status" className="p-6">Checking your account…</p>;
  if (!session?.user.id || !isAuthenticated) return <p className="p-6">Sign in to create videos.</p>;
  return <CreatorErrorBoundary key={session.user.id}><OwnedVideoCreator ownerId={session.user.id} /></CreatorErrorBoundary>;
}

export class CreatorErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert" className="p-6">Video subscriptions are unavailable. Reload to reconnect to saved work. No new request will be submitted automatically.</p> : this.props.children;
  }
}

export function OwnedVideoCreator({ ownerId }: { ownerId: string }) {
  const creator = useVideoGeneration(ownerId);
  const { input, setInput, state } = creator;
  const mode = input.referenceGalleryIds.length;
  const fieldClass = "w-full rounded-xl border border-border bg-secondary/20 p-3 text-sm";
  return <div className="h-full overflow-y-auto p-5 space-y-6">
    <header><h1 className="text-xl font-semibold">Cinema Studio</h1><p className="text-sm text-foreground/60">Veo 3.1 Preview · Saved Google credential · Native audio included</p></header>
    {!state && <p role="status">Loading owned jobs and settings…</p>}
    {state && state.credential?.health !== "active" && <p>Connect an active Google credential in <a href="/studio/settings" className="underline">Settings</a> to generate.</p>}
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 rounded-2xl border border-border p-4">
        <label className="block text-sm">Mode<select aria-label="Mode" className={fieldClass} value={mode} onChange={event => {
          const count = Number(event.target.value);
          setInput({ ...input, referenceGalleryIds: Array.from({ length: count }, (_, index) => input.referenceGalleryIds[index] ?? "" as Id<"gallery">), duration: count === 2 ? 8 : input.duration });
        }}><option value={0}>Text to video</option><option value={1}>First frame</option><option value={2}>First and last frames</option></select></label>
        <label className="block text-sm">Aspect ratio<select aria-label="Aspect ratio" className={fieldClass} value={input.aspectRatio} onChange={event => setInput({ ...input, aspectRatio: event.target.value as "16:9" | "9:16" })}><option>16:9</option><option>9:16</option></select></label>
        <label className="block text-sm">Resolution<select aria-label="Resolution" className={fieldClass} value={input.resolution} onChange={event => setInput({ ...input, resolution: event.target.value as "720p" | "1080p", duration: event.target.value === "1080p" ? 8 : input.duration })}><option>720p</option><option>1080p</option></select></label>
        <label className="block text-sm">Duration<select aria-label="Duration" className={fieldClass} value={input.duration} onChange={event => setInput({ ...input, duration: Number(event.target.value) as 4 | 6 | 8 })}>{[4, 6, 8].map(duration => <option key={duration} value={duration} disabled={duration !== 8 && (mode === 2 || input.resolution === "1080p")}>{duration} seconds</option>)}</select></label>
        <p className="text-xs text-foreground/60">1080p and first/last frames require 8 seconds. Audio is always enabled. Cost is not yet available here.</p>
        <button disabled className="text-sm opacity-50">File uploads unavailable</button>
        <button disabled className="block text-sm opacity-50">Character / asset references unavailable</button>
        <p className="text-xs text-foreground/60">Frames must be saved gallery images verified against your completed durable image outputs. Legacy uploads and character avatars have no verified upload ownership binding.</p>
      </aside>
      <main className="space-y-4 min-w-0">
        {input.referenceGalleryIds.map((id, index) => <label key={index} className="block text-sm">{index === 0 ? "First frame" : "Last frame"}<select aria-label={index === 0 ? "First frame" : "Last frame"} className={fieldClass} value={id} onChange={event => {
          const ids = [...input.referenceGalleryIds]; ids[index] = event.target.value as Id<"gallery">;
          setInput({ ...input, referenceGalleryIds: ids });
        }}><option value="">Choose a verified gallery image</option>{state?.frames.map(frame => <option key={frame.id} value={frame.id}>{frame.filename}</option>)}</select></label>)}
        {mode > 0 && state?.frames.length === 0 && <p>No verified frames among your latest 100 gallery images. Save a completed durable image to your gallery first.</p>}
        <label className="block text-sm">Prompt<textarea aria-label="Prompt" className={fieldClass} rows={4} maxLength={10000} value={input.prompt} onChange={event => setInput({ ...input, prompt: event.target.value })} placeholder="Describe your scene and its movement" /></label>
        <div className="flex flex-wrap gap-3"><Button disabled={!creator.canGenerate} onClick={creator.submit}>Generate video</Button><Button variant="outline" disabled={!creator.canPrepareNew} onClick={creator.newGeneration}>New generation</Button></div>
        <p className="text-xs text-foreground/60">New generation prepares a separate request, even with the same prompt. Generating it may incur a new provider charge. Existing work continues.</p>
        {creator.error && <p role="alert">{creator.error}</p>}
        {creator.waiting && <p role="status">{creator.waiting}</p>}
        <section aria-label="Owned video jobs" className="space-y-4">
          {state?.jobs.map(job => {
            const view = creatorJobView(job);
            return <article key={job.jobId} className="rounded-2xl border border-border p-4 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{job.prompt}</p><p role="status">{view.label}</p>
              <p className="text-xs text-foreground/60">Requested: {job.resolution}, {job.duration} seconds</p>
              {view.url && <><video controls preload="metadata" src={view.url} className="w-full rounded-xl" /><a href={view.url} download className="text-sm underline">Download persisted video</a></>}
            </article>;
          })}
        </section>
      </main>
    </div>
  </div>;
}
