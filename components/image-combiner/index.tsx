"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useMutation, useConvex } from "convex/react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ImageCombinerProps, GeneratedImage } from "./types"
import { useToast } from "./hooks/use-toast"
import { useImageUpload, type ImageSlot } from "./hooks/use-image-upload"
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
  // Track which @mentions are loaded in which image slots: { filename: slotNumber or array for folders }
  const [mentionSlots, setMentionSlots] = useState<{ [filename: string]: ImageSlot | ImageSlot[] }>({})
  // Track images being removed for exit animation
  const [removingImages, setRemovingImages] = useState<{ 1?: boolean; 2?: boolean; 3?: boolean; 4?: boolean }>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { toast, showToast } = useToast()
  
  // Convex client for direct queries
  const convex = useConvex()
  
  // Convex mutations for saving generations
  const generateUploadUrl = useMutation(api.generations.generateUploadUrl)
  const saveGeneration = useMutation(api.generations.saveGeneration)
  
  // Gallery mutations
  const galleryGenerateUploadUrl = useMutation(api.gallery.generateUploadUrl)
  const saveToGallery = useMutation(api.gallery.saveImage)
  const [isAddingToGallery, setIsAddingToGallery] = useState(false)
  
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
    image3: imageUpload.image3,
    image3Url: imageUpload.image3Url,
    image4: imageUpload.image4,
    image4Url: imageUpload.image4Url,
    prompt,
    aspectRatio,
    imageSize,
    selectedArtStyle,
    onError: (message) => showToast(message, "error"),
    generateUploadUrl,
    onSaveGeneration: async (params) => {
      await saveGeneration(params)
    },
    onSaveError: (message) => showToast(message, "warning"),
  })

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
    handleImageUpload: imageUpload.handleImageUpload,
    handleUrlChange: imageUpload.handleUrlChange,
    setUseUrls: imageUpload.setUseUrls,
    getFirstAvailableSlot: imageUpload.getFirstAvailableSlot,
  })

  const dragDrop = useDragDrop({
    useUrls: imageUpload.useUrls,
    image1: imageUpload.image1,
    image2: imageUpload.image2,
    image3: imageUpload.image3,
    image4: imageUpload.image4,
    handleImageUpload: imageUpload.handleImageUpload,
    getFirstAvailableSlot: imageUpload.getFirstAvailableSlot,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, imageNumber: ImageSlot) => {
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
        
        const imageUrl = imageGeneration.generatedImage.url
        
        // For data URLs, convert to PNG blob using canvas for proper clipboard support
        if (imageUrl.startsWith("data:")) {
          const img = new Image()
          img.crossOrigin = "anonymous"
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const canvas = document.createElement("canvas")
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext("2d")
              if (!ctx) {
                reject(new Error("Could not get canvas context"))
                return
              }
              ctx.drawImage(img, 0, 0)
              canvas.toBlob(async (blob) => {
                if (!blob) {
                  reject(new Error("Could not create blob"))
                  return
                }
                try {
                  const clipboardItem = new ClipboardItem({ "image/png": blob })
                  await navigator.clipboard.write([clipboardItem])
                  showToast("Image copied to clipboard!", "success")
                  resolve()
                } catch (clipErr) {
                  reject(clipErr)
                }
              }, "image/png")
            }
            img.onerror = () => reject(new Error("Failed to load image"))
            img.src = imageUrl
          })
        } else {
          // For regular URLs, fetch and copy
          window.focus()
          let response
          try {
            response = await fetch(imageUrl, { mode: "cors" })
          } catch {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
            response = await fetch(proxyUrl)
          }
          if (!response.ok) throw new Error("Failed to fetch image")
          const blob = await response.blob()
          // Ensure it's PNG for clipboard compatibility
          const pngBlob = blob.type === "image/png" ? blob : await convertToPngBlob(blob)
          const clipboardItem = new ClipboardItem({ "image/png": pngBlob })
          await navigator.clipboard.write([clipboardItem])
          showToast("Image copied to clipboard!", "success")
        }
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

  // Helper to convert any image blob to PNG
  const convertToPngBlob = (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((pngBlob) => {
          if (pngBlob) resolve(pngBlob)
          else reject(new Error("Could not convert to PNG"))
        }, "image/png")
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = URL.createObjectURL(blob)
    })
  }

  // Add generated image to gallery
  const addToGallery = async () => {
    if (!imageGeneration.generatedImage?.url) return
    
    setIsAddingToGallery(true)
    try {
      const imageUrl = imageGeneration.generatedImage.url
      
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
        galleryGenerateUploadUrl(),
        galleryGenerateUploadUrl(),
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
      
      showToast("Image added to gallery!", "success")
    } catch (error) {
      console.error("Error adding to gallery:", error)
      showToast("Failed to add to gallery", "error")
    } finally {
      setIsAddingToGallery(false)
    }
  }

  const useGeneratedAsInput = async () => {
    if (!imageGeneration.generatedImage?.url) return
    try {
      const response = await fetch(imageGeneration.generatedImage.url)
      const blob = await response.blob()
      const file = new File([blob], "generated-image.png", { type: "image/png" })
      const availableSlot = imageUpload.getFirstAvailableSlot()
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

  const canGenerate = prompt.trim().length > 0 && (currentMode === "text-to-image" || (imageUpload.useUrls ? imageUpload.image1Url : imageUpload.image1))

  // Handle prompt change with cursor tracking
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    const oldText = prompt
    
    // Check for removed @mentions and clear their associated images
    // Support both @filename and @folder/filename patterns
    const mentionPattern = /@([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/g
    const oldMentions = [...oldText.matchAll(mentionPattern)].map(m => m[1])
    const newMentions = [...newText.matchAll(mentionPattern)].map(m => m[1])
    
    // Find mentions that were in old text but not in new text
    const removedMentions = oldMentions.filter(m => !newMentions.includes(m))
    
    // Clear images for removed mentions with animation
    if (removedMentions.length > 0) {
      const updatedSlots = { ...mentionSlots }
      const slotsToRemove: ImageSlot[] = []
      
      removedMentions.forEach(filename => {
        const slotData = mentionSlots[filename]
        if (slotData) {
          // Handle both single slot and array of slots (for folders)
          if (Array.isArray(slotData)) {
            slotsToRemove.push(...slotData)
          } else {
            slotsToRemove.push(slotData)
          }
          delete updatedSlots[filename]
        }
      })
      
      // Start exit animation
      if (slotsToRemove.length > 0) {
        setRemovingImages(prev => {
          const next = { ...prev }
          slotsToRemove.forEach(slot => { next[slot] = true })
          return next
        })
        
        // Actually clear after animation completes
        setTimeout(() => {
          slotsToRemove.forEach(slot => imageUpload.clearImage(slot))
          setRemovingImages(prev => {
            const next = { ...prev }
            slotsToRemove.forEach(slot => { delete next[slot] })
            return next
          })
        }, 200)
      }
      
      setMentionSlots(updatedSlots)
    }
    
    setPrompt(newText)
    setCursorPosition(e.target.selectionStart || 0)
    
    // Check if we should show mention dropdown
    const cursor = e.target.selectionStart || 0
    
    // Look backwards from cursor to find @
    let hasAtSymbol = false
    for (let i = cursor - 1; i >= 0; i--) {
      if (/\s/.test(newText[i])) break
      if (newText[i] === "@") {
        hasAtSymbol = true
        break
      }
    }
    setShowMentionDropdown(hasAtSymbol)
  }

  // Handle mention selection from autocomplete - supports single image or folder (multiple images)
  const handleMentionSelect = useCallback(async (
    filename: string, 
    startIndex: number, 
    endIndex: number, 
    imageData: string | string[], // Can be single URL or array of URLs for folder
    isFolder?: boolean
  ) => {
    // Replace partial @... with complete @filename + space (keep it in the prompt)
    const before = prompt.slice(0, startIndex)
    const after = prompt.slice(endIndex)
    // Add space after @filename so user can continue typing immediately
    const newPrompt = `${before}@${filename} ${after.trimStart()}`
    setPrompt(newPrompt)
    setShowMentionDropdown(false)
    
    // Handle folder selection - fetch images from the folder
    if (isFolder) {
      try {
        // Fetch folder images directly using convex client
        const folderImages = await convex.query(api.gallery.getImagesByFolderName, { folderName: filename })
        
        if (!folderImages || folderImages.length === 0) {
          showToast(`Folder @${filename} is empty`, "error")
          return
        }
        
        // Clear all existing images first when loading a folder
        imageUpload.clearAllImages()
        
        // Load up to 4 images from the folder
        const imagesToLoad = folderImages.slice(0, 4)
        const loadedSlots: ImageSlot[] = []
        
        for (let i = 0; i < imagesToLoad.length; i++) {
          const img = imagesToLoad[i]
          if (!img.imageUrl) continue
          
          const slot = (i + 1) as ImageSlot
          try {
            const response = await fetch(img.imageUrl)
            const blob = await response.blob()
            const file = new File([blob], `${filename}-${i + 1}.png`, { type: "image/png" })
            imageUpload.handleImageUpload(file, slot)
            loadedSlots.push(slot)
          } catch (error) {
            console.error(`Failed to load folder image ${i + 1}:`, error)
          }
        }
        
        // Track the folder mention with all slots it occupies
        if (loadedSlots.length > 0) {
          setMentionSlots(prev => ({ ...prev, [filename]: loadedSlots }))
        }
        showToast(`Loaded ${loadedSlots.length} image(s) from @${filename}`, "success")
      } catch (error) {
        console.error("Failed to fetch folder images:", error)
        showToast(`Failed to load folder @${filename}`, "error")
      }
    } else if (typeof imageData === "string" && imageData) {
      // Single image selection
      try {
        const response = await fetch(imageData)
        const blob = await response.blob()
        const file = new File([blob], `${filename}.png`, { type: "image/png" })
        
        // Determine which slot to use
        const targetSlot = imageUpload.getFirstAvailableSlot() || 1
        
        imageUpload.handleImageUpload(file, targetSlot)
        
        // Track which slot this mention is using
        setMentionSlots(prev => ({ ...prev, [filename]: targetSlot }))
      } catch (error) {
        console.error("Failed to load gallery image:", error)
      }
    }
    
    // Focus textarea and place cursor after the @filename + space
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newCursorPos = startIndex + filename.length + 2 // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
      }
    }, 0)
  }, [prompt, imageUpload, showToast, convex])

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
  // Supports @filename, @folder/filename, and @folder (loads all folder images)
  const handleGenerateWithMentions = useCallback(async () => {
    // Find all @mentions in the prompt - supports folder/filename format
    const mentionRegex = /@([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/g
    const matches = [...prompt.matchAll(mentionRegex)]
    
    if (matches.length === 0) {
      // No mentions, generate normally
      imageGeneration.generateImage()
      return
    }

    // Resolve mentions to images (but keep prompt unchanged)
    const resolvedImages: { filename: string; imageUrl: string }[] = []

    for (const match of matches) {
      const mention = match[1]
      
      // Check if it's a folder/filename or just filename
      if (mention.includes("/")) {
        // folder/filename format - find specific image in folder
        const galleryImage = galleryImages?.find((img: any) => 
          img.fullPath === mention || `${img.folderName}/${img.filename}` === mention
        )
        if (galleryImage && galleryImage.imageUrl) {
          resolvedImages.push({
            filename: mention,
            imageUrl: galleryImage.imageUrl,
          })
        }
      } else {
        // Could be a folder name or a root-level filename
        // First check if it's a root-level image
        const galleryImage = galleryImages?.find((img: any) => 
          img.filename === mention && !img.folderId
        )
        
        if (galleryImage && galleryImage.imageUrl) {
          resolvedImages.push({
            filename: mention,
            imageUrl: galleryImage.imageUrl,
          })
        } else {
          // Check if it's a folder - load all images from it
          const folderImages = galleryImages?.filter((img: any) => 
            img.folderName === mention
          ) || []
          
          for (const img of folderImages.slice(0, 4)) {
            if (img.imageUrl) {
              resolvedImages.push({
                filename: `${mention}/${img.filename}`,
                imageUrl: img.imageUrl,
              })
            }
          }
        }
      }
    }

    // Load resolved images into input slots (up to 4), then generate
    if (resolvedImages.length > 0) {
      try {
        const imagesToLoad = resolvedImages.slice(0, 4)
        
        for (let i = 0; i < imagesToLoad.length; i++) {
          const img = imagesToLoad[i]
          const slot = (i + 1) as ImageSlot
          const response = await fetch(img.imageUrl)
          const blob = await response.blob()
          const file = new File([blob], `${img.filename}.png`, { type: "image/png" })
          imageUpload.handleImageUpload(file, slot)
        }
        
        showToast(`Loaded ${imagesToLoad.length} reference image(s) from gallery`, "success")
        
        // Generate after a short delay to allow image loading (keep prompt as-is with @mentions)
        setTimeout(() => {
          imageGeneration.generateImage()
        }, 500)
      } catch (error) {
        console.error("Error loading reference images:", error)
        showToast("Failed to load reference images from gallery", "error")
      }
    } else {
      // No valid mentions found, generate normally
      imageGeneration.generateImage()
    }
  }, [prompt, galleryImages, imageGeneration, imageUpload, showToast])

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
            {/* Image Previews - Above Textarea with smooth height animation */}
            <div 
              className="grid transition-all duration-300 ease-out"
              style={{ 
                gridTemplateRows: (imageUpload.image1Preview || imageUpload.image2Preview || imageUpload.image3Preview || imageUpload.image4Preview) ? "1fr" : "0fr",
              }}
            >
              <div className="overflow-hidden">
                <div className="p-3 sm:p-4 pb-0">
                  <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
                    {/* Render image slots 1-4 */}
                    {([
                      { slot: 1 as ImageSlot, preview: imageUpload.image1Preview },
                      { slot: 2 as ImageSlot, preview: imageUpload.image2Preview },
                      { slot: 3 as ImageSlot, preview: imageUpload.image3Preview },
                      { slot: 4 as ImageSlot, preview: imageUpload.image4Preview },
                    ]).map(({ slot, preview }) => preview && (
                      <div 
                        key={slot}
                        className={`relative group transition-all duration-200 ease-out ${
                          removingImages[slot] 
                            ? "opacity-0 scale-90" 
                            : "opacity-100 scale-100 animate-in fade-in zoom-in-95"
                        }`}
                      >
                        <img 
                          src={preview} 
                          alt={`Input ${slot}`} 
                          className="w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] rounded-lg sm:rounded-xl object-cover border border-border/50" 
                        />
                        {/* Action buttons - always visible on mobile */}
                        <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 flex items-center gap-0.5">
                          <button
                            onClick={() => document.getElementById(`image-upload-${slot}`)?.click()}
                            className="w-5 h-5 sm:w-6 sm:h-6 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                            title="Replace image"
                          >
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => imageUpload.clearImage(slot)}
                            className="w-5 h-5 sm:w-6 sm:h-6 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                            title="Remove image"
                          >
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* Slot number indicator */}
                        <div className="absolute bottom-1 left-1 w-4 h-4 bg-foreground/80 text-background rounded-full flex items-center justify-center text-[10px] font-medium">
                          {slot}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Textarea with Mention Autocomplete */}
            <div className="p-3 sm:p-4 pb-2 relative">
              {/* Highlight backdrop - renders text with @mentions highlighted (supports @folder/filename) */}
              <div 
                className="absolute inset-0 p-3 sm:p-4 pb-2 pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-sm sm:text-base text-foreground"
                style={{ fontSize: "16px", lineHeight: "1.5" }}
                aria-hidden="true"
              >
                {prompt.split(/(@[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/).map((part, i) => 
                  part.match(/^@[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/) ? (
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

          {/* Suggestion Buttons - Below Input (hidden during generation) */}
          {!imageGeneration.isLoading && !imageUpload.isConvertingHeic && !imageGeneration.generatedImage && (
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
          )}

          {/* Hidden file inputs for all 4 slots */}
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
                      <button
                        onClick={addToGallery}
                        disabled={isAddingToGallery}
                        className="h-7 sm:h-8 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 hover:text-emerald-700 text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Add to Gallery"
                      >
                        {isAddingToGallery ? (
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        <span>{isAddingToGallery ? "Adding..." : "Add to Gallery"}</span>
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
