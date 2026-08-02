import { useState, useCallback } from "react"
import type { GeneratedImage } from "../types"
import type { Id } from "@/convex/_generated/dataModel"

interface UseGalleryOperationsProps {
  generatedImage: GeneratedImage | null
  generateUploadUrl: () => Promise<string>
  saveToGallery: (params: { filename: string; imageStorageId: Id<"_storage">; thumbnailStorageId: Id<"_storage">; folderId?: Id<"folders"> }) => Promise<void>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}
/**
 * Hook for adding images to the gallery
 * @param generatedImage - The generated image to add to the gallery
 * @param generateUploadUrl - The function to generate a upload URL for the image
 * @param saveToGallery - The function to save the image to the gallery
 * @param onError - The function to call if there is an error
 * @param onSuccess - The function to call if the image is added to the gallery
 */
export function useGalleryOperations({
  generatedImage,
  generateUploadUrl,
  saveToGallery,
  onError,
  onSuccess,
}: UseGalleryOperationsProps) {
  const [isAddingToGallery, setIsAddingToGallery] = useState(false)

  const addToGallery = useCallback(async () => {
    if (!generatedImage?.url) return

    setIsAddingToGallery(true)
    try {
      const imageUrl = generatedImage.url

      // Convert data URL to blob
      const response = await fetch(imageUrl)
      const imageBlob = await response.blob()

      // Generate thumbnail
      const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const size = 250
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
          }

          // Calculate dimensions to maintain aspect ratio
          let width = size
          let height = size
          if (img.width > img.height) {
            height = (img.height / img.width) * size
          } else {
            width = (img.width / img.height) * size
          }

          // Fill with background and center image
          ctx.fillStyle = "#f5f5f5"
          ctx.fillRect(0, 0, size, size)
          const x = (size - width) / 2
          const y = (size - height) / 2
          ctx.drawImage(img, x, y, width, height)

          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error("Could not create thumbnail"))
          }, "image/jpeg", 0.7)
        }
        img.onerror = () => reject(new Error("Failed to load image"))
        img.src = imageUrl
      })

      // Upload both to storage
      const [imageUploadUrl, thumbnailUploadUrl] = await Promise.all([
        generateUploadUrl(),
        generateUploadUrl(),
      ])

      const [imageUploadRes, thumbnailUploadRes] = await Promise.all([
        fetch(imageUploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageBlob.type || "image/png" },
          body: imageBlob,
        }),
        fetch(thumbnailUploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: thumbnailBlob,
        }),
      ])

      const [{ storageId: imageStorageId }, { storageId: thumbnailStorageId }] = await Promise.all([
        imageUploadRes.json(),
        thumbnailUploadRes.json(),
      ])

      // Generate a unique filename based on timestamp
      const filename = `gen-${Date.now()}`

      await saveToGallery({
        filename,
        imageStorageId,
        thumbnailStorageId,
      })

      onSuccess("Image added to gallery!")
    } catch (error) {
      console.error("Error adding to gallery:", error)
      onError("Failed to add to gallery")
    } finally {
      setIsAddingToGallery(false)
    }
  }, [generatedImage, generateUploadUrl, saveToGallery, onError, onSuccess])

  return {
    addToGallery,
    isAddingToGallery,
  }
}

