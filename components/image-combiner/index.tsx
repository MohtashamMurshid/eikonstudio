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
import { FullscreenModal } from "./components/fullscreen-modal"
import { ProgressBar } from "./components/progress-bar"
import { predefinedArtStyles } from "./constants"

export function ImageCombiner({ apiKey }: ImageCombinerProps) {
  const [prompt, setPrompt] = useState("")
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
    const file = e.target.files?.[0]
    if (file) {
      imageUpload.handleImageUpload(file, imageNumber)
      e.target.value = ""
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
        window.focus()
        let response
        try {
          response = await fetch(imageGeneration.generatedImage.url, { mode: "cors" })
        } catch {
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageGeneration.generatedImage.url)}`
          response = await fetch(proxyUrl)
        }
        if (!response.ok) throw new Error("Failed to fetch image")
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
      const response = await fetch(imageGeneration.generatedImage.url)
      const blob = await response.blob()
      const file = new File([blob], "generated-image.png", { type: "image/png" })
      if (!imageUpload.image1Preview && !imageUpload.image1) {
        imageUpload.handleImageUpload(file, 1)
        showToast("Image loaded into Input 1", "success")
      } else if (!imageUpload.image2Preview && !imageUpload.image2) {
        imageUpload.handleImageUpload(file, 2)
        showToast("Image loaded into Input 2", "success")
      } else {
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

  // Art style suggestions (show first 4)
  const artStyleSuggestions = predefinedArtStyles.slice(0, 4)

  return (
    <div
      className="select-none min-h-[60vh] flex flex-col"
      onDragEnter={dragDrop.handleGlobalDragEnter}
      onDragLeave={dragDrop.handleGlobalDragLeave}
      onDragOver={dragDrop.handleGlobalDragOver}
      onDrop={dragDrop.handleGlobalDrop}
    >
      <Toast toast={toast} />
      <DragOverlay isDragOver={dragDrop.isDragOver} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4">
        
        {/* Input Container - Scira Style */}
        <div className="w-full">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Textarea */}
            <div className="p-4 pb-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image you want to generate..."
                className="w-full min-h-[80px] max-h-[160px] bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-foreground text-base placeholder:text-foreground/40 select-text"
                style={{
                  fontSize: "16px",
                  WebkitUserSelect: "text",
                  userSelect: "text",
                }}
              />
            </div>

            {/* Bottom Bar with Controls */}
            <div className="px-4 pb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Add Images Button */}
                <button
                  onClick={() => document.getElementById("image-upload-1")?.click()}
                  className="h-8 px-2.5 flex items-center gap-1.5 bg-secondary/50 text-foreground text-xs rounded-lg hover:bg-secondary transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
                    <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
                    <polyline points="21,15 16,10 5,21" strokeWidth={1.5} />
                  </svg>
                  <span>Images</span>
                </button>

                {/* Image Upload Previews */}
                {(imageUpload.image1Preview || imageUpload.image2Preview) && (
                  <div className="flex items-center gap-1.5">
                    {imageUpload.image1Preview && (
                      <div className="relative group">
                        <img src={imageUpload.image1Preview} alt="Input 1" className="w-8 h-8 rounded-lg object-cover border border-border" />
                        <button
                          onClick={() => imageUpload.clearImage(1)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-foreground/80 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {imageUpload.image2Preview && (
                      <div className="relative group">
                        <img src={imageUpload.image2Preview} alt="Input 2" className="w-8 h-8 rounded-lg object-cover border border-border" />
                        <button
                          onClick={() => imageUpload.clearImage(2)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-foreground/80 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Aspect Ratio Dropdown */}
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="h-8 px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1.5 rounded-lg hover:bg-secondary transition-colors">
                    <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
                    </svg>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="square" className="text-xs">1:1</SelectItem>
                    <SelectItem value="portrait" className="text-xs">9:16</SelectItem>
                    <SelectItem value="landscape" className="text-xs">16:9</SelectItem>
                    <SelectItem value="wide" className="text-xs">21:9</SelectItem>
                  </SelectContent>
                </Select>

                {/* Size Dropdown */}
                <Select value={imageSize} onValueChange={setImageSize}>
                  <SelectTrigger className="h-8 px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1.5 rounded-lg hover:bg-secondary transition-colors">
                    <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="1K" className="text-xs">1K</SelectItem>
                    <SelectItem value="2K" className="text-xs">2K</SelectItem>
                    <SelectItem value="4K" className="text-xs">4K</SelectItem>
                  </SelectContent>
                </Select>

                {/* Art Style Dropdown */}
                <Select value={selectedArtStyle || "none"} onValueChange={(v) => setSelectedArtStyle(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1.5 rounded-lg hover:bg-secondary transition-colors min-w-[100px]">
                    <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
                    </svg>
                    <SelectValue placeholder="Style" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground max-h-[300px]">
                    <SelectItem value="none" className="text-xs">No Style</SelectItem>
                    {predefinedArtStyles.map((style) => (
                      <SelectItem key={style} value={style} className="text-xs">{style}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={imageGeneration.generateImage}
                disabled={!canGenerate || imageGeneration.isLoading || imageUpload.isConvertingHeic}
                className="h-8 px-4 rounded-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-colors"
              >
                {imageUpload.isConvertingHeic ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : imageGeneration.isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </Button>
            </div>
          </div>

          {/* Suggestion Buttons - Below Input */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {/* Art Style Quick Picks */}
            {artStyleSuggestions.map((style) => (
              <button
                key={style}
                onClick={() => setSelectedArtStyle(selectedArtStyle === style ? "" : style)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-all ${
                  selectedArtStyle === style 
                    ? "border-foreground/30 bg-foreground/10 text-foreground" 
                    : "border-border bg-card hover:bg-secondary/50 text-foreground/80 hover:text-foreground"
                }`}
              >
                <span>{style}</span>
              </button>
            ))}
          </div>

          {/* Hidden file input */}
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
        </div>

        {/* Result Section - Below Everything */}
        {(imageGeneration.isLoading || imageUpload.isConvertingHeic || imageGeneration.generatedImage) && (
          <div className="w-full mt-8">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {imageGeneration.isLoading ? (
                <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                  <ProgressBar progress={imageGeneration.progress} />
                </div>
              ) : imageUpload.isConvertingHeic ? (
                <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                  <ProgressBar progress={imageUpload.heicProgress} label="Converting HEIC image..." />
                </div>
              ) : imageGeneration.generatedImage ? (
                <div className="p-4">
                  {/* Image Actions */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-foreground/60">Generated Image</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={useGeneratedAsInput}
                        className="p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Use as Input"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </button>
                      <button
                        onClick={copyImageToClipboard}
                        className="p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Copy"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.5} />
                          <path strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                      <button
                        onClick={downloadImage}
                        className="p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowFullscreen(true)}
                        className="p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Fullscreen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Image Display */}
                  <div 
                    className="relative flex items-center justify-center cursor-pointer group"
                    onClick={() => setShowFullscreen(true)}
                  >
                    <img
                      src={imageGeneration.generatedImage.url || "/placeholder.svg"}
                      alt="Generated"
                      className="max-w-full max-h-[500px] object-contain rounded-xl"
                    />
                  </div>

                  {/* Prompt Display */}
                  <div className="mt-4 p-3 bg-secondary/30 rounded-xl">
                    <p className="text-sm text-foreground/70">
                      <span className="font-medium text-foreground/90">Prompt:</span> {imageGeneration.generatedImage.prompt}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <FullscreenModal
        showFullscreen={showFullscreen}
        generatedImage={imageGeneration.generatedImage}
        onClose={() => setShowFullscreen(false)}
      />
    </div>
  )
}
