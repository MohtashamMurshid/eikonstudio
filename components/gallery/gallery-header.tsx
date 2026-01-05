"use client"

import { memo } from "react"
import type { Folder } from "./types"
import { Breadcrumb } from "./breadcrumb"

interface GalleryHeaderProps {
  currentFolder: Folder | null
  currentFolderId: string | null
  foldersCount: number
  uncategorizedImagesCount: number
  currentViewImagesCount: number
  searchTerm: string
  onSearchChange: (term: string) => void
  onNavigateToRoot: () => void
  onCreateFolder: () => void
  onUploadClick: () => void
  uploadProgress: string | null
  isUploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const GalleryHeader = memo(({
  currentFolder,
  currentFolderId,
  foldersCount,
  uncategorizedImagesCount,
  currentViewImagesCount,
  searchTerm,
  onSearchChange,
  onNavigateToRoot,
  onCreateFolder,
  onUploadClick,
  uploadProgress,
  isUploading,
  fileInputRef,
  onFileSelect,
}: GalleryHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <Breadcrumb
          currentFolder={currentFolder}
          onNavigateToRoot={onNavigateToRoot}
        />
        <p className="text-sm text-foreground/50 mt-1">
          {currentFolderId 
            ? `${currentViewImagesCount} image${currentViewImagesCount !== 1 ? "s" : ""} in folder`
            : `${foldersCount} folder${foldersCount !== 1 ? "s" : ""} • ${uncategorizedImagesCount} loose image${uncategorizedImagesCount !== 1 ? "s" : ""}`
          }
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {currentFolderId && (
          <button
            onClick={onNavigateToRoot}
            className="sm:hidden h-9 px-3 flex items-center gap-1.5 bg-secondary/50 hover:bg-secondary rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-36 sm:w-48 h-9 pl-9 pr-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        
        {!currentFolderId && (
          <button
            onClick={onCreateFolder}
            className="h-9 px-3 flex items-center gap-2 bg-secondary/50 hover:bg-secondary rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Folder</span>
          </button>
        )}
        
        <button
          onClick={onUploadClick}
          disabled={isUploading}
          className="h-9 px-3 flex items-center gap-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {uploadProgress ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="hidden sm:inline">{uploadProgress}</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Upload</span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>
    </div>
  )
})

GalleryHeader.displayName = "GalleryHeader"

