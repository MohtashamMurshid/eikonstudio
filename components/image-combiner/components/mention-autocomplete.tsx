"use client"

import { useState, useEffect, useRef, useCallback, memo, useLayoutEffect } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"

interface GalleryImageResult {
  _id: string
  filename: string
  folderId?: string
  folderName?: string | null
  fullPath: string
  thumbnailUrl: string | null
  imageUrl: string | null
}

interface FolderResult {
  _id: string
  name: string
  imageCount: number
  isFull: boolean
}

interface SearchResults {
  images: GalleryImageResult[]
  folders: FolderResult[]
}

interface MentionAutocompleteProps {
  inputValue: string
  cursorPosition: number
  onSelect: (filename: string, startIndex: number, endIndex: number, imageData: string | string[], isFolder?: boolean) => void
  onClose: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

// Find the @ mention being typed at cursor position (supports folder/filename)
function findMentionAtCursor(text: string, cursorPos: number): { searchTerm: string; startIndex: number; endIndex: number } | null {
  // Look backwards from cursor to find @
  let startIndex = cursorPos - 1
  while (startIndex >= 0) {
    const char = text[startIndex]
    // If we hit whitespace or start of text before @, no mention
    if (/\s/.test(char)) {
      return null
    }
    if (char === "@") {
      // Found @ - now extract the search term (can include / for folder/filename)
      const searchTerm = text.slice(startIndex + 1, cursorPos)
      return {
        searchTerm,
        startIndex,
        endIndex: cursorPos,
      }
    }
    startIndex--
  }
  return null
}

export const MentionAutocomplete = memo(function MentionAutocomplete({
  inputValue,
  cursorPosition,
  onSelect,
  onClose,
  textareaRef,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find mention at cursor
  const mention = findMentionAtCursor(inputValue, cursorPosition)
  
  // Query gallery images and folders
  const searchResults = useQuery(
    api.gallery.searchImages,
    mention !== null ? { searchTerm: mention.searchTerm, limit: 6 } : "skip"
  ) as SearchResults | undefined

  const images = searchResults?.images ?? []
  const folders = searchResults?.folders ?? []
  
  // Combine folders and images for display
  const combinedResults: Array<{ type: "folder" | "image"; data: FolderResult | GalleryImageResult }> = [
    ...folders.map(f => ({ type: "folder" as const, data: f })),
    ...images.map(i => ({ type: "image" as const, data: i })),
  ]

  const isLoading = mention !== null && searchResults === undefined
  const showDropdown = mention !== null && (combinedResults.length > 0 || isLoading)

  // Calculate dropdown position based on "@" position - positioned ABOVE the @
  useLayoutEffect(() => {
    if (!showDropdown || !textareaRef.current || !mention) {
      if (position !== null) {
        setPosition(null)
      }
      return
    }

    const textarea = textareaRef.current
    const textareaRect = textarea.getBoundingClientRect()
    
    const textBeforeAt = inputValue.slice(0, mention.startIndex)
    const computedStyle = window.getComputedStyle(textarea)
    
    const lines = textBeforeAt.split("\n")
    const lastLine = lines[lines.length - 1]
    
    const avgCharWidth = 8
    const xOffset = Math.max(0, lastLine.length * avgCharWidth)
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 12

    const newTop = textareaRect.top - 8
    const newLeft = textareaRect.left + paddingLeft + Math.min(xOffset, textarea.clientWidth - 200)

    setPosition(prev => {
      if (prev?.top === newTop && prev?.left === newLeft) {
        return prev
      }
      return { top: newTop, left: newLeft }
    })
  }, [showDropdown, inputValue, mention, textareaRef, combinedResults.length, position])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [combinedResults.length, mention?.searchTerm])

  // Handle selection
  const handleSelect = useCallback((index: number) => {
    if (!mention) return
    
    const item = combinedResults[index]
    if (!item) return

    if (item.type === "folder") {
      const folder = item.data as FolderResult
      // For folder selection, pass isFolder=true so parent can fetch images
      onSelect(folder.name, mention.startIndex, mention.endIndex, [], true)
    } else {
      const image = item.data as GalleryImageResult
      if (image.imageUrl) {
        onSelect(image.fullPath, mention.startIndex, mention.endIndex, image.imageUrl, false)
      }
    }
  }, [mention, combinedResults, onSelect])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showDropdown) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % combinedResults.length)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + combinedResults.length) % combinedResults.length)
        break
      case "Enter":
      case "Tab":
        e.preventDefault()
        handleSelect(selectedIndex)
        break
      case "Escape":
        e.preventDefault()
        onClose()
        break
    }
  }, [showDropdown, combinedResults.length, selectedIndex, handleSelect, onClose])

  useEffect(() => {
    if (showDropdown) {
      window.addEventListener("keydown", handleKeyDown, true)
      return () => window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [showDropdown, handleKeyDown])

  // Click outside to close
  useEffect(() => {
    if (!showDropdown) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showDropdown, onClose])

  if (!showDropdown || !position) return null

  const dropdownHeight = isLoading ? 44 : Math.min(combinedResults.length, 6) * 40 + 8

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[100] bg-white border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in duration-100"
      style={{
        top: position.top - dropdownHeight,
        left: position.left,
        minWidth: "200px",
        maxWidth: "280px",
      }}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-2.5 text-muted-foreground">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm">Searching...</span>
        </div>
      ) : (
        <div className="max-h-[240px] overflow-y-auto">
          {combinedResults.map((item, index) => {
            if (item.type === "folder") {
              const folder = item.data as FolderResult
              return (
                <button
                  key={`folder-${folder._id}`}
                  className={`w-full flex items-center gap-2 px-2 py-2 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-emerald-50"
                      : "hover:bg-secondary/50"
                  }`}
                  onClick={() => handleSelect(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="w-7 h-7 rounded bg-foreground/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">@{folder.name}</span>
                    <span className="text-xs text-foreground/50">
                      {folder.imageCount} image{folder.imageCount !== 1 ? "s" : ""} • Load all
                    </span>
                  </div>
                </button>
              )
            } else {
              const image = item.data as GalleryImageResult
              return (
                <button
                  key={`image-${image._id}`}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-emerald-50"
                      : "hover:bg-secondary/50"
                  }`}
                  onClick={() => handleSelect(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <img
                    src={image.thumbnailUrl || ""}
                    alt={image.filename}
                    className="w-7 h-7 rounded object-cover border border-border/50 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">@{image.fullPath}</span>
                    {image.folderName && (
                      <span className="text-xs text-foreground/50">in {image.folderName}</span>
                    )}
                  </div>
                </button>
              )
            }
          })}
        </div>
      )}
    </div>
  )
})
