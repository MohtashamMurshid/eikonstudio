"use client"

import { useState } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { Folder } from "./types"

interface UploadModalProps {
  isOpen: boolean
  preview: string | null
  filename: string
  folderId: Id<"folders"> | undefined
  folders: Folder[] | undefined
  error: string
  isUploading: boolean
  onClose: () => void
  onFilenameChange: (filename: string) => void
  onFolderChange: (folderId: Id<"folders"> | undefined) => void
  onConfirm: () => void
}

export function UploadModal({
  isOpen,
  preview,
  filename,
  folderId,
  folders,
  error,
  isUploading,
  onClose,
  onFilenameChange,
  onFolderChange,
  onConfirm,
}: UploadModalProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Add to Gallery</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {preview && (
            <div className="flex justify-center">
              <img
                src={preview}
                alt="Preview"
                className="max-w-full max-h-48 object-contain rounded-xl border border-border"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Filename (for @mention)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">@</span>
              <input
                type="text"
                value={filename}
                onChange={(e) => {
                  onFilenameChange(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
                }}
                placeholder="my-reference-image"
                className="w-full h-10 pl-7 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                maxLength={30}
              />
            </div>
            <p className="text-xs text-foreground/40 mt-1">
              Letters, numbers, hyphens, and underscores only
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Folder (optional)
            </label>
            <select
              value={folderId || ""}
              onChange={(e) => onFolderChange(e.target.value ? e.target.value as Id<"folders"> : undefined)}
              className="w-full h-10 px-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No folder (uncategorized)</option>
              {folders?.map((folder) => (
                <option 
                  key={folder._id} 
                  value={folder._id}
                  disabled={folder.isFull}
                >
                  {folder.name} ({folder.imageCount}/4){folder.isFull ? " - Full" : ""}
                </option>
              ))}
            </select>
          </div>
          
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-foreground/50 mb-1">Use in prompts:</p>
            <code className="text-sm text-emerald-600 font-mono">
              @{folderId && folders?.find(f => f._id === folderId)?.name 
                ? `${folders.find(f => f._id === folderId)?.name}/${filename || "filename"}`
                : filename || "filename"}
            </code>
          </div>
          
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isUploading || !filename.trim()}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {isUploading ? "Saving..." : "Add to Gallery"}
          </button>
        </div>
      </div>
    </div>
  )
}

