"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useMutation } from "convex/react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { ImageCombinerProps } from "./types"
import { useToast } from "./hooks/use-toast"
import { useImageUpload, type ImageSlot } from "./hooks/use-image-upload"
import { useImageGeneration } from "./hooks/use-image-generation"
import { usePasteHandler } from "./hooks/use-paste-handler"
import { useDragDrop } from "./hooks/use-drag-drop"
import { useImageActions } from "./hooks/use-image-actions"
import { useGalleryOperations } from "./hooks/use-gallery-operations"
import { useMentionHandler } from "./hooks/use-mention-handler"
import { useSkillHandler } from "./hooks/use-skill-handler"
import { Toast } from "./components/toast"
import { DragOverlay } from "./components/drag-overlay"
import { FullscreenModal } from "./components/fullscreen-modal"
import { ImagePreviewGrid } from "./components/image-preview-grid"
import { PromptInputWithMentions } from "./components/prompt-input-with-mentions"
import { ControlsBar } from "./components/controls-bar"
import { ArtStyleSuggestions } from "./components/art-style-suggestions"
import { GeneratedResultDisplay } from "./components/generated-result-display"
import { Logo } from "@/components/logo"
import { IMAGE_MODEL_GPT_IMAGE_2, type ImageModelId } from "./constants"

interface ExtendedImageCombinerProps extends ImageCombinerProps {
  pendingInputImage?: string | null
  onInputImageLoaded?: () => void
}

const IMAGE_SLOTS: ImageSlot[] = [1, 2, 3, 4]

export function ImageCombiner({ apiKey, pendingInputImage, onInputImageLoaded }: ExtendedImageCombinerProps) {
  const [prompt, setPrompt] = useState("")
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [imageModel, setImageModel] = useState<ImageModelId>(IMAGE_MODEL_GPT_IMAGE_2)
  const [aspectRatio, setAspectRatio] = useState<string>("square")
  const [imageSize, setImageSize] = useState<string>("2K")
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("")
  const [activeGenerationId, setActiveGenerationId] = useState<Id<"generations"> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { toast, showToast } = useToast()
  
  // Convex mutations for background generation
  const generateUploadUrl = useMutation(api.generations.generateUploadUrl)
  const startGenerationMutation = useMutation(api.generations.startGeneration)
  
  // Gallery mutations
  const galleryGenerateUploadUrl = useMutation(api.gallery.generateUploadUrl)
  const saveToGallery = useMutation(api.gallery.saveImage)
  
  // For resolving @mentions - we need gallery images
  const galleryImages = useQuery(api.gallery.getMyImages, { limit: 100 })
  
  // Query to watch for generation completion (real-time updates)
  const generations = useQuery(api.generations.getMyGenerations, { limit: 5 })
  
  // Find the active generation from the list
  const activeGeneration = useMemo(() => {
    if (!activeGenerationId || !generations) return null
    return generations.find(g => g._id === activeGenerationId) || null
  }, [activeGenerationId, generations])

  const imageUpload = useImageUpload({
    onError: (message) => showToast(message, "error"),
  })

  const currentMode = imageUpload.hasImages ? "image-editing" : "text-to-image"

  // Callback to get generation status (for polling)
  const getGeneration = useMemo(() => {
    return (genId: Id<"generations">) => {
      if (!generations) return null
      return generations.find(g => g._id === genId) || null
    }
  }, [generations])

  const imageGeneration = useImageGeneration({
    apiKey,
    currentMode,
    useUrls: imageUpload.useUrls,
    image1: imageUpload.image1,
    image1Url: imageUpload.image1Url,
    image2: imageUpload.image2,
    image2Url: imageUpload.image2Url,
    image3: imageUpload.image3,
    image3Url: imageUpload.image3Url,
    image4: imageUpload.image4,
    image4Url: imageUpload.image4Url,
    prompt,
    aspectRatio,
    imageSize,
    imageModel,
    selectedArtStyle,
    onError: (message) => showToast(message, "error"),
    generateUploadUrl,
    startGeneration: async (params) => {
      const genId = await startGenerationMutation(params)
      setActiveGenerationId(genId)
      return genId
    },
    getGeneration,
    onGenerationStarted: () => {
      showToast("Generation started - you can safely navigate away", "success")
    },
  })

  // Image actions hook
  const imageActions = useImageActions({
    generatedImage: imageGeneration.generatedImage,
    currentMode,
    onError: (message) => showToast(message, "error"),
    onSuccess: (message) => showToast(message, "success"),
  })

  // Gallery operations hook
  const galleryOperations = useGalleryOperations({
    generatedImage: imageGeneration.generatedImage,
    generateUploadUrl: galleryGenerateUploadUrl,
    saveToGallery: async (params) => {
      await saveToGallery(params)
    },
    onError: (message) => showToast(message, "error"),
    onSuccess: (message) => showToast(message, "success"),
  })

  // Mention handler hook
  const mentionHandler = useMentionHandler({
    prompt,
    setPrompt,
    galleryImages,
    imageUpload,
    onError: (message) => showToast(message, "error"),
    onSuccess: (message) => showToast(message, "success"),
    textareaRef,
  })

  // Skill handler hook
  const skillHandler = useSkillHandler({
    prompt,
    setPrompt,
    textareaRef,
  })

  const getAvailableFileSlots = useCallback((): ImageSlot[] => {
    return IMAGE_SLOTS.filter((slot) => {
      if (slot === 1) return !imageUpload.image1
      if (slot === 2) return !imageUpload.image2
      if (slot === 3) return !imageUpload.image3
      return !imageUpload.image4
    })
  }, [imageUpload.image1, imageUpload.image2, imageUpload.image3, imageUpload.image4])

  const getFirstAvailableFileSlot = useCallback((): ImageSlot | null => {
    return getAvailableFileSlots()[0] ?? null
  }, [getAvailableFileSlots])

  usePasteHandler({
    useUrls: imageUpload.useUrls,
    image1: imageUpload.image1,
    image2: imageUpload.image2,
    image3: imageUpload.image3,
    image4: imageUpload.image4,
    image1Url: imageUpload.image1Url,
    image2Url: imageUpload.image2Url,
    image3Url: imageUpload.image3Url,
    image4Url: imageUpload.image4Url,
    switchToFileMode: imageUpload.switchToFileMode,
    handleImageUpload: imageUpload.handleImageUpload,
    handleUrlChange: imageUpload.handleUrlChange,
    setUseUrls: imageUpload.setUseUrls,
    getFirstAvailableSlot: getFirstAvailableFileSlot,
  })

  const dragDrop = useDragDrop({
    useUrls: imageUpload.useUrls,
    image1: imageUpload.image1,
    image2: imageUpload.image2,
    image3: imageUpload.image3,
    image4: imageUpload.image4,
    switchToFileMode: imageUpload.switchToFileMode,
    handleImageUpload: imageUpload.handleImageUpload,
    getFirstAvailableSlot: getFirstAvailableFileSlot,
    onError: (message) => showToast(message, "error"),
  })

  // Watch for active generation completion via real-time subscription
  useEffect(() => {
    if (!activeGeneration || !activeGenerationId) return
    
    if (activeGeneration.status === "completed" && activeGeneration.imageUrl) {
      imageGeneration.handleGenerationComplete(activeGeneration.imageUrl, activeGeneration.prompt)
      setActiveGenerationId(null)
    } else if (activeGeneration.status === "failed") {
      imageGeneration.handleGenerationFailed(activeGeneration.errorMessage)
      setActiveGenerationId(null)
    }
  }, [activeGeneration, activeGenerationId, imageGeneration.handleGenerationComplete, imageGeneration.handleGenerationFailed])

  useEffect(() => {
    const loadPendingImage = async () => {
      if (!pendingInputImage) return
      
      try {
        const response = await fetch(pendingInputImage)
        const blob = await response.blob()
        const file = new File([blob], "history-image.png", { type: "image/png" })
        imageUpload.switchToFileMode()
        
        if (!imageUpload.image1Preview && !imageUpload.image1) {
          imageUpload.handleImageUpload(file, 1)
          showToast("Image loaded from history", "success")
        } else if (!imageUpload.image2Preview && !imageUpload.image2) {
          imageUpload.handleImageUpload(file, 2)
          showToast("Image loaded from history into Input 2", "success")
        } else {
          imageUpload.handleImageUpload(file, 1)
          showToast("Image from history replaced Input 1", "success")
        }
        
        onInputImageLoaded?.()
      } catch (error) {
        console.error("Error loading image from history:", error)
        showToast("Failed to load image from history", "error")
        onInputImageLoaded?.()
      }
    }
    
    loadPendingImage()
  }, [pendingInputImage])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showFullscreen) {
        setShowFullscreen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [showFullscreen])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, imageNumber: ImageSlot) => {
    const file = e.target.files?.[0]
    if (file) {
      imageUpload.switchToFileMode()
      imageUpload.handleImageUpload(file, imageNumber)
      e.target.value = ""
    }
  }

  const handleMultipleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const availableSlots = getAvailableFileSlots()
    if (availableSlots.length === 0) {
      showToast("All 4 image slots are already filled. Remove one to add another.", "error")
      e.target.value = ""
      return
    }

    imageUpload.switchToFileMode()

    const filesToProcess = files.slice(0, availableSlots.length)
    filesToProcess.forEach((file, index) => {
      imageUpload.handleImageUpload(file, availableSlots[index])
    })

    if (filesToProcess.length > 1) {
      showToast(`Added ${filesToProcess.length} local images`, "success")
    }

    if (files.length > availableSlots.length) {
      showToast(`Only ${availableSlots.length} image slot(s) were available`, "error")
    }

    e.target.value = ""
  }

  const useGeneratedAsInput = async () => {
    if (!imageGeneration.generatedImage?.url) return
    try {
      const response = await fetch(imageGeneration.generatedImage.url)
      const blob = await response.blob()
      const file = new File([blob], "generated-image.png", { type: "image/png" })
      imageUpload.switchToFileMode()
      const availableSlot = getFirstAvailableFileSlot()
      if (availableSlot) {
        imageUpload.handleImageUpload(file, availableSlot)
        showToast(`Image loaded into Input ${availableSlot}`, "success")
      } else {
        imageUpload.handleImageUpload(file, 1)
        showToast("Image replaced in Input 1", "success")
      }
    } catch (error) {
      console.error("Error loading image as input:", error)
      showToast("Error loading image", "error")
    }
  }

  const canGenerate = prompt.trim().length > 0 && (currentMode === "text-to-image" || Boolean(imageUpload.useUrls ? imageUpload.image1Url : imageUpload.image1))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let mention autocomplete handle arrow keys and enter when visible
    if (mentionHandler.showMentionDropdown && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
      // The MentionAutocomplete component will handle these
      return
    }

    // Let skill autocomplete handle arrow keys and enter when visible
    if (skillHandler.showSkillDropdown && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
      // The SkillAutocomplete component will handle these
      return
    }
    
    // Shift+Enter for new line (default behavior, don't prevent)
    // Enter without shift to submit
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canGenerate && !imageGeneration.isLoading) {
        mentionHandler.handleGenerateWithMentions(() => imageGeneration.generateImage())
      }
    }
  }

  const handleGenerate = () => {
    mentionHandler.handleGenerateWithMentions(() => imageGeneration.generateImage())
  }

  const isGenerating = imageGeneration.isLoading || imageUpload.isConvertingHeic || imageGeneration.generatedImage

  return (
    <div
      className="select-none flex flex-col min-h-[calc(100vh-200px)]"
      onDragEnter={dragDrop.handleGlobalDragEnter}
      onDragLeave={dragDrop.handleGlobalDragLeave}
      onDragOver={dragDrop.handleGlobalDragOver}
      onDrop={dragDrop.handleGlobalDrop}
    >
      <Toast toast={toast} />
      <DragOverlay isDragOver={dragDrop.isDragOver} />

      {/* Main Content Area - use padding for smooth centering transition */}
      <div 
        className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-0 sm:px-4 items-center transition-[padding] duration-500 ease-out"
        style={{
          paddingTop: isGenerating ? '2rem' : 'max(2rem, calc((100vh - 400px) / 2 - 100px))',
        }}
      >
        
        {/* Input Container - Scira Style */}
        <div className="w-full transition-all duration-500 ease-out">
          {/* Subtle Logo Branding */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <Logo 
              variant="default" 
              size="sm" 
              colorScheme="dark"
              className="opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>
          
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm transition-all duration-500 ease-out">
            {/* Image Previews */}
            <ImagePreviewGrid
              image1Preview={imageUpload.image1Preview}
              image2Preview={imageUpload.image2Preview}
              image3Preview={imageUpload.image3Preview}
              image4Preview={imageUpload.image4Preview}
              removingImages={mentionHandler.removingImages}
              onReplace={(slot) => document.getElementById(`image-upload-${slot}`)?.click()}
              onRemove={(slot) => imageUpload.clearImage(slot)}
            />

            {/* Prompt Input with Mentions and Skills */}
            <PromptInputWithMentions
              prompt={prompt}
              cursorPosition={mentionHandler.cursorPosition}
              showMentionDropdown={mentionHandler.showMentionDropdown}
              showSkillDropdown={skillHandler.showSkillDropdown}
              textareaRef={textareaRef}
              onPromptChange={(e) => {
                // Handle both mention and skill triggers
                mentionHandler.handlePromptChange(e)
                skillHandler.handlePromptChangeForSkills(e.target.value, e.target.selectionStart || 0)
              }}
              onKeyDown={handleKeyDown}
              onCursorChange={(pos) => {
                mentionHandler.setCursorPosition(pos)
                skillHandler.setSkillCursorPosition(pos)
              }}
              onMentionSelect={mentionHandler.handleMentionSelect}
              onCloseMentionDropdown={() => mentionHandler.setShowMentionDropdown(false)}
              onSkillSelect={skillHandler.handleSkillSelect}
              onCloseSkillDropdown={() => skillHandler.setShowSkillDropdown(false)}
            />

            {/* Controls Bar */}
            <ControlsBar
              imageModel={imageModel}
              aspectRatio={aspectRatio}
              imageSize={imageSize}
              selectedArtStyle={selectedArtStyle}
              canGenerate={canGenerate}
              isLoading={imageGeneration.isLoading}
              isConvertingHeic={imageUpload.isConvertingHeic}
              onImageModelChange={setImageModel}
              onAspectRatioChange={setAspectRatio}
              onImageSizeChange={setImageSize}
              onArtStyleChange={setSelectedArtStyle}
              onGenerate={handleGenerate}
              onAddImages={() => document.getElementById("image-upload-multiple")?.click()}
            />
          </div>

          {/* Art Style Suggestions */}
          {!imageGeneration.isLoading && !imageUpload.isConvertingHeic && !imageGeneration.generatedImage && (
            <ArtStyleSuggestions
              selectedArtStyle={selectedArtStyle}
              onArtStyleToggle={(style) => setSelectedArtStyle(selectedArtStyle === style ? "" : style)}
            />
          )}

          {/* Hidden file inputs for all 4 slots */}
          <input
            id="image-upload-multiple"
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={handleMultipleFilesSelect}
            className="hidden"
          />
          <input
            id="image-upload-1"
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => handleFileSelect(e, 1)}
            className="hidden"
          />
          <input
            id="image-upload-2"
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => handleFileSelect(e, 2)}
            className="hidden"
          />
          <input
            id="image-upload-3"
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => handleFileSelect(e, 3)}
            className="hidden"
          />
          <input
            id="image-upload-4"
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => handleFileSelect(e, 4)}
            className="hidden"
          />
        </div>

        {/* Result Section */}
        <GeneratedResultDisplay
          isLoading={imageGeneration.isLoading}
          isConvertingHeic={imageUpload.isConvertingHeic}
          progress={imageGeneration.progress}
          heicProgress={imageUpload.heicProgress}
          generatedImage={imageGeneration.generatedImage}
          isAddingToGallery={galleryOperations.isAddingToGallery}
          isSavingToHistory={imageGeneration.isSaving}
          onNewGeneration={() => imageGeneration.setGeneratedImage(null)}
          onAddToGallery={galleryOperations.addToGallery}
          onUseAsInput={useGeneratedAsInput}
          onCopy={imageActions.copyImageToClipboard}
          onDownload={imageActions.downloadImage}
          onFullscreen={() => setShowFullscreen(true)}
        />
      </div>

      <FullscreenModal
        showFullscreen={showFullscreen}
        generatedImage={imageGeneration.generatedImage}
        onClose={() => setShowFullscreen(false)}
      />
    </div>
  )
}
