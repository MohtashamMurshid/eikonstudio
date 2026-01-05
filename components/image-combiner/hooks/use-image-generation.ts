import { useState } from "react"
import type { GeneratedImage } from "../types"
import type { Id } from "@/convex/_generated/dataModel"

interface SaveGenerationParams {
  prompt: string
  imageStorageId: Id<"_storage">
  thumbnailStorageId: Id<"_storage">
  mode: "text-to-image" | "image-editing"
  aspectRatio: string
  imageSize: string
  artStyle?: string
}

// Convert data URL to Blob
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl)
  return await response.blob()
}

// Generate compressed thumbnail from image URL/data and return as Blob
const generateThumbnailBlob = async (src: string, size = 250): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    
    img.onload = () => {
      const canvas = document.createElement("canvas")
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
      
      canvas.width = size
      canvas.height = size
      
      // Center the image
      const x = (size - width) / 2
      const y = (size - height) / 2
      
      // Fill with white background
      ctx.fillStyle = "#f5f5f5"
      ctx.fillRect(0, 0, size, size)
      
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "medium"
      
      ctx.drawImage(img, x, y, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("Could not create blob"))
          }
        },
        "image/jpeg",
        0.7
      )
    }
    
    img.onerror = () => {
      reject(new Error("Could not load image"))
    }
    
    img.src = src
  })
}

// Upload blob to Convex storage
const uploadToStorage = async (
  blob: Blob,
  generateUploadUrl: () => Promise<string>
): Promise<Id<"_storage">> => {
  const uploadUrl = await generateUploadUrl()
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  })
  const { storageId } = await response.json()
  return storageId
}

interface UseImageGenerationOptions {
  apiKey: string
  currentMode: "text-to-image" | "image-editing"
  useUrls: boolean
  image1: File | null
  image1Url: string
  image2: File | null
  image2Url: string
  image3: File | null
  image3Url: string
  image4: File | null
  image4Url: string
  prompt: string
  aspectRatio: string
  imageSize: string
  selectedArtStyle: string
  onError?: (message: string) => void
  generateUploadUrl: () => Promise<string>
  onSaveGeneration?: (params: SaveGenerationParams) => Promise<void>
  onSaveError?: (message: string) => void
}

export const useImageGeneration = (options: UseImageGenerationOptions) => {
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)

  const generateImage = async () => {
    const { 
      currentMode, useUrls, 
      image1, image1Url, image2, image2Url, 
      image3, image3Url, image4, image4Url,
      prompt, aspectRatio, imageSize, selectedArtStyle, apiKey, onError, generateUploadUrl 
    } = options

    if (currentMode === "image-editing" && !useUrls && !image1) return
    if (currentMode === "image-editing" && useUrls && !image1Url) return
    if (!prompt.trim()) return

    setIsLoading(true)
    setGeneratedImage(null)
    setImageLoaded(false)
    setProgress(0)
    setShowAnimation(true)

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) {
          return Math.min(prev + 0.1, 98)
        } else if (prev >= 90) {
          return prev + 0.3
        } else if (prev >= 75) {
          return prev + 0.6
        } else if (prev >= 50) {
          return prev + 0.9
        } else if (prev >= 25) {
          return prev + 1.1
        } else {
          return prev + 1.3
        }
      })
    }, 100)

    try {
      // Append art style to prompt if selected
      let finalPrompt = prompt
      if (selectedArtStyle) {
        const styleText = selectedArtStyle.toLowerCase().includes("style")
          ? selectedArtStyle
          : `${selectedArtStyle} style`
        finalPrompt = `${prompt}, in ${styleText}`
      }

      const formData = new FormData()
      formData.append("mode", currentMode)
      formData.append("prompt", finalPrompt)
      formData.append("aspectRatio", aspectRatio)
      formData.append("imageSize", imageSize)
      if (apiKey) {
        formData.append("apiKey", apiKey)
      }

      if (currentMode === "image-editing") {
        if (useUrls) {
          formData.append("image1Url", image1Url)
          if (image2Url) {
            formData.append("image2Url", image2Url)
          }
          if (image3Url) {
            formData.append("image3Url", image3Url)
          }
          if (image4Url) {
            formData.append("image4Url", image4Url)
          }
        } else {
          if (image1) {
            formData.append("image1", image1)
          }
          if (image2) {
            formData.append("image2", image2)
          }
          if (image3) {
            formData.append("image3", image3)
          }
          if (image4) {
            formData.append("image4", image4)
          }
        }
      }

      const response = await fetch("/api/generate-image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(`${errorData.error}${errorData.details ? `: ${errorData.details}` : ""}`)
      }

      const data = await response.json()
      clearInterval(progressInterval)

      setProgress(100)
      
      // Set the generated image immediately and stop loading
      setGeneratedImage(data)
      setImageLoaded(true)
      setIsLoading(false)
      setShowAnimation(false)
      setProgress(0)

      // Save generation to Convex storage in the background (don't block UI)
      if (options.onSaveGeneration) {
        ;(async () => {
          try {
            // Convert image data URL to blob
            const imageBlob = await dataUrlToBlob(data.url)
            
            // Generate thumbnail blob
            const thumbnailBlob = await generateThumbnailBlob(data.url, 250)
            
            // Upload both to Convex storage
            const [imageStorageId, thumbnailStorageId] = await Promise.all([
              uploadToStorage(imageBlob, generateUploadUrl),
              uploadToStorage(thumbnailBlob, generateUploadUrl),
            ])
            
            // Save the generation with storage IDs
            await options.onSaveGeneration!({
              prompt: finalPrompt,
              imageStorageId,
              thumbnailStorageId,
              mode: currentMode,
              aspectRatio,
              imageSize,
              artStyle: selectedArtStyle || undefined,
            })
          } catch (saveError) {
            console.error("Error saving generation to storage:", saveError)
            options.onSaveError?.(
              "Failed to save to history. Please download the image manually."
            )
          }
        })()
      }
    } catch (error) {
      clearInterval(progressInterval)
      setProgress(0)
      setShowAnimation(false)
      console.error("Error generating image:", error)

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      onError?.(`Error generating image: ${errorMessage}`)
      setIsLoading(false)
    }
  }

  return {
    generatedImage,
    isLoading,
    progress,
    imageLoaded,
    showAnimation,
    generateImage,
    setGeneratedImage,
  }
}
