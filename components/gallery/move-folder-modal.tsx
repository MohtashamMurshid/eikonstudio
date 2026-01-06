"use client"

import { useState } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { Folder } from "./types"

interface MoveFolderModalProps {
  isOpen: boolean
  folders: Folder[] | undefined
  isLoading?: boolean
  error?: string
  onClose: () => void
  onMove: (folderId: Id<"folders"> | undefined) => void
}

export function MoveFolderModal({
  isOpen,
  folders,
  isLoading = false,
  error,
  onClose,
  onMove,
}: MoveFolderModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | undefined | null>(null)

  if (!isOpen) return null

  const handleMove = (folderId: Id<"folders"> | undefined) => {
    setSelectedFolderId(folderId)
    onMove(folderId)
  }

  const handleClose = () => {
    if (!isLoading) {
      setSelectedFolderId(null)
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Move to Folder</h3>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
          {/* Uncategorized option */}
          <button
            onClick={() => handleMove(undefined)}
            disabled={isLoading}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
              isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
            }`}
          >
            {isLoading && selectedFolderId === undefined ? (
              <svg className="w-4 h-4 text-foreground/60 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            )}
            Uncategorized
          </button>
          
          {/* Folder options */}
          {folders?.map((folder) => {
            const isThisFolderLoading = isLoading && selectedFolderId === folder._id
            return (
              <button
                key={folder._id}
                onClick={() => handleMove(folder._id)}
                disabled={folder.isFull || isLoading}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  folder.isFull || isLoading
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-secondary"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isThisFolderLoading ? (
                    <svg className="w-4 h-4 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  )}
                  {folder.name}
                </span>
                <span className={`text-xs ${folder.isFull ? "text-amber-500" : "text-foreground/50"}`}>
                  {folder.imageCount}/4
                </span>
              </button>
            )
          })}
          
          {(!folders || folders.length === 0) && (
            <p className="text-sm text-foreground/50 text-center py-4">
              No folders yet. Create one first!
            </p>
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <div className="px-4 pb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

