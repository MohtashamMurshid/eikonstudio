"use client"

import { useState, useMemo, useCallback, memo } from "react"
import Image from "next/image"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { LogoLoader } from "@/components/logo-icon"
import { LazyImage } from "@/components/gallery/lazy-image"
import { getUserFacingErrorMessage } from "@/lib/error-utils"

interface Generation {
  _id: Id<"generations">
  _creationTime: number
  userId: string
  prompt: string
  imageStorageId?: Id<"_storage">
  thumbnailStorageId?: Id<"_storage">
  imageUrl: string | null
  thumbnailUrl: string | null
  mode: "text-to-image" | "image-editing"
  aspectRatio: string
  imageSize: string
  artStyle?: string
  createdAt: number
  estimatedCost?: number
  model?: string
  status: "pending" | "generating" | "completed" | "failed"
  errorMessage?: string
}

interface GenerationHistoryProps {
  onUseAsInput?: (imageUrl: string) => void
}

// Loading card component for pending/generating states
const LoadingGenerationCard = memo(({
  generation,
  formattedDate,
  onDelete,
  deletingId,
}: {
  generation: Generation
  formattedDate: string
  onDelete: (id: Id<"generations">) => void
  deletingId: Id<"generations"> | null
}) => {
  const isPending = generation.status === "pending"
  const isGenerating = generation.status === "generating"
  
  return (
    <div className="group relative bg-secondary/30 rounded-lg overflow-hidden border border-border">
      {/* Loading animation */}
      <div className="aspect-square relative bg-gradient-to-br from-secondary/50 to-secondary/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          {/* Animated spinner */}
          <div className="relative">
            <svg className="w-8 h-8 animate-spin text-foreground/30" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="3"
                fill="none"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <span className="text-[10px] text-foreground/50 font-medium">
            {isPending ? "Queued..." : isGenerating ? "Generating..." : "Processing..."}
          </span>
        </div>
        
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
        
        {/* Delete button on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(generation._id)
            }}
            disabled={deletingId === generation._id}
            className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            title="Cancel generation"
          >
            {deletingId === generation._id ? (
              <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
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
          <span className="text-[9px] px-1 py-0.5 bg-amber-100 rounded text-amber-700 font-medium">
            {isPending ? "Queued" : "Generating"}
          </span>
        </div>
      </div>
    </div>
  )
})

LoadingGenerationCard.displayName = "LoadingGenerationCard"

// Failed card component
const FailedGenerationCard = memo(({
  generation,
  formattedDate,
  onDelete,
  onRetry,
  deletingId,
}: {
  generation: Generation
  formattedDate: string
  onDelete: (id: Id<"generations">) => void
  onRetry?: (generation: Generation) => void
  deletingId: Id<"generations"> | null
}) => {
  return (
    <div className="group relative bg-secondary/30 rounded-lg overflow-hidden border border-red-200">
      {/* Error state */}
      <div className="aspect-square relative bg-gradient-to-br from-red-50 to-red-100/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 p-2">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-[10px] text-red-600 font-medium text-center">
            Generation failed
          </span>
          {generation.errorMessage && (
            <span className="text-[9px] text-red-500/80 text-center line-clamp-2" title={generation.errorMessage}>
              {generation.errorMessage}
            </span>
          )}
        </div>
        
        {/* Actions on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
          <span className="text-[9px] px-1 py-0.5 bg-red-100 rounded text-red-600 font-medium">
            Failed
          </span>
        </div>
      </div>
    </div>
  )
})

FailedGenerationCard.displayName = "FailedGenerationCard"

// Memoized generation card component for completed generations
const GenerationCard = memo(({
  generation,
  formattedDate,
  onSelect,
  onUseAsInput,
  onCopyPrompt,
  onDownload,
  onDelete,
  deletingId,
  copiedPromptId,
}: {
  generation: Generation
  formattedDate: string
  onSelect: () => void
  onUseAsInput?: (imageUrl: string) => void
  onCopyPrompt: (generation: Generation) => void
  onDownload: (generation: Generation) => void
  onDelete: (id: Id<"generations">) => void
  deletingId: Id<"generations"> | null
  copiedPromptId: Id<"generations"> | null
}) => {
  return (
    <div
      className="group relative bg-secondary/30 rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-all cursor-pointer"
      onClick={onSelect}
    >
      {/* Image - use compressed thumbnail for fast loading */}
      <div className="aspect-square relative">
        <LazyImage
          src={generation.thumbnailUrl || ""}
          alt={generation.prompt}
          className="aspect-square relative"
        />
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {onUseAsInput && generation.imageUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUseAsInput(generation.imageUrl!)
              }}
              className="p-2 bg-emerald-500/80 hover:bg-emerald-500 rounded-lg transition-colors"
              title="Use as input image"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m0-16l-4 4m4-4l4 4M4 12h16" />
              </svg>
            </button>
          )}
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
                ${generation.estimatedCost.toFixed(4)}
              </span>
            )}
            <span className="text-[9px] px-1 py-0.5 bg-secondary rounded text-foreground/50">
              {generation.imageSize}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

GenerationCard.displayName = "GenerationCard"

export function GenerationHistory({ onUseAsInput }: GenerationHistoryProps) {
  const generations = useQuery(api.generations.getMyGenerations, { limit: 50 }) as Generation[] | undefined
  const deleteGeneration = useMutation(api.generations.deleteGeneration)
  
  const [selectedImage, setSelectedImage] = useState<Generation | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"generations"> | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<Id<"generations"> | null>(null)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const handleDelete = useCallback(async (id: Id<"generations">) => {
    if (!confirm("Are you sure you want to delete this generation?")) return
    
    setDeletingId(id)
    setFeedback(null)
    try {
      await deleteGeneration({ generationId: id })
      setSelectedImage((prev) => (prev?._id === id ? null : prev))
      setFeedback({ kind: "success", message: "Generation deleted." })
    } catch (error) {
      console.error("Error deleting generation:", error)
      setFeedback({
        kind: "error",
        message: getUserFacingErrorMessage(error, "Failed to delete generation."),
      })
    } finally {
      setDeletingId(null)
    }
  }, [deleteGeneration])

  const handleCopyPrompt = useCallback(async (generation: Generation) => {
    try {
      await navigator.clipboard.writeText(generation.prompt)
      setCopiedPromptId(generation._id)
      setFeedback({ kind: "success", message: "Prompt copied." })
      setTimeout(() => setCopiedPromptId(null), 2000)
    } catch (error) {
      console.error("Error copying prompt:", error)
      setFeedback({
        kind: "error",
        message: getUserFacingErrorMessage(error, "Failed to copy prompt."),
      })
    }
  }, [])

  const handleDownload = useCallback(async (generation: Generation) => {
    try {
      if (!generation.imageUrl) return
      
      // Fetch the image and download it
      const response = await fetch(generation.imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = url
      link.download = `eikon-${generation.mode}-${generation._id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
      setFeedback({ kind: "success", message: "Image downloaded." })
    } catch (error) {
      console.error("Error downloading image:", error)
      setFeedback({
        kind: "error",
        message: getUserFacingErrorMessage(error, "Failed to download image."),
      })
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
    const dates = new Map<Id<"generations">, string>()
    generations.forEach((gen) => {
      dates.set(gen._id, formatDate(gen.createdAt))
    })
    return dates
  }, [generations, formatDate])

  // Group generations by date for display
  const groupedGenerations = useMemo(() => {
    if (!generations) return []
    
    const groups: { dateLabel: string; dateKey: string; generations: Generation[] }[] = []
    const groupMap = new Map<string, Generation[]>()
    
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
    setSelectedImage(null)
  }, [])

  // Memoize formatted date for selected image
  const selectedImageFormattedDate = useMemo(() => {
    if (!selectedImage) return ""
    return new Date(selectedImage.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [selectedImage])

  if (generations === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LogoLoader size="md" text="Loading history" />
      </div>
    )
  }

  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No generations yet</h3>
        <p className="text-sm text-foreground/50 max-w-sm">
          Your generated images will appear here. Go to the Studio tab to create your first image!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Gallery style */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="flex items-center gap-1.5 px-2 py-1 text-foreground font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </span>
        </nav>
        <p className="text-sm text-foreground/50 mt-1">
          {generations.length} generation{generations.length !== 1 ? "s" : ""}
          {generations.some(g => g.status === "pending" || g.status === "generating") && (
            <span className="ml-2 text-amber-600">
              ({generations.filter(g => g.status === "pending" || g.status === "generating").length} in progress)
            </span>
          )}
        </p>
        {feedback && (
          <p
            className={`mt-2 text-sm ${
              feedback.kind === "success" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {feedback.message}
          </p>
        )}
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
                {group.generations.length} image{group.generations.length !== 1 ? "s" : ""}
              </span>
            </div>
            
            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {group.generations.map((generation) => {
                const formattedDate = formattedDates.get(generation._id) || formatDate(generation.createdAt)
                
                // Render loading card for pending/generating
                if (generation.status === "pending" || generation.status === "generating") {
                  return (
                    <LoadingGenerationCard
                      key={generation._id}
                      generation={generation}
                      formattedDate={formattedDate}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  )
                }
                
                // Render failed card
                if (generation.status === "failed") {
                  return (
                    <FailedGenerationCard
                      key={generation._id}
                      generation={generation}
                      formattedDate={formattedDate}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  )
                }
                
                // Render completed card
                return (
                  <GenerationCard
                    key={generation._id}
                    generation={generation}
                    formattedDate={formattedDate}
                    onSelect={() => setSelectedImage(generation)}
                    onUseAsInput={onUseAsInput}
                    onCopyPrompt={handleCopyPrompt}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    deletingId={deletingId}
                    copiedPromptId={copiedPromptId}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal for selected image (only for completed generations) */}
      {selectedImage && selectedImage.status === "completed" && selectedImage.imageUrl && (
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
              <h3 className="font-semibold text-foreground">Generation Details</h3>
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
              {/* Image */}
              <div className="flex justify-center">
                <div className="relative w-full max-h-[50vh] aspect-video">
                  {selectedImage.imageUrl?.startsWith("data:") ? (
                    <img
                      src={selectedImage.imageUrl}
                      alt={selectedImage.prompt}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <Image
                      src={selectedImage.imageUrl || ""}
                      alt={selectedImage.prompt}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain rounded-xl"
                      priority
                    />
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="bg-secondary/30 rounded-xl p-4">
                  <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Prompt</p>
                  <p className="text-sm text-foreground">{selectedImage.prompt}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Mode</p>
                    <p className="text-sm text-foreground capitalize">{selectedImage.mode.replace("-", " ")}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Size</p>
                    <p className="text-sm text-foreground">{selectedImage.imageSize}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Aspect</p>
                    <p className="text-sm text-foreground capitalize">{selectedImage.aspectRatio}</p>
                  </div>
                  {selectedImage.artStyle ? (
                    <div className="bg-secondary/30 rounded-xl p-3">
                      <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Legacy Style</p>
                      <p className="text-sm text-foreground">{selectedImage.artStyle}</p>
                    </div>
                  ) : null}
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Est. Cost</p>
                    <p className="text-sm text-emerald-600 font-medium">
                      {selectedImage.estimatedCost !== undefined 
                        ? `$${selectedImage.estimatedCost.toFixed(4)}`
                        : "—"
                      }
                    </p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Model</p>
                    <p className="text-sm text-foreground truncate" title={selectedImage.model || "Unknown"}>
                      {selectedImage.model?.replace("gemini-", "").replace("-preview", "") || "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="bg-secondary/30 rounded-xl p-3">
                  <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">Created</p>
                  <p className="text-sm text-foreground">
                    {selectedImageFormattedDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => handleCopyPrompt(selectedImage)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                {copiedPromptId === selectedImage._id ? (
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
                onClick={() => handleDownload(selectedImage)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              {onUseAsInput && selectedImage.imageUrl && (
                <button
                  onClick={() => {
                    onUseAsInput(selectedImage.imageUrl!)
                    handleCloseModal()
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m0-16l-4 4m4-4l4 4M4 12h16" />
                  </svg>
                  Use as Input
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

