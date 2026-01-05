import { useEffect } from "react"
import type { ImageSlot } from "./use-image-upload"

interface UsePasteHandlerOptions {
  useUrls: boolean
  image1: File | null
  image2: File | null
  image3: File | null
  image4: File | null
  image1Url: string
  image2Url: string
  image3Url: string
  image4Url: string
  handleImageUpload: (file: File, imageNumber: ImageSlot) => void
  handleUrlChange: (url: string, imageNumber: ImageSlot) => void
  setUseUrls: (value: boolean) => void
  getFirstAvailableSlot: () => ImageSlot | null
}

export const usePasteHandler = (options: UsePasteHandlerOptions) => {
  const { 
    useUrls, image1, image2, image3, image4, 
    image1Url, image2Url, image3Url, image4Url, 
    handleImageUpload, handleUrlChange, setUseUrls,
    getFirstAvailableSlot
  } = options

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // Handle image files - always handle images regardless of focus
        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            if (useUrls) {
              setUseUrls(false)
            }
            // Find first available slot (1-4)
            const slot = getFirstAvailableSlot()
            handleImageUpload(file, slot || 1)
          }
          return
        }

        // Handle text (URLs) - only if no input is focused or if it's a URL
        if (item.type === "text/plain") {
          item.getAsString((text) => {
            const trimmedText = text.trim()
            // Check if it's a URL
            if (trimmedText.match(/^https?:\/\/.+/)) {
              const activeElement = document.activeElement
              const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"

              // If focused on a URL input, let it handle the paste naturally
              if (isInputFocused && activeElement?.getAttribute("type") === "url") {
                return
              }

              // Otherwise, handle it globally
              e.preventDefault()
              // Switch to URLs mode if not already
              if (!useUrls) {
                setUseUrls(true)
              }
              // Find first available URL slot (1-4)
              if (!image1Url) {
                handleUrlChange(trimmedText, 1)
              } else if (!image2Url) {
                handleUrlChange(trimmedText, 2)
              } else if (!image3Url) {
                handleUrlChange(trimmedText, 3)
              } else if (!image4Url) {
                handleUrlChange(trimmedText, 4)
              } else {
                handleUrlChange(trimmedText, 1) // Replace first URL
              }
            }
          })
          return
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [useUrls, image1, image2, image3, image4, image1Url, image2Url, image3Url, image4Url, handleImageUpload, handleUrlChange, setUseUrls, getFirstAvailableSlot])
}

