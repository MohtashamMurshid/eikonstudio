"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useMutation } from "convex/react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
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
import { MentionAutocomplete } from "./components/mention-autocomplete"
import { predefinedArtStyles } from "./constants"
import { Logo } from "@/components/logo"

interface ExtendedImageCombinerProps extends ImageCombinerProps {
  pendingInputImage?: string | null
  onInputImageLoaded?: () => void
}

export function ImageCombiner({ apiKey, pendingInputImage, onInputImageLoaded }: ExtendedImageCombinerProps) {
  const [prompt, setPrompt] = useState("")
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>("square")
  const [imageSize, setImageSize] = useState<string>("2K")
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("")
  const [customArtStyles, setCustomArtStyles] = useState<string[]>([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { toast, showToast } = useToast()
  
  // Convex mutation to save generations
  const saveGeneration = useMutation(api.generations.saveGeneration)
  
  // For resolving @mentions - we need gallery images
  const galleryImages = useQuery(api.gallery.getMyImages, { limit: 100 })

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
    onSaveGeneration: async (params) => {
      await saveGeneration(params)
    },
    onSaveError: (message) => showToast(message, "warning"),
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

  // Handle pending input image from history
  useEffect(() => {
    const loadPendingImage = async () => {
      if (!pendingInputImage) return
      
      try {
        // Convert base64 data URL to a file
        const response = await fetch(pendingInputImage)
        const blob = await response.blob()
        const file = new File([blob], "history-image.png", { type: "image/png" })
        
        // Load into the first available slot, or replace slot 1
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
        
        // Notify parent that we've loaded the image
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

  // Handle prompt change with cursor tracking
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    setCursorPosition(e.target.selectionStart || 0)
    
    // Check if we should show mention dropdown
    const text = e.target.value
    const cursor = e.target.selectionStart || 0
    
    // Look backwards from cursor to find @
    let hasAtSymbol = false
    for (let i = cursor - 1; i >= 0; i--) {
      if (/\s/.test(text[i])) break
      if (text[i] === "@") {
        hasAtSymbol = true
        break
      }
    }
    setShowMentionDropdown(hasAtSymbol)
  }

  // Handle mention selection from autocomplete - keep @filename in prompt and load image
  const handleMentionSelect = useCallback(async (filename: string, startIndex: number, endIndex: number, imageData: string) => {
    // Replace partial @... with complete @filename (keep it in the prompt)
    const before = prompt.slice(0, startIndex)
    const after = prompt.slice(endIndex)
    const newPrompt = `${before}@${filename} ${after}`.trimEnd()
    setPrompt(newPrompt)
    setShowMentionDropdown(false)
    
    // Load the image as an input image
    try {
      const response = await fetch(imageData)
      const blob = await response.blob()
      const file = new File([blob], `${filename}.png`, { type: "image/png" })
      
      // Load into first empty slot, or slot 1 if both are empty
      if (!imageUpload.image1 && !imageUpload.image1Url) {
        imageUpload.handleImageUpload(file, 1)
      } else if (!imageUpload.image2 && !imageUpload.image2Url) {
        imageUpload.handleImageUpload(file, 2)
      } else {
        // Replace slot 1 if both are full
        imageUpload.handleImageUpload(file, 1)
      }
      
      showToast(`Added "${filename}" as reference image`, "success")
    } catch (error) {
      console.error("Failed to load gallery image:", error)
      showToast("Failed to load image", "error")
    }
    
    // Focus textarea and place cursor after the @filename
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newCursorPos = startIndex + filename.length + 2 // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
      }
    }, 0)
  }, [prompt, imageUpload, showToast])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let mention autocomplete handle arrow keys and enter when visible
    if (showMentionDropdown && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
      // The MentionAutocomplete component will handle these
      return
    }
    
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      if (canGenerate && !imageGeneration.isLoading) {
        handleGenerateWithMentions()
      }
    }
  }

  // Art style suggestions (show first 4)
  const artStyleSuggestions = predefinedArtStyles.slice(0, 4)

  // Resolve @mentions in prompt and load referenced images
  const handleGenerateWithMentions = useCallback(async () => {
    // Find all @filename mentions in the prompt (word boundary after @)
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g
    const matches = [...prompt.matchAll(mentionRegex)]
    
    if (matches.length === 0) {
      // No mentions, generate normally
      imageGeneration.generateImage()
      return
    }

    // Resolve mentions to images
    const resolvedImages: { filename: string; imageData: string }[] = []
    let cleanPrompt = prompt

    for (const match of matches) {
      const filename = match[1]
      const galleryImage = galleryImages?.find((img: any) => img.filename === filename)
      
      if (galleryImage) {
        resolvedImages.push({
          filename,
          imageData: galleryImage.imageData,
        })
        // Remove the @filename from prompt (keep just a reference note)
        cleanPrompt = cleanPrompt.replace(match[0], `[reference: ${filename}]`)
      }
      // If not found in gallery, just leave it as text (might be intentional @mention text)
    }

    // Load resolved images into input slots
    if (resolvedImages.length > 0) {
      try {
        // Load first mention into slot 1 if empty or replace it
        const firstImage = resolvedImages[0]
        const response1 = await fetch(firstImage.imageData)
        const blob1 = await response1.blob()
        const file1 = new File([blob1], `${firstImage.filename}.png`, { type: "image/png" })
        imageUpload.handleImageUpload(file1, 1)
        
        // Load second mention into slot 2 if available
        if (resolvedImages.length > 1) {
          const secondImage = resolvedImages[1]
          const response2 = await fetch(secondImage.imageData)
          const blob2 = await response2.blob()
          const file2 = new File([blob2], `${secondImage.filename}.png`, { type: "image/png" })
          imageUpload.handleImageUpload(file2, 2)
        }
        
        showToast(`Loaded ${resolvedImages.length} reference image(s) from gallery`, "success")
        
        // Update prompt to cleaned version and generate after a short delay to allow image loading
        setPrompt(cleanPrompt)
        setTimeout(() => {
          imageGeneration.generateImage()
        }, 500)
      } catch (error) {
        console.error("Error loading reference images:", error)
        showToast("Failed to load reference images from gallery", "error")
      }
    }
  }, [prompt, galleryImages, imageGeneration, imageUpload, showToast])

  return (
    <div
      className={`select-none flex flex-col transition-all duration-500 ease-out ${
        imageGeneration.isLoading || imageUpload.isConvertingHeic || imageGeneration.generatedImage 
          ? "min-h-[60vh]" 
          : "min-h-[calc(100vh-200px)] justify-center"
      }`}
      onDragEnter={dragDrop.handleGlobalDragEnter}
      onDragLeave={dragDrop.handleGlobalDragLeave}
      onDragOver={dragDrop.handleGlobalDragOver}
      onDrop={dragDrop.handleGlobalDrop}
    >
      <Toast toast={toast} />
      <DragOverlay isDragOver={dragDrop.isDragOver} />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col w-full max-w-3xl mx-auto px-0 sm:px-4 transition-all duration-500 ease-out items-center justify-center ${
        imageGeneration.isLoading || imageUpload.isConvertingHeic || imageGeneration.generatedImage 
          ? "!justify-start pt-4 sm:pt-8" 
          : ""
      }`}>
        
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
            {/* Image Previews - Above Textarea */}
            {(imageUpload.image1Preview || imageUpload.image2Preview) && (
              <div className="p-3 sm:p-4 pb-0">
                <div className="flex items-start gap-2 sm:gap-3">
                  {imageUpload.image1Preview && (
                    <div className="relative group">
                      <img 
                        src={imageUpload.image1Preview} 
                        alt="Input 1" 
                        className="w-[70px] h-[70px] sm:w-[100px] sm:h-[100px] rounded-lg sm:rounded-xl object-cover border border-border/50" 
                      />
                      {/* Action buttons - always visible on mobile */}
                      <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex items-center gap-1">
                        <button
                          onClick={() => document.getElementById("image-upload-1")?.click()}
                          className="w-6 h-6 sm:w-7 sm:h-7 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                          title="Replace image"
                        >
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => imageUpload.clearImage(1)}
                          className="w-6 h-6 sm:w-7 sm:h-7 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                          title="Remove image"
                        >
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {imageUpload.image2Preview && (
                    <div className="relative group">
                      <img 
                        src={imageUpload.image2Preview} 
                        alt="Input 2" 
                        className="w-[70px] h-[70px] sm:w-[100px] sm:h-[100px] rounded-lg sm:rounded-xl object-cover border border-border/50" 
                      />
                      {/* Action buttons - always visible on mobile */}
                      <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex items-center gap-1">
                        <button
                          onClick={() => document.getElementById("image-upload-2")?.click()}
                          className="w-6 h-6 sm:w-7 sm:h-7 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                          title="Replace image"
                        >
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => imageUpload.clearImage(2)}
                          className="w-6 h-6 sm:w-7 sm:h-7 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                          title="Remove image"
                        >
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Textarea with Mention Autocomplete */}
            <div className="p-3 sm:p-4 pb-2 relative">
              {/* Highlight backdrop - renders text with @mentions highlighted */}
              <div 
                className="absolute inset-0 p-3 sm:p-4 pb-2 pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-sm sm:text-base text-foreground"
                style={{ fontSize: "16px", lineHeight: "1.5" }}
                aria-hidden="true"
              >
                {prompt.split(/(@[a-zA-Z0-9_-]+)/).map((part, i) => 
                  part.match(/^@[a-zA-Z0-9_-]+$/) ? (
                    <span key={i} className="bg-emerald-500/15 text-emerald-600 rounded-sm">{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                onSelect={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart || 0)}
                onClick={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart || 0)}
                placeholder="Describe the image you want to generate... (type @ to reference gallery images)"
                className="w-full min-h-[60px] sm:min-h-[80px] max-h-[120px] sm:max-h-[160px] bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-transparent caret-foreground text-sm sm:text-base placeholder:text-foreground/40 select-text relative z-10"
                style={{
                  fontSize: "16px",
                  WebkitUserSelect: "text",
                  userSelect: "text",
                  lineHeight: "1.5",
                }}
              />
              
              {/* Mention Autocomplete Dropdown */}
              {showMentionDropdown && (
                <MentionAutocomplete
                  inputValue={prompt}
                  cursorPosition={cursorPosition}
                  onSelect={handleMentionSelect}
                  onClose={() => setShowMentionDropdown(false)}
                  textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
                />
              )}
            </div>

            {/* Bottom Bar with Controls */}
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Add Images Button */}
                <button
                  onClick={() => document.getElementById("image-upload-1")?.click()}
                  className="h-8 px-2 sm:px-2.5 flex items-center gap-1 sm:gap-1.5 bg-secondary/50 text-foreground text-xs rounded-lg hover:bg-secondary transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
                    <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
                    <polyline points="21,15 16,10 5,21" strokeWidth={1.5} />
                  </svg>
                  <span className="hidden sm:inline">Images</span>
                </button>

                {/* Aspect Ratio Dropdown */}
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors">
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
                  <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors">
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
                  <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors min-w-[70px] sm:min-w-[100px]">
                    <svg className="w-3.5 h-3.5 text-foreground/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
                    </svg>
                    <SelectValue placeholder="Style" className="truncate" />
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
                onClick={handleGenerateWithMentions}
                disabled={!canGenerate || imageGeneration.isLoading || imageUpload.isConvertingHeic}
                className="h-10 sm:h-8 px-4 rounded-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-colors w-full sm:w-auto"
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
                  <>
                    <svg className="w-4 h-4 sm:mr-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="sm:hidden">Generate</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Suggestion Buttons - Below Input */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4">
            {/* Art Style Quick Picks */}
            {artStyleSuggestions.map((style) => (
              <button
                key={style}
                onClick={() => setSelectedArtStyle(selectedArtStyle === style ? "" : style)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm transition-all ${
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
          <div className="w-full mt-4 sm:mt-8">
            <div className="bg-card border border-border rounded-xl sm:rounded-2xl overflow-hidden">
              {imageGeneration.isLoading ? (
                <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]">
                  <ProgressBar progress={imageGeneration.progress} />
                </div>
              ) : imageUpload.isConvertingHeic ? (
                <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]">
                  <ProgressBar progress={imageUpload.heicProgress} label="Converting HEIC image..." />
                </div>
              ) : imageGeneration.generatedImage ? (
                <div className="p-3 sm:p-4">
                  {/* Image Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                    <span className="text-xs sm:text-sm text-foreground/60">Generated Image</span>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <button
                        onClick={() => imageGeneration.setGeneratedImage(null)}
                        className="h-7 sm:h-8 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground text-xs sm:text-sm transition-colors"
                        title="New Generation"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>New</span>
                      </button>
                      <div className="w-px h-4 sm:h-5 bg-border hidden sm:block" />
                      <button
                        onClick={useGeneratedAsInput}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Use as Input"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </button>
                      <button
                        onClick={copyImageToClipboard}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Copy"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.5} />
                          <path strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                      <button
                        onClick={downloadImage}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Download"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowFullscreen(true)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                        title="Fullscreen"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className="max-w-full max-h-[300px] sm:max-h-[500px] object-contain rounded-lg sm:rounded-xl"
                    />
                  </div>

                  {/* Prompt Display */}
                  <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-secondary/30 rounded-lg sm:rounded-xl">
                    <p className="text-xs sm:text-sm text-foreground/70">
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
