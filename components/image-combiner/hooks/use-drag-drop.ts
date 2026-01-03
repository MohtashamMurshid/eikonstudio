import { useState } from "react"

interface UseDragDropOptions {
  useUrls: boolean
  image1: File | null
  image2: File | null
  handleImageUpload: (file: File, imageNumber: 1 | 2) => void
  onError?: (message: string) => void
}

export const useDragDrop = (options: UseDragDropOptions) => {
  const { useUrls, image1, image2, handleImageUpload, onError } = options
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
      if (!useUrls && !image1) {
        handleImageUpload(file, 1)
      } else if (!useUrls && !image2) {
        handleImageUpload(file, 2)
      } else if (!useUrls && image1 && !image2) {
        handleImageUpload(file, 2)
      } else {
        handleImageUpload(file, 1)
      }
    } else {
      onError?.("Please drop a valid image file")
    }
  }

  const handleDrop = (e: React.DragEvent, imageNumber: 1 | 2) => {
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

