"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ImageCombinerProps, GeneratedImage } from "./types"
import { useToast } from "./hooks/use-toast"
import { useImageUpload } from "./hooks/use-image-upload"
import { useImageGeneration } from "./hooks/use-image-generation"
import { usePasteHandler } from "./hooks/use-paste-handler"
import { useDragDrop } from "./hooks/use-drag-drop"
import { Toast } from "./components/toast"
import { DragOverlay } from "./components/drag-overlay"
import { PromptInput } from "./components/prompt-input"
import { ArtStyleSelector } from "./components/art-style-selector"
import { ImageUploadSection } from "./components/image-upload-section"
import { ResultDisplay } from "./components/result-display"
import { FullscreenModal } from "./components/fullscreen-modal"

export function ImageCombiner({ apiKey }: ImageCombinerProps) {
  const [prompt, setPrompt] = useState("A beautiful landscape with mountains and a lake at sunset")
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>("square")
  const [imageSize, setImageSize] = useState<string>("2K")
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("")
  const [customArtStyles, setCustomArtStyles] = useState<string[]>([])

  const { toast, showToast } = useToast()

  const imageUpload = useImageUpload({
    onError: (message) => showToast(message, "error"),
  })

  const currentMode = imageUpload.hasImages ? "image-editing" : "text-to-image"

  const imageGeneration = useImageGeneration({
    apiKey,
    currentMode,
    useUrls: imageUpload.useUrls,
    image1: imageUpload.image1,
    image1Url: imageUpload.image1Url,
    image2: imageUpload.image2,
    image2Url: imageUpload.image2Url,
    prompt,
    aspectRatio,
    imageSize,
    selectedArtStyle,
    onError: (message) => showToast(message, "error"),
  })

  usePasteHandler({
    useUrls: imageUpload.useUrls,
    image1: imageUpload.image1,
    image2: imageUpload.image2,
    image1Url: imageUpload.image1Url,
    image2Url: imageUpload.image2Url,
    handleImageUpload: imageUpload.handleImageUpload,
    handleUrlChange: imageUpload.handleUrlChange,
    setUseUrls: imageUpload.setUseUrls,
  })

  const dragDrop = useDragDrop({
    useUrls: imageUpload.useUrls,
    image1: imageUpload.image1,
    image2: imageUpload.image2,
    handleImageUpload: imageUpload.handleImageUpload,
    onError: (message) => showToast(message, "error"),
  })

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showFullscreen) {
        setShowFullscreen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [showFullscreen])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, imageNumber: 1 | 2) => {
    console.log("File input changed for image", imageNumber)
    const file = e.target.files?.[0]
    if (file) {
      console.log("File selected:", file.name, file.type)
      imageUpload.handleImageUpload(file, imageNumber)
      e.target.value = ""
    } else {
      console.log("No file selected")
    }
  }

  const downloadImage = async () => {
    if (imageGeneration.generatedImage) {
      try {
        const response = await fetch(imageGeneration.generatedImage.url)
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
        window.open(imageGeneration.generatedImage.url, "_blank")
      }
    }
  }

  const copyImageToClipboard = async () => {
    if (imageGeneration.generatedImage) {
      try {
        showToast("Copying image...", "success")

        // Ensure window is focused
        window.focus()

        // Try direct fetch first (works in development), fallback to proxy
        let response
        try {
          response = await fetch(imageGeneration.generatedImage.url, { mode: "cors" })
        } catch {
          // Fallback to proxy for production CORS issues
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageGeneration.generatedImage.url)}`
          response = await fetch(proxyUrl)
        }

        if (!response.ok) {
          throw new Error("Failed to fetch image")
        }

        const blob = await response.blob()
        const clipboardItem = new ClipboardItem({ "image/png": blob })
        await navigator.clipboard.write([clipboardItem])

        showToast("Image copied to clipboard!", "success")
      } catch (error) {
        console.error("Error copying image:", error)
        if (error instanceof Error && error.message.includes("not focused")) {
          showToast("Please click on the page first, then try copying again", "error")
        } else {
          showToast("Failed to copy image to clipboard", "error")
        }
      }
    }
  }

  const useGeneratedAsInput = async () => {
    if (!imageGeneration.generatedImage?.url) return

    try {
      // Download the image and convert it to a File object
      const response = await fetch(imageGeneration.generatedImage.url)
      const blob = await response.blob()
      const file = new File([blob], "generated-image.png", { type: "image/png" })

      // Check if image1 is empty, use it first
      if (!imageUpload.image1Preview && !imageUpload.image1) {
        imageUpload.handleImageUpload(file, 1)
        showToast("Image loaded into Input 1", "success")
      }
      // If image1 is occupied, use image2
      else if (!imageUpload.image2Preview && !imageUpload.image2) {
        imageUpload.handleImageUpload(file, 2)
        showToast("Image loaded into Input 2", "success")
      }
      // If both slots are occupied, replace image1
      else {
        imageUpload.handleImageUpload(file, 1)
        showToast("Image replaced in Input 1", "success")
      }
    } catch (error) {
      console.error("Error loading image as input:", error)
      showToast("Error loading image", "error")
    }
  }

  const canGenerate = prompt.trim().length > 0 && (currentMode === "text-to-image" || (imageUpload.useUrls ? imageUpload.image1Url : imageUpload.image1))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      if (canGenerate && !imageGeneration.isLoading) {
        imageGeneration.generateImage()
      }
    }
  }

  const handleAddCustomStyle = (style: string) => {
    const trimmedStyle = style.trim()
    if (trimmedStyle && !customArtStyles.includes(trimmedStyle)) {
      setCustomArtStyles([...customArtStyles, trimmedStyle])
      showToast(`Custom style "${trimmedStyle}" added`, "success")
    } else {
      showToast("This style already exists", "error")
    }
  }

  return (
    <div
      className="select-none"
      onDragEnter={dragDrop.handleGlobalDragEnter}
      onDragLeave={dragDrop.handleGlobalDragLeave}
      onDragOver={dragDrop.handleGlobalDragOver}
      onDrop={dragDrop.handleGlobalDrop}
    >
      <Toast toast={toast} />
      <DragOverlay isDragOver={dragDrop.isDragOver} />

      <div className="w-full select-none">
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 lg:gap-12">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="flex flex-nowrap items-center justify-between gap-2 select-none">
              <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 text-foreground flex-shrink-0">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
                </svg>
                Input
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="w-20 sm:w-24 md:w-28 bg-white border-border text-foreground text-xs md:text-sm h-8 md:h-9">
                    <SelectValue placeholder="1:1" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-border text-foreground">
                    <SelectItem value="square" className="text-xs md:text-sm">1:1</SelectItem>
                    <SelectItem value="portrait" className="text-xs md:text-sm">9:16</SelectItem>
                    <SelectItem value="landscape" className="text-xs md:text-sm">16:9</SelectItem>
                    <SelectItem value="wide" className="text-xs md:text-sm">21:9</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={imageSize} onValueChange={setImageSize}>
                  <SelectTrigger className="w-16 sm:w-20 md:w-24 bg-white border-border text-foreground text-xs md:text-sm h-8 md:h-9">
                    <SelectValue placeholder="2K" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-border text-foreground">
                    <SelectItem value="1K" className="text-xs md:text-sm">1K</SelectItem>
                    <SelectItem value="2K" className="text-xs md:text-sm">2K</SelectItem>
                    <SelectItem value="4K" className="text-xs md:text-sm">4K</SelectItem>
                  </SelectContent>
                </Select>
                <div className="inline-flex bg-gray-100 border border-border rounded-lg px-3 py-1.5 md:px-4 md:py-2 flex-shrink-0 h-8 md:h-9 items-center">
                  <span className="text-xs md:text-sm font-medium text-foreground/70 whitespace-nowrap">
                    {currentMode === "text-to-image" ? "Text-to-Image" : "Image-to-Image"}
                  </span>
                </div>
              </div>
            </div>

            <PromptInput prompt={prompt} onPromptChange={setPrompt} currentMode={currentMode} onKeyDown={handleKeyDown} />

            <ArtStyleSelector
              selectedArtStyle={selectedArtStyle}
              customArtStyles={customArtStyles}
              onArtStyleChange={setSelectedArtStyle}
              onAddCustomStyle={handleAddCustomStyle}
            />

            <ImageUploadSection
              useUrls={imageUpload.useUrls}
              image1Preview={imageUpload.image1Preview}
              image1Url={imageUpload.image1Url}
              image2Preview={imageUpload.image2Preview}
              image2Url={imageUpload.image2Url}
              onUseUrlsChange={imageUpload.setUseUrls}
              onFileSelect={handleFileSelect}
              onDrop={dragDrop.handleDrop}
              onUrlChange={imageUpload.handleUrlChange}
              onClear={imageUpload.clearImage}
            />

            <div className="pt-2">
              <Button
                onClick={imageGeneration.generateImage}
                disabled={!canGenerate || imageGeneration.isLoading || imageUpload.isConvertingHeic}
                className="w-full h-11 md:h-12 text-sm md:text-base font-semibold bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg transition-colors"
              >
                {imageUpload.isConvertingHeic ? "Converting HEIC..." : imageGeneration.isLoading ? "Generating..." : "Generate Image"}
              </Button>
            </div>
          </div>

          {/* Result Section */}
          <ResultDisplay
            isLoading={imageGeneration.isLoading}
            isConvertingHeic={imageUpload.isConvertingHeic}
            heicProgress={imageUpload.heicProgress}
            progress={imageGeneration.progress}
            generatedImage={imageGeneration.generatedImage}
            imageLoaded={imageGeneration.imageLoaded}
            onOpenFullscreen={() => setShowFullscreen(true)}
            onUseAsInput={useGeneratedAsInput}
            onCopy={copyImageToClipboard}
            onDownload={downloadImage}
          />
        </div>
      </div>

      <FullscreenModal
        showFullscreen={showFullscreen}
        generatedImage={imageGeneration.generatedImage}
        onClose={() => setShowFullscreen(false)}
      />
    </div>
  )
}
