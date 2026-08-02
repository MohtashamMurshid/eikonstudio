import { useState, useCallback, useRef, useEffect } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { validateImageFormat, compressImage, convertHeicToPng } from "@/components/image-combiner/utils/image-processing"

export function useGalleryUpload(currentFolderId: Id<"folders"> | null) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState("")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFilename, setUploadFilename] = useState("")
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState("")
  const [uploadFolderId, setUploadFolderId] = useState<Id<"folders"> | undefined>(undefined)
  const [isDragOver, setIsDragOver] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Process file for upload
  const processFileForUpload = useCallback(async (file: File) => {
    if (!validateImageFormat(file)) {
      setUploadError("Please select a valid image file (JPG, PNG, WebP, HEIC)")
      return
    }
    
    setUploadError("")
    setUploadProgress("Processing image...")
    
    try {
      let processedFile = file
      
      const isHeic = file.type.toLowerCase().includes("heic") || 
                     file.type.toLowerCase().includes("heif") ||
                     file.name.toLowerCase().endsWith(".heic") ||
                     file.name.toLowerCase().endsWith(".heif")
      
      if (isHeic) {
        setUploadProgress("Converting HEIC...")
        processedFile = await convertHeicToPng(file)
      }
      
      setUploadProgress("Compressing...")
      processedFile = await compressImage(processedFile, 1280, 0.8)
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        setUploadPreview(dataUrl)
        setUploadFile(processedFile)
        
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-")
        setUploadFilename(baseName.substring(0, 30))
        
        // If inside a folder, default to that folder
        setUploadFolderId(currentFolderId || undefined)
        
        setShowUploadModal(true)
        setUploadProgress("")
      }
      reader.readAsDataURL(processedFile)
    } catch (error) {
      console.error("Error processing image:", error)
      setUploadError("Failed to process image. Please try again.")
      setUploadProgress("")
    }
  }, [currentFolderId])

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      processFileForUpload(file)
    } else {
      setUploadError("Please drop a valid image file")
    }
  }, [processFileForUpload])

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            processFileForUpload(file)
          }
          return
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [processFileForUpload])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    await processFileForUpload(file)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const resetUploadState = useCallback(() => {
    setShowUploadModal(false)
    setUploadFilename("")
    setUploadPreview(null)
    setUploadFile(null)
    setUploadError("")
    setUploadProgress("")
  }, [])

  return {
    isUploading,
    setIsUploading,
    uploadProgress,
    showUploadModal,
    uploadFilename,
    uploadPreview,
    uploadFile,
    uploadError,
    setUploadError,
    uploadFolderId,
    setUploadFolderId,
    setUploadFilename,
    isDragOver,
    fileInputRef,
    processFileForUpload,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    resetUploadState,
  }
}

