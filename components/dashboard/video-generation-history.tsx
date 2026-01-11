"use client"

import { useState, useMemo, useCallback, memo } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { LogoLoader } from "@/components/logo-icon"

interface VideoGeneration {
  _id: Id<"videoGenerations">
  _creationTime: number
  userId: string
  prompt: string
  videoStorageId: Id<"_storage">
  thumbnailStorageId: Id<"_storage">
  videoUrl: string | null
  thumbnailUrl: string | null
  mode: "text-to-video" | "image-to-video" | "frame-to-video"
  aspectRatio: string
  resolution: string
  duration?: number
  createdAt: number
  estimatedCost?: number
  model?: string
  hasAudio?: boolean
}

interface VideoGenerationHistoryProps {
  onUseAsReference?: (videoUrl: string) => void
}

// Memoized video generation card component
const VideoGenerationCard = memo(({
  generation,
  formattedDate,
  onSelect,
  onCopyPrompt,
  onDownload,
  onDelete,
  deletingId,
  copiedPromptId,
}: {
  generation: VideoGeneration
  formattedDate: string
  onSelect: () => void
  onCopyPrompt: (generation: VideoGeneration) => void
  onDownload: (generation: VideoGeneration) => void
  onDelete: (id: Id<"videoGenerations">) => void
  deletingId: Id<"videoGenerations"> | null
  copiedPromptId: Id<"videoGenerations"> | null
}) => {
  return (
    <div
      className="group relative bg-secondary/30 rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-all cursor-pointer"
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative">
        {generation.thumbnailUrl ? (
          <img
            src={generation.thumbnailUrl}
            alt={generation.prompt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <svg className="w-8 h-8 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        )}

        {/* Video indicator */}
        <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          {generation.duration || 8}s
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCopyPrompt(generation)
            }}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            title="Copy prompt"
          >
            {copiedPromptId === generation._id ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.5} />
                <path strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDownload(generation)
            }}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            title="Download"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(generation._id)
            }}
            disabled={deletingId === generation._id}
            className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            title="Delete"
          >
            {deletingId === generation._id ? (
              <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-1.5">
        <p className="text-[10px] text-foreground/70 truncate" title={generation.prompt}>
          {generation.prompt}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[9px] text-foreground/40">{formattedDate}</span>
          <div className="flex items-center gap-1">
            {generation.estimatedCost !== undefined && (
              <span className="text-[9px] px-1 py-0.5 bg-emerald-100 rounded text-emerald-700 font-medium">
                ${generation.estimatedCost.toFixed(3)}
              </span>
            )}
            <span className="text-[9px] px-1 py-0.5 bg-secondary rounded text-foreground/50">
              {generation.resolution}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

VideoGenerationCard.displayName = "VideoGenerationCard"

export function VideoGenerationHistory({ onUseAsReference }: VideoGenerationHistoryProps) {
  const generations = useQuery(api.videoGenerations.getMyVideoGenerations, { limit: 50 }) as VideoGeneration[] | undefined
  const deleteGeneration = useMutation(api.videoGenerations.deleteVideoGeneration)

  const [selectedVideo, setSelectedVideo] = useState<VideoGeneration | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"videoGenerations"> | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<Id<"videoGenerations"> | null>(null)

  const handleDelete = useCallback(async (id: Id<"videoGenerations">) => {
    if (!confirm("Are you sure you want to delete this video?")) return

    setDeletingId(id)
    try {
      await deleteGeneration({ videoGenerationId: id })
      setSelectedVideo((prev) => (prev?._id === id ? null : prev))
    } catch (error) {
      console.error("Error deleting video generation:", error)
      alert("Failed to delete video")
    } finally {
      setDeletingId(null)
    }
  }, [deleteGeneration])

  const handleCopyPrompt = useCallback(async (generation: VideoGeneration) => {
    try {
      await navigator.clipboard.writeText(generation.prompt)
      setCopiedPromptId(generation._id)
      setTimeout(() => setCopiedPromptId(null), 2000)
    } catch (error) {
      console.error("Error copying prompt:", error)
    }
  }, [])

  const handleDownload = useCallback(async (generation: VideoGeneration) => {
    try {
      if (!generation.videoUrl) return

      // Fetch the video and download it
      const response = await fetch(generation.videoUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = `eikon-${generation.mode}-${generation._id}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading video:", error)
    }
  }, [])

  // Memoize date formatting function
  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const now = Date.now()
    const diffMs = now - timestamp
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date(now).getFullYear() ? "numeric" : undefined,
    })
  }, [])

  // Memoize formatted dates for all generations
  const formattedDates = useMemo(() => {
    if (!generations) return new Map()
    const dates = new Map<Id<"videoGenerations">, string>()
    generations.forEach((gen) => {
      dates.set(gen._id, formatDate(gen.createdAt))
    })
    return dates
  }, [generations, formatDate])

  // Group generations by date for display
  const groupedGenerations = useMemo(() => {
    if (!generations) return []

    const groups: { dateLabel: string; dateKey: string; generations: VideoGeneration[] }[] = []
    const groupMap = new Map<string, VideoGeneration[]>()

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterday = today - 86400000
    const thisWeekStart = today - (now.getDay() * 86400000)
    const lastWeekStart = thisWeekStart - 7 * 86400000
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()

    generations.forEach((gen) => {
      const genDate = new Date(gen.createdAt)
      const genDay = new Date(genDate.getFullYear(), genDate.getMonth(), genDate.getDate()).getTime()

      let dateKey: string
      let dateLabel: string

      if (genDay >= today) {
        dateKey = "today"
        dateLabel = "Today"
      } else if (genDay >= yesterday) {
        dateKey = "yesterday"
        dateLabel = "Yesterday"
      } else if (genDay >= thisWeekStart) {
        dateKey = "this-week"
        dateLabel = "This Week"
      } else if (genDay >= lastWeekStart) {
        dateKey = "last-week"
        dateLabel = "Last Week"
      } else if (genDay >= thisMonthStart) {
        dateKey = "this-month"
        dateLabel = "This Month"
      } else if (genDay >= lastMonthStart) {
        dateKey = "last-month"
        dateLabel = "Last Month"
      } else {
        // Group by month/year for older items
        dateKey = `${genDate.getFullYear()}-${genDate.getMonth()}`
        dateLabel = genDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      }

      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, [])
        groups.push({ dateKey, dateLabel, generations: groupMap.get(dateKey)! })
      }
      groupMap.get(dateKey)!.push(gen)
    })

    return groups
  }, [generations])

  // Memoize modal close handler
  const handleCloseModal = useCallback(() => {
    setSelectedVideo(null)
  }, [])

  // Memoize formatted date for selected video
  const selectedVideoFormattedDate = useMemo(() => {
    if (!selectedVideo) return ""
    return new Date(selectedVideo.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [selectedVideo])

  if (generations === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LogoLoader size="md" text="Loading video history" />
      </div>
    )
  }

  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No video generations yet</h3>
        <p className="text-sm text-foreground/50 max-w-sm">
          Your generated videos will appear here. Go to the Video tab to create your first video!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="flex items-center gap-1.5 px-2 py-1 text-foreground font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Video History
          </span>
        </nav>
        <p className="text-sm text-foreground/50 mt-1">
          {generations.length} video{generations.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Date-grouped Grid */}
      <div className="space-y-8">
        {groupedGenerations.map((group) => (
          <div key={group.dateKey}>
            {/* Date Header */}
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-medium text-foreground/70">{group.dateLabel}</h3>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-foreground/40">
                {group.generations.length} video{group.generations.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {group.generations.map((generation) => (
                <VideoGenerationCard
                  key={generation._id}
                  generation={generation}
                  formattedDate={formattedDates.get(generation._id) || formatDate(generation.createdAt)}
                  onSelect={() => setSelectedVideo(generation)}
                  onCopyPrompt={handleCopyPrompt}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  copiedPromptId={copiedPromptId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal for selected video */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-card rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Video Details</h3>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Video */}
              <div className="flex justify-center">
                <video
                  src={selectedVideo.videoUrl || ""}
                  controls
                  autoPlay
                  loop
                  className="max-w-full max-h-[50vh] rounded-xl"
                />
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="bg-secondary/30 rounded-xl p-4">
                  <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Prompt</p>
                  <p className="text-sm text-foreground">{selectedVideo.prompt}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Mode</p>
                    <p className="text-sm text-foreground capitalize">{selectedVideo.mode.replace(/-/g, " ")}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Resolution</p>
                    <p className="text-sm text-foreground">{selectedVideo.resolution}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Aspect</p>
                    <p className="text-sm text-foreground">{selectedVideo.aspectRatio}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Duration</p>
                    <p className="text-sm text-foreground">{selectedVideo.duration || 8} seconds</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Est. Cost</p>
                    <p className="text-sm text-emerald-600 font-medium">
                      {selectedVideo.estimatedCost !== undefined
                        ? `$${selectedVideo.estimatedCost.toFixed(3)}`
                        : "—"
                      }
                    </p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Audio</p>
                    <p className="text-sm text-foreground">{selectedVideo.hasAudio ? "Included" : "None"}</p>
                  </div>
                </div>

                <div className="bg-secondary/30 rounded-xl p-3">
                  <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Created</p>
                  <p className="text-sm text-foreground">
                    {selectedVideoFormattedDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => handleCopyPrompt(selectedVideo)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                {copiedPromptId === selectedVideo._id ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.5} />
                      <path strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy Prompt
                  </>
                )}
              </button>
              <button
                onClick={() => handleDownload(selectedVideo)}
                className="flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-foreground/90 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
