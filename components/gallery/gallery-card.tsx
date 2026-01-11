"use client"

import { memo } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { GalleryImage } from "./types"
import { LazyImage } from "./lazy-image"

interface GalleryCardProps {
  image: GalleryImage
  onRename: (id: Id<"gallery">, currentName: string) => void
  onDelete: (id: Id<"gallery">) => void
  onViewFull: (image: GalleryImage) => void
  onMove?: (id: Id<"gallery">) => void
  deletingId: Id<"gallery"> | null
  renamingId: Id<"gallery"> | null
  movingId?: Id<"gallery"> | null
  showFolderBadge?: boolean
}

export const GalleryCard = memo(({
  image,
  onRename,
  onDelete,
  onViewFull,
  onMove,
  deletingId,
  renamingId,
  movingId,
  showFolderBadge = true,
}: GalleryCardProps) => {
  const displayPath = image.folderName 
    ? `${image.folderName}/${image.filename}` 
    : image.filename
  
  const isMoving = movingId === image._id

  return (
    <div
      className={`group relative bg-secondary/30 rounded-xl overflow-hidden border border-border transition-all ${
        isMoving ? "opacity-75" : "hover:border-foreground/20 cursor-pointer"
      }`}
      onClick={() => !isMoving && onViewFull(image)}
    >
      {/* Image */}
      <div className="aspect-square relative">
        <LazyImage
          src={image.thumbnailUrl || ""}
          alt={image.filename}
          className="aspect-square relative"
        />
        
        {/* Folder badge */}
        {showFolderBadge && image.folderName && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-foreground/80 text-background text-[10px] font-medium rounded">
            {image.folderName}
          </div>
        )}
        
        {/* Overlay on hover - hide when moving */}
        {!isMoving && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRename(image._id, image.filename)
              }}
              disabled={renamingId === image._id}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              title="Rename"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {onMove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMove(image._id)
                }}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                title="Move to folder"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(image._id)
              }}
              disabled={deletingId === image._id}
              className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
              title="Delete"
            >
              {deletingId === image._id ? (
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
        )}
        
        {/* Moving overlay */}
        {isMoving && (
          <div className="absolute inset-0 z-20 bg-background/80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-6 h-6 text-foreground animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs font-medium text-foreground/70">Moving...</span>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-medium text-foreground truncate" title={`@${displayPath}`}>
          @{image.filename}
        </p>
        <p className="text-[10px] text-foreground/40 mt-0.5">
          Use in prompt: @{displayPath}
        </p>
      </div>
    </div>
  )
})

GalleryCard.displayName = "GalleryCard"

