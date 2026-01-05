"use client"

import { useState, memo } from "react"
import type { Folder, GalleryImage } from "./types"

interface FolderCardProps {
  folder: Folder
  previewImages: GalleryImage[]
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

export const FolderCard = memo(({
  folder,
  previewImages,
  onOpen,
  onRename,
  onDelete,
}: FolderCardProps) => {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className="group relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl overflow-hidden border border-amber-200/60 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100/50 transition-all cursor-pointer"
      onClick={onOpen}
    >
      {/* Thumbnail Preview Grid */}
      <div className="aspect-square relative p-3">
        <div className="w-full h-full rounded-lg overflow-hidden bg-white/60 border border-amber-100">
          {previewImages.length > 0 ? (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="relative bg-amber-50">
                  {previewImages[idx]?.thumbnailUrl ? (
                    <img
                      src={previewImages[idx].thumbnailUrl!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Folder icon badge */}
        <div className="absolute top-1.5 left-1.5 w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="p-2.5 bg-white/90 hover:bg-white rounded-xl transition-colors shadow-sm"
            title="Open folder"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-2.5 bg-white/90 hover:bg-white rounded-xl transition-colors shadow-sm"
              title="More options"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {showMenu && (
              <div 
                className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-border py-1 z-20 min-w-[120px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onRename()
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground/70 hover:bg-secondary flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Rename
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onDelete()
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 pb-3">
        <p className="text-sm font-medium text-foreground truncate">{folder.name}</p>
        <p className="text-xs text-foreground/50 mt-0.5">
          {folder.imageCount} image{folder.imageCount !== 1 ? "s" : ""} • @{folder.name}
        </p>
      </div>
    </div>
  )
})

FolderCard.displayName = "FolderCard"

