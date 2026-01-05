import { useState } from "react"
import type { ImageSlot } from "./use-image-upload"

interface UseDragDropOptions {
  useUrls: boolean
  image1: File | null
  image2: File | null
  image3: File | null
  image4: File | null
  handleImageUpload: (file: File, imageNumber: ImageSlot) => void
  getFirstAvailableSlot: () => ImageSlot | null
  onError?: (message: string) => void
}

/**
 * Hook for handling drag and drop events
 * @param useUrls - Whether to use URLs for the images
 * @param image1 - The first image
 * @param image2 - The second image
 * @param image3 - The third image
 * @param image4 - The fourth image
 * @param handleImageUpload - The function to upload the image
 * @param getFirstAvailableSlot - The function to get the first available slot
 * @param onError - The function to call if there is an error
 */
export const useDragDrop = (options: UseDragDropOptions) => {
  const { useUrls, handleImageUpload, getFirstAvailableSlot, onError } = options
  const [isDragOver, setIsDragOver] = useState(false)

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
    }
  }

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      // Find first available slot (1-4)
      const slot = getFirstAvailableSlot()
      handleImageUpload(file, slot || 1)
    } else {
      onError?.("Please drop a valid image file")
    }
  }

  const handleDrop = (e: React.DragEvent, imageNumber: ImageSlot) => {
    e.preventDefault()
    setIsDragOver(false)
    console.log("File dropped for image", imageNumber)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      console.log("Valid image file dropped:", file.name)
      handleImageUpload(file, imageNumber)
    } else {
      console.log("Invalid file type or no file:", file?.type)
      onError?.("Please drop a valid image file")
    }
  }

  return {
    isDragOver,
    handleGlobalDragEnter,
    handleGlobalDragLeave,
    handleGlobalDragOver,
    handleGlobalDrop,
    handleDrop,
  }
}

