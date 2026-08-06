import { useState, useEffect, useRef, useCallback } from "react"
import type { GeneratedImage } from "../types"
import { type ImageModelId } from "../constants"
import type { Id } from "@/convex/_generated/dataModel"
import { getUserFacingErrorMessage } from "@/lib/error-utils"

/**
 * Upload blob to Convex storage
 */
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
  if (!response.ok) {
    throw new Error("Failed to upload the image to storage")
  }
  const { storageId } = await response.json()
  return storageId
}

/**
 * Convert File to Blob for upload
 */
const fileToBlob = async (file: File): Promise<Blob> => {
  return new Blob([await file.arrayBuffer()], { type: file.type })
}

interface StartGenerationParams {
  idempotencyKey: string
  prompt: string
  mode: "text-to-image" | "image-editing"
  aspectRatio: string
  imageSize: string
  imageModel: ImageModelId
  referenceImageIds?: Id<"_storage">[]
}

interface GenerationRecord {
  _id: Id<"generations">
  status: "pending" | "generating" | "completed" | "failed"
  imageUrl?: string | null
  thumbnailUrl?: string | null
  errorMessage?: string
}

interface UseImageGenerationOptions {
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
  imageModel: ImageModelId
  onError?: (message: string) => void
  generateUploadUrl: () => Promise<string>
  startGeneration: (params: StartGenerationParams) => Promise<Id<"generations">>
  getGeneration?: (generationId: Id<"generations">) => GenerationRecord | null | undefined
  onGenerationStarted?: () => void
}

/**
 * Hook for generating images using background Convex actions
 * Generation continues server-side even if the user navigates away
 */
export const useImageGeneration = (options: UseImageGenerationOptions) => {
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [generationId, setGenerationId] = useState<Id<"generations"> | null>(null)
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pendingRequestRef = useRef<{
    signature: string
    idempotencyKey: string
    referenceImageIds?: Id<"_storage">[]
  } | null>(null)

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Poll for generation completion when we have a generationId
  const pollForCompletion = useCallback(async (genId: Id<"generations">) => {
    if (!options.getGeneration) return
    
    pollingIntervalRef.current = setInterval(() => {
      const generation = options.getGeneration!(genId)
      
      if (!generation) return
      
      if (generation.status === "completed" && generation.imageUrl) {
        // Generation completed successfully
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
        
        setProgress(100)
        setGeneratedImage({
          url: generation.imageUrl,
          prompt: options.prompt,
        })
        setImageLoaded(true)
        setIsLoading(false)
        setShowAnimation(false)
        setIsSaving(false)
        setProgress(0)
        setGenerationId(null)
      } else if (generation.status === "failed") {
        // Generation failed
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
        
        setProgress(0)
        setShowAnimation(false)
        setIsLoading(false)
        setIsSaving(false)
        setGenerationId(null)
        options.onError?.(`Generation failed: ${generation.errorMessage || "Unknown error"}`)
      }
    }, 1000) // Poll every second
  }, [options])

  const generateImage = async () => {
    const { 
      currentMode, useUrls, 
      image1, image1Url, image2, image2Url, 
      image3, image3Url, image4, image4Url,
      prompt, aspectRatio, imageSize, imageModel,
      onError, generateUploadUrl, startGeneration 
    } = options

    if (currentMode === "image-editing" && !useUrls && !image1) return
    if (currentMode === "image-editing" && useUrls && !image1Url) return
    if (!prompt.trim()) return

    const fileSignature = (file: File | null) => file ? `${file.name}:${file.size}:${file.type}:${file.lastModified}` : null
    const requestSignature = JSON.stringify({
      currentMode,
      useUrls,
      prompt,
      aspectRatio,
      imageSize,
      imageModel,
      files: [image1, image2, image3, image4].map(fileSignature),
      urls: [image1Url, image2Url, image3Url, image4Url],
    })
    if (pendingRequestRef.current?.signature !== requestSignature) {
      pendingRequestRef.current = {
        signature: requestSignature,
        idempotencyKey: `image_${crypto.randomUUID()}`,
      }
    }
    const pendingRequest = pendingRequestRef.current!

    setIsLoading(true)
    setGeneratedImage(null)
    setImageLoaded(false)
    setProgress(0)
    setShowAnimation(true)
    setIsSaving(true)

    // Start progress animation
    progressIntervalRef.current = setInterval(() => {
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
      // Reuse uploaded references when retrying the same pending request.
      let referenceImageIds = pendingRequest.referenceImageIds
      
      if (currentMode === "image-editing" && !referenceImageIds) {
        referenceImageIds = []
        
        // Collect all images that need to be uploaded
        const imagesToUpload: { file?: File; url?: string }[] = []
        
        if (useUrls) {
          if (image1Url) imagesToUpload.push({ url: image1Url })
          if (image2Url) imagesToUpload.push({ url: image2Url })
          if (image3Url) imagesToUpload.push({ url: image3Url })
          if (image4Url) imagesToUpload.push({ url: image4Url })
        } else {
          if (image1) imagesToUpload.push({ file: image1 })
          if (image2) imagesToUpload.push({ file: image2 })
          if (image3) imagesToUpload.push({ file: image3 })
          if (image4) imagesToUpload.push({ file: image4 })
        }

        // Upload each image to Convex storage
        for (const img of imagesToUpload) {
          try {
            let blob: Blob
            if (img.file) {
              blob = await fileToBlob(img.file)
            } else if (img.url) {
              // Fetch URL and convert to blob
              const response = await fetch(img.url)
              if (!response.ok) {
                throw new Error("Failed to fetch a reference image")
              }
              blob = await response.blob()
            } else {
              continue
            }
            
            const storageId = await uploadToStorage(blob, generateUploadUrl)
            referenceImageIds.push(storageId)
          } catch (uploadError) {
            console.error("Error uploading reference image:", uploadError)
            // Continue with other images
          }
        }

        if (referenceImageIds.length === 0) {
          throw new Error("Failed to upload reference images")
        }
        pendingRequest.referenceImageIds = referenceImageIds
      }

      // Start the background generation
      const genId = await startGeneration({
        idempotencyKey: pendingRequest.idempotencyKey,
        prompt,
        mode: currentMode,
        aspectRatio,
        imageSize,
        imageModel,
        referenceImageIds,
      })
      pendingRequestRef.current = null

      setGenerationId(genId)
      options.onGenerationStarted?.()

      // Start polling for completion if getGeneration is provided
      if (options.getGeneration) {
        pollForCompletion(genId)
      } else {
        // If no getGeneration callback, just show success message and stop
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
        setProgress(100)
        setTimeout(() => {
          setIsLoading(false)
          setShowAnimation(false)
          setIsSaving(false)
          setProgress(0)
        }, 1000)
      }
    } catch (error) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      setProgress(0)
      setShowAnimation(false)
      setIsLoading(false)
      setIsSaving(false)
      console.error("Error starting generation:", error)

      onError?.(
        getUserFacingErrorMessage(
          error,
          "Unable to start generation right now. Please try again.",
        ),
      )
    }
  }

  // Method to stop loading and show completed state
  const handleGenerationComplete = useCallback((imageUrl: string, prompt: string) => {
    // Clear any running intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setProgress(100)
    setGeneratedImage({
      url: imageUrl,
      prompt: prompt,
    })
    setImageLoaded(true)
    setIsLoading(false)
    setShowAnimation(false)
    setIsSaving(false)
    setProgress(0)
    setGenerationId(null)
  }, [])

  // Method to handle generation failure
  const handleGenerationFailed = useCallback((errorMessage?: string) => {
    // Clear any running intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setProgress(0)
    setShowAnimation(false)
    setIsLoading(false)
    setIsSaving(false)
    setGenerationId(null)
    options.onError?.(`Generation failed: ${errorMessage || "Unknown error"}`)
  }, [options])

  return {
    generatedImage,
    isLoading,
    progress,
    imageLoaded,
    showAnimation,
    isSaving,
    generationId,
    generateImage,
    setGeneratedImage,
    handleGenerationComplete,
    handleGenerationFailed,
  }
}
