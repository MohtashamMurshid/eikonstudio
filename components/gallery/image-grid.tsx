"use client"

import { memo } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { GalleryImage } from "./types"
import { GalleryCard } from "./gallery-card"

interface ImageGridProps {
  images: GalleryImage[]
  onRename: (id: Id<"gallery">, currentName: string) => void
  onDelete: (id: Id<"gallery">) => void
  onViewFull: (image: GalleryImage) => void
  onMove?: (id: Id<"gallery">) => void
  deletingId: Id<"gallery"> | null
  renamingId: Id<"gallery"> | null
  showFolderBadge?: boolean
  emptyState?: {
    searchTerm?: string
    message?: string
    actionLabel?: string
    onAction?: () => void
  }
}

export const ImageGrid = memo(({
  images,
  onRename,
  onDelete,
  onViewFull,
  onMove,
  deletingId,
  renamingId,
  showFolderBadge = false,
  emptyState,
}: ImageGridProps) => {
  if (images.length === 0) {
    if (emptyState) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          {emptyState.searchTerm ? (
            <p className="text-foreground/50">No images match "{emptyState.searchTerm}"</p>
          ) : (
            <>
              {emptyState.message && (
                <>
                  <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Empty folder</h3>
                  <p className="text-sm text-foreground/50 max-w-sm mb-4">
                    {emptyState.message}
                  </p>
                  {emptyState.actionLabel && emptyState.onAction && (
                    <button
                      onClick={emptyState.onAction}
                      className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
                    >
                      {emptyState.actionLabel}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {images.map((image) => (
        <GalleryCard
          key={image._id}
          image={image}
          onRename={onRename}
          onDelete={onDelete}
          onViewFull={onViewFull}
          onMove={onMove}
          deletingId={deletingId}
          renamingId={renamingId}
          showFolderBadge={showFolderBadge}
        />
      ))}
    </div>
  )
})

ImageGrid.displayName = "ImageGrid"

