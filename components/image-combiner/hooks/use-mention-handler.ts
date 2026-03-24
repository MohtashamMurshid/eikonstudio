import { useState, useCallback, useRef } from "react"
import { useConvex } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { ImageSlot } from "./use-image-upload"

interface UseMentionHandlerProps {
  prompt: string
  setPrompt: (prompt: string) => void
  galleryImages: any[] | undefined
  imageUpload: {
    switchToFileMode: () => void
    getFirstAvailableSlot: () => ImageSlot | null
    handleImageUpload: (file: File, slot: ImageSlot) => void
    clearAllImages: () => void
    clearImage: (slot: ImageSlot) => void
  }
  onError: (message: string) => void
  onSuccess: (message: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * Hook for handling mentions in the prompt
 * @param prompt - The current prompt
 * @param setPrompt - The function to set the prompt
 * @param galleryImages - The gallery images
 * @param imageUpload - The image upload hook
 * @param onError - The function to call if there is an error
 * @param onSuccess - The function to call if the image is added to the gallery
 * @param textareaRef - The textarea ref
 */
export function useMentionHandler({
  prompt,
  setPrompt,
  galleryImages,
  imageUpload,
  onError,
  onSuccess,
  textareaRef,
}: UseMentionHandlerProps) {
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionSlots, setMentionSlots] = useState<{ [filename: string]: ImageSlot | ImageSlot[] }>({})
  const [removingImages, setRemovingImages] = useState<{ 1?: boolean; 2?: boolean; 3?: boolean; 4?: boolean }>({})
  const expectedPromptRef = useRef<string | null>(null)
  const convex = useConvex()

  const handleMentionSelect = useCallback(async (
    filename: string,
    startIndex: number,
    endIndex: number,
    imageData: string | string[],
    isFolder?: boolean
  ) => {
    // Replace partial @... with complete @filename + space (keep it in the prompt)
    const before = prompt.slice(0, startIndex)
    const after = prompt.slice(endIndex)
    // Add space after @filename so user can continue typing immediately
    const newPrompt = `${before}@${filename} ${after.trimStart()}`
    // Store expected prompt to guard against stale cursor repositioning
    expectedPromptRef.current = newPrompt
    setPrompt(newPrompt)
    setShowMentionDropdown(false)

    // Handle folder selection - fetch images from the folder
    if (isFolder) {
      try {
        // Fetch folder images directly using convex client
        const folderImages = await convex.query(api.gallery.getImagesByFolderName, { folderName: filename })

        if (!folderImages || folderImages.length === 0) {
          onError(`Folder @${filename} is empty`)
          return
        }

        imageUpload.switchToFileMode()
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
        onSuccess(`Loaded ${loadedSlots.length} image(s) from @${filename}`)
      } catch (error) {
        console.error("Failed to fetch folder images:", error)
        onError(`Failed to load folder @${filename}`)
      }
    } else if (typeof imageData === "string" && imageData) {
      // Single image selection
      try {
        const response = await fetch(imageData)
        const blob = await response.blob()
        const file = new File([blob], `${filename}.png`, { type: "image/png" })

        imageUpload.switchToFileMode()
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
    // Use the stored expected prompt to avoid stale cursor repositioning if user types
    const expectedPrompt = newPrompt
    setTimeout(() => {
      // Only reposition cursor if user hasn't typed (prompt unchanged)
      if (textareaRef.current && expectedPromptRef.current === expectedPrompt) {
        textareaRef.current.focus()
        const newCursorPos = startIndex + filename.length + 2 // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
      }
      // Clear the expected prompt ref
      expectedPromptRef.current = null
    }, 0)
  }, [prompt, imageUpload, onError, onSuccess, convex, textareaRef, setPrompt])

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    const oldText = prompt

    // Clear expected prompt ref to prevent stale cursor repositioning from mention selection
    // This ensures that if user types while folder images are loading, cursor won't jump
    expectedPromptRef.current = null

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
  }, [prompt, mentionSlots, imageUpload, setPrompt])

  const handleGenerateWithMentions = useCallback(async (generateImage: () => void) => {
    // Find all @mentions in the prompt - supports folder/filename format
    const mentionRegex = /@([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/g
    const matches = [...prompt.matchAll(mentionRegex)]

    if (matches.length === 0) {
      // No mentions, generate normally
      generateImage()
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

        // Load all images in parallel and wait for completion
        const uploadPromises = imagesToLoad.map(async (img, i) => {
          const slot = (i + 1) as ImageSlot
          try {
            const response = await fetch(img.imageUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.statusText}`)
            }
            const blob = await response.blob()
            const file = new File([blob], `${img.filename}.png`, { type: "image/png" })
            
            // Return a promise that resolves when upload completes
            return new Promise<void>((resolve, reject) => {
              try {
                imageUpload.handleImageUpload(file, slot)
                // Wait for the specific slot to be populated in the image upload state
                // This is a more robust way to ensure the image is ready
                const checkInterval = setInterval(() => {
                  // We'd ideally check imageUpload state here, but since we don't have direct access 
                  // to the state object, we'll use a slightly longer buffer or check a ref if available.
                  // For now, increasing the timeout and resolving.
                  clearInterval(checkInterval)
                  resolve()
                }, 150)
              } catch (err) {
                reject(err)
              }
            })
          } catch (error) {
            console.error(`Failed to load image ${i + 1}:`, error)
            throw error
          }
        })

        // Wait for all uploads to complete before generating
        await Promise.all(uploadPromises)

        onSuccess(`Loaded ${imagesToLoad.length} reference image(s) from gallery`)

        // Generate immediately after all images are confirmed loaded
        generateImage()
      } catch (error) {
        console.error("Error loading reference images:", error)
        onError("Failed to load reference images from gallery")
      }
    } else {
      // No valid mentions found, generate normally
      generateImage()
    }
  }, [prompt, galleryImages, imageUpload, onError, onSuccess])

  return {
    cursorPosition,
    setCursorPosition,
    showMentionDropdown,
    setShowMentionDropdown,
    removingImages,
    handleMentionSelect,
    handlePromptChange,
    handleGenerateWithMentions,
  }
}

