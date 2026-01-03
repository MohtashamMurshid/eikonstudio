import { useState } from "react"
import type { GeneratedImage } from "../types"
import { preloadImage } from "../utils/image-processing"

interface UseImageGenerationOptions {
  apiKey: string
  currentMode: "text-to-image" | "image-editing"
  useUrls: boolean
  image1: File | null
  image1Url: string
  image2: File | null
  image2Url: string
  prompt: string
  aspectRatio: string
  imageSize: string
  selectedArtStyle: string
  onError?: (message: string) => void
}

export const useImageGeneration = (options: UseImageGenerationOptions) => {
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)

  const generateImage = async () => {
    const { currentMode, useUrls, image1, image1Url, image2, image2Url, prompt, aspectRatio, imageSize, selectedArtStyle, apiKey, onError } =
      options

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
        } else {
          if (image1) {
            formData.append("image1", image1)
          }
          if (image2) {
            formData.append("image2", image2)
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

      setProgress(99)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setProgress(100)

      await preloadImage(data.url)
      setImageLoaded(true)

      setGeneratedImage(data)
      setIsLoading(false)
      setShowAnimation(false)
      setProgress(0)
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

