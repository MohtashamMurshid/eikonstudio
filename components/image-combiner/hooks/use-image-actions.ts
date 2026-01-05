import { useCallback } from "react"
import type { GeneratedImage } from "../types"

interface UseImageActionsProps {
  generatedImage: GeneratedImage | null
  currentMode: "text-to-image" | "image-editing"
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function useImageActions({
  generatedImage,
  currentMode,
  onError,
  onSuccess,
}: UseImageActionsProps) {
  // Helper to convert any image blob to PNG
  const convertToPngBlob = useCallback((blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((pngBlob) => {
          if (pngBlob) resolve(pngBlob)
          else reject(new Error("Could not convert to PNG"))
        }, "image/png")
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = URL.createObjectURL(blob)
    })
  }, [])

  const downloadImage = useCallback(async () => {
    if (!generatedImage) return

    try {
      const response = await fetch(generatedImage.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `eikon-${currentMode}-result.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading image:", error)
      window.open(generatedImage.url, "_blank")
    }
  }, [generatedImage, currentMode])

  const copyImageToClipboard = useCallback(async () => {
    if (!generatedImage) return

    try {
      onSuccess("Copying image...")

      const imageUrl = generatedImage.url

      // For data URLs, convert to PNG blob using canvas for proper clipboard support
      if (imageUrl.startsWith("data:")) {
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext("2d")
            if (!ctx) {
              reject(new Error("Could not get canvas context"))
              return
            }
            ctx.drawImage(img, 0, 0)
            canvas.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error("Could not create blob"))
                return
              }
              try {
                const clipboardItem = new ClipboardItem({ "image/png": blob })
                await navigator.clipboard.write([clipboardItem])
                onSuccess("Image copied to clipboard!")
                resolve()
              } catch (clipErr) {
                reject(clipErr)
              }
            }, "image/png")
          }
          img.onerror = () => reject(new Error("Failed to load image"))
          img.src = imageUrl
        })
      } else {
        // For regular URLs, fetch and copy
        window.focus()
        let response
        try {
          response = await fetch(imageUrl, { mode: "cors" })
        } catch {
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
          response = await fetch(proxyUrl)
        }
        if (!response.ok) throw new Error("Failed to fetch image")
        const blob = await response.blob()
        // Ensure it's PNG for clipboard compatibility
        const pngBlob = blob.type === "image/png" ? blob : await convertToPngBlob(blob)
        const clipboardItem = new ClipboardItem({ "image/png": pngBlob })
        await navigator.clipboard.write([clipboardItem])
        onSuccess("Image copied to clipboard!")
      }
    } catch (error) {
      console.error("Error copying image:", error)
      if (error instanceof Error && error.message.includes("not focused")) {
        onError("Please click on the page first, then try copying again")
      } else {
        onError("Failed to copy image to clipboard")
      }
    }
  }, [generatedImage, convertToPngBlob, onError, onSuccess])

  return {
    downloadImage,
    copyImageToClipboard,
  }
}

