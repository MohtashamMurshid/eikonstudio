"use client"

import { useState, useEffect, useRef, useCallback, memo } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"

interface GalleryImageResult {
  _id: string
  filename: string
  thumbnailData: string
  imageData: string
}

interface MentionAutocompleteProps {
  inputValue: string
  cursorPosition: number
  onSelect: (filename: string, startIndex: number, endIndex: number, imageData: string) => void
  onClose: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

// Find the @ mention being typed at cursor position
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
      // Found @ - now extract the search term
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
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find mention at cursor
  const mention = findMentionAtCursor(inputValue, cursorPosition)
  
  // Query gallery images
  const searchResults = useQuery(
    api.gallery.searchImages,
    mention ? { searchTerm: mention.searchTerm, limit: 6 } : "skip"
  ) as GalleryImageResult[] | undefined

  const images = searchResults ?? []
  const showDropdown = mention !== null && images.length > 0

  // Calculate dropdown position based on "@" position - positioned ABOVE the @
  // Using fixed positioning to escape overflow-hidden containers
  useEffect(() => {
    if (!showDropdown || !textareaRef.current || !mention) return

    const textarea = textareaRef.current
    const textareaRect = textarea.getBoundingClientRect()
    
    // Get text up to the "@" symbol position
    const textBeforeAt = inputValue.slice(0, mention.startIndex)
    const computedStyle = window.getComputedStyle(textarea)
    
    // Calculate position of the "@" symbol
    const lines = textBeforeAt.split("\n")
    const lastLine = lines[lines.length - 1]
    
    // Estimate character width
    const avgCharWidth = 8
    const xOffset = Math.max(0, lastLine.length * avgCharWidth)
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 12

    // Position above the textarea using fixed coordinates
    setPosition({
      top: textareaRect.top - 8, // Just above the textarea
      left: textareaRect.left + paddingLeft + Math.min(xOffset, textarea.clientWidth - 200),
    })
  }, [showDropdown, inputValue, mention, textareaRef, images.length])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [images.length, mention?.searchTerm])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showDropdown) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % images.length)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + images.length) % images.length)
        break
      case "Enter":
      case "Tab":
        e.preventDefault()
        if (images[selectedIndex] && mention) {
          onSelect(images[selectedIndex].filename, mention.startIndex, mention.endIndex, images[selectedIndex].imageData)
        }
        break
      case "Escape":
        e.preventDefault()
        onClose()
        break
    }
  }, [showDropdown, images, selectedIndex, mention, onSelect, onClose])

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

  if (!showDropdown) return null

  // Calculate dropdown height for positioning above
  const dropdownHeight = Math.min(images.length, 5) * 36 + 8

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[100] bg-white border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-100"
      style={{
        top: position.top - dropdownHeight,
        left: position.left,
        minWidth: "180px",
        maxWidth: "240px",
      }}
    >
      <div className="max-h-[180px] overflow-y-auto">
        {images.map((image, index) => (
          <button
            key={image._id}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
              index === selectedIndex
                ? "bg-emerald-50"
                : "hover:bg-secondary/50"
            }`}
            onClick={() => {
              if (mention) {
                onSelect(image.filename, mention.startIndex, mention.endIndex, image.imageData)
              }
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <img
              src={image.thumbnailData}
              alt={image.filename}
              className="w-7 h-7 rounded object-cover border border-border/50 flex-shrink-0"
            />
            <span className="text-sm truncate">@{image.filename}</span>
          </button>
        ))}
      </div>
    </div>
  )
})

