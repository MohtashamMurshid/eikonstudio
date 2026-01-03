import { useEffect } from "react"

interface UsePasteHandlerOptions {
  useUrls: boolean
  image1: File | null
  image2: File | null
  image1Url: string
  image2Url: string
  handleImageUpload: (file: File, imageNumber: 1 | 2) => void
  handleUrlChange: (url: string, imageNumber: 1 | 2) => void
  setUseUrls: (value: boolean) => void
}

export const usePasteHandler = (options: UsePasteHandlerOptions) => {
  const { useUrls, image1, image2, image1Url, image2Url, handleImageUpload, handleUrlChange, setUseUrls } = options

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
            // Find first available slot
            if (!useUrls && !image1) {
              handleImageUpload(file, 1)
            } else if (!useUrls && !image2) {
              handleImageUpload(file, 2)
            } else {
              handleImageUpload(file, 1) // Replace first image
            }
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
              // Find first available URL slot
              if (!image1Url) {
                handleUrlChange(trimmedText, 1)
              } else if (!image2Url) {
                handleUrlChange(trimmedText, 2)
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
  }, [useUrls, image1, image2, image1Url, image2Url, handleImageUpload, handleUrlChange, setUseUrls])
}

