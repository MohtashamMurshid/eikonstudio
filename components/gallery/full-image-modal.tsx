"use client"

import type { Id } from "@/convex/_generated/dataModel"
import type { GalleryImage } from "./types"

interface FullImageModalProps {
  image: GalleryImage | null
  deletingId: Id<"gallery"> | null
  onClose: () => void
  onRename: (id: Id<"gallery">, currentName: string) => void
  onDelete: (id: Id<"gallery">) => void
  onMove: (id: Id<"gallery">) => void
}

export function FullImageModal({
  image,
  deletingId,
  onClose,
  onRename,
  onDelete,
  onMove,
}: FullImageModalProps) {
  if (!image) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">@{image.filename}</h3>
            <p className="text-xs text-foreground/50">
              {image.folderName ? `In folder: ${image.folderName}` : "Uncategorized"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex justify-center">
            <img
              src={image.imageUrl || ""}
              alt={image.filename}
              className="max-w-full max-h-[50vh] object-contain rounded-xl"
            />
          </div>

          <div className="bg-secondary/30 rounded-xl p-4">
            <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-2">Usage</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="px-3 py-1.5 bg-white rounded-lg text-sm font-mono text-emerald-600 border border-border">
                @{image.folderName 
                  ? `${image.folderName}/${image.filename}` 
                  : image.filename}
              </code>
              <button
                onClick={async () => {
                  const path = image.folderName 
                    ? `${image.folderName}/${image.filename}` 
                    : image.filename
                  await navigator.clipboard.writeText(`@${path}`)
                }}
                className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-foreground/50 mt-2">
              Add this to your prompt to use this image as a reference
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={() => onMove(image._id)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Move
          </button>
          <button
            onClick={() => onRename(image._id, image.filename)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Rename
          </button>
          <button
            onClick={() => onDelete(image._id)}
            disabled={deletingId === image._id}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

