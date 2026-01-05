"use client"

import { useState, useCallback, useRef, memo, useEffect } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { LogoLoader } from "@/components/logo-icon"
import { validateImageFormat, compressImage, convertHeicToPng } from "@/components/image-combiner/utils/image-processing"
import { DragOverlay } from "@/components/image-combiner/components/drag-overlay"

interface GalleryImage {
  _id: Id<"gallery">
  _creationTime: number
  userId: string
  filename: string
  imageStorageId: Id<"_storage">
  thumbnailStorageId: Id<"_storage">
  folderId?: Id<"folders">
  folderName?: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  createdAt: number
}

interface Folder {
  _id: Id<"folders">
  name: string
  imageCount: number
  isFull: boolean
  createdAt: number
}

// Lazy-loaded image component
const LazyImage = memo(({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin: "50px" }
    )
    
    if (imgRef.current) {
      observer.observe(imgRef.current)
    }
    
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={className}>
      {!isInView ? (
        <div className="w-full h-full bg-secondary/20 animate-pulse" />
      ) : (
        <>
          {!isLoaded && <div className="w-full h-full bg-secondary/20 animate-pulse absolute inset-0" />}
          <img
            src={src}
            alt={alt}
            className={`w-full h-full object-cover ${isLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
          />
        </>
      )}
    </div>
  )
})

LazyImage.displayName = "LazyImage"

// Gallery card component
const GalleryCard = memo(({
  image,
  onRename,
  onDelete,
  onViewFull,
  onMove,
  deletingId,
  renamingId,
}: {
  image: GalleryImage
  onRename: (id: Id<"gallery">, currentName: string) => void
  onDelete: (id: Id<"gallery">) => void
  onViewFull: (image: GalleryImage) => void
  onMove?: (id: Id<"gallery">) => void
  deletingId: Id<"gallery"> | null
  renamingId: Id<"gallery"> | null
}) => {
  // Generate the full path for display
  const displayPath = image.folderName 
    ? `${image.folderName}/${image.filename}` 
    : image.filename

  return (
    <div
      className="group relative bg-secondary/30 rounded-xl overflow-hidden border border-border hover:border-foreground/20 transition-all cursor-pointer"
      onClick={() => onViewFull(image)}
    >
      {/* Image */}
      <div className="aspect-square relative">
        <LazyImage
          src={image.thumbnailUrl || ""}
          alt={image.filename}
          className="aspect-square relative"
        />
        
        {/* Folder badge */}
        {image.folderName && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-foreground/80 text-background text-[10px] font-medium rounded">
            {image.folderName}
          </div>
        )}
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRename(image._id, image.filename)
            }}
            disabled={renamingId === image._id}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            title="Rename"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          {onMove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMove(image._id)
              }}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Move to folder"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(image._id)
            }}
            disabled={deletingId === image._id}
            className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            title="Delete"
          >
            {deletingId === image._id ? (
              <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-medium text-foreground truncate" title={`@${displayPath}`}>
          @{displayPath}
        </p>
        <p className="text-[10px] text-foreground/40 mt-0.5">
          Use in prompt: @{displayPath}
        </p>
      </div>
    </div>
  )
})

GalleryCard.displayName = "GalleryCard"

// Create thumbnail blob from image data
const createThumbnailBlob = async (imageDataUrl: string, size = 250): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
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
    img.onerror = () => reject(new Error("Could not load image"))
    img.src = imageDataUrl
  })
}

// Convert data URL to Blob
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl)
  return await response.blob()
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

export default function GalleryPage() {
  const images = useQuery(api.gallery.getMyImages, { limit: 100 }) as GalleryImage[] | undefined
  const folders = useQuery(api.gallery.getMyFolders, {}) as Folder[] | undefined
  const generateUploadUrl = useMutation(api.gallery.generateUploadUrl)
  const saveImage = useMutation(api.gallery.saveImage)
  const renameImage = useMutation(api.gallery.renameImage)
  const deleteImage = useMutation(api.gallery.deleteImage)
  const createFolder = useMutation(api.gallery.createFolder)
  const renameFolder = useMutation(api.gallery.renameFolder)
  const deleteFolder = useMutation(api.gallery.deleteFolder)
  const moveImageToFolder = useMutation(api.gallery.moveImageToFolder)
  
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"gallery"> | null>(null)
  const [renamingId, setRenamingId] = useState<Id<"gallery"> | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  
  // Folder state
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | "all" | "root">("all")
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [folderError, setFolderError] = useState("")
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [imageToMove, setImageToMove] = useState<Id<"gallery"> | null>(null)
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFilename, setUploadFilename] = useState("")
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState("")
  const [uploadFolderId, setUploadFolderId] = useState<Id<"folders"> | undefined>(undefined)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)

  // Process file for upload (shared between file input, drag-drop, and paste)
  const processFileForUpload = useCallback(async (file: File) => {
    if (!validateImageFormat(file)) {
      setUploadError("Please select a valid image file (JPG, PNG, WebP, HEIC)")
      return
    }
    
    setUploadError("")
    setUploadProgress("Processing image...")
    
    try {
      let processedFile = file
      
      // Handle HEIC conversion
      const isHeic = file.type.toLowerCase().includes("heic") || 
                     file.type.toLowerCase().includes("heif") ||
                     file.name.toLowerCase().endsWith(".heic") ||
                     file.name.toLowerCase().endsWith(".heif")
      
      if (isHeic) {
        setUploadProgress("Converting HEIC...")
        processedFile = await convertHeicToPng(file)
      }
      
      // Compress image
      setUploadProgress("Compressing...")
      processedFile = await compressImage(processedFile, 1280, 0.8)
      
      // Read as data URL
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        setUploadPreview(dataUrl)
        setUploadFile(processedFile)
        
        // Generate default filename from file name
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-")
        setUploadFilename(baseName.substring(0, 30))
        
        setShowUploadModal(true)
        setUploadProgress("")
      }
      reader.readAsDataURL(processedFile)
    } catch (error) {
      console.error("Error processing image:", error)
      setUploadError("Failed to process image. Please try again.")
      setUploadProgress("")
    }
  }, [])

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

      // Check if we're in an input field (don't intercept paste in inputs)
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // Handle image files
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
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUploadConfirm = async () => {
    if (!uploadPreview || !uploadFilename.trim()) {
      setUploadError("Please enter a filename")
      return
    }
    
    // Validate filename format
    const filenameRegex = /^[a-zA-Z0-9_-]+$/
    if (!filenameRegex.test(uploadFilename)) {
      setUploadError("Filename can only contain letters, numbers, hyphens, and underscores")
      return
    }
    
    setIsUploading(true)
    setUploadError("")
    
    try {
      // Convert image to blob and create thumbnail blob
      const imageBlob = await dataUrlToBlob(uploadPreview)
      const thumbnailBlob = await createThumbnailBlob(uploadPreview)
      
      // Upload both to Convex storage
      const [imageStorageId, thumbnailStorageId] = await Promise.all([
        uploadToStorage(imageBlob, generateUploadUrl),
        uploadToStorage(thumbnailBlob, generateUploadUrl),
      ])
      
      await saveImage({
        filename: uploadFilename.trim(),
        imageStorageId,
        thumbnailStorageId,
        folderId: uploadFolderId,
      })
      
      // Reset modal state
      setShowUploadModal(false)
      setUploadFilename("")
      setUploadPreview(null)
      setUploadFile(null)
    } catch (error: any) {
      console.error("Error saving image:", error)
      setUploadError(error.message || "Failed to save image")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRename = useCallback(async (id: Id<"gallery">, currentName: string) => {
    const newName = prompt("Enter new filename:", currentName)
    if (!newName || newName === currentName) return
    
    // Validate filename format
    const filenameRegex = /^[a-zA-Z0-9_-]+$/
    if (!filenameRegex.test(newName)) {
      alert("Filename can only contain letters, numbers, hyphens, and underscores")
      return
    }
    
    setRenamingId(id)
    try {
      await renameImage({ imageId: id, newFilename: newName })
    } catch (error: any) {
      console.error("Error renaming image:", error)
      alert(error.message || "Failed to rename image")
    } finally {
      setRenamingId(null)
    }
  }, [renameImage])

  const handleDelete = useCallback(async (id: Id<"gallery">) => {
    if (!confirm("Are you sure you want to delete this reference image?")) return
    
    setDeletingId(id)
    try {
      await deleteImage({ imageId: id })
      setSelectedImage((prev) => (prev?._id === id ? null : prev))
    } catch (error) {
      console.error("Error deleting image:", error)
      alert("Failed to delete image")
    } finally {
      setDeletingId(null)
    }
  }, [deleteImage])

  // Filter images by search term and folder
  const filteredImages = images?.filter((img) => {
    // Filter by search term
    const matchesSearch = img.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (img.folderName?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    // Filter by folder
    let matchesFolder = true
    if (selectedFolderId === "root") {
      matchesFolder = !img.folderId
    } else if (selectedFolderId !== "all") {
      matchesFolder = img.folderId === selectedFolderId
    }
    
    return matchesSearch && matchesFolder
  })
  
  // Folder handlers
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setFolderError("Please enter a folder name")
      return
    }
    
    const nameRegex = /^[a-zA-Z0-9_-]+$/
    if (!nameRegex.test(newFolderName)) {
      setFolderError("Folder name can only contain letters, numbers, hyphens, and underscores")
      return
    }
    
    try {
      await createFolder({ name: newFolderName.trim() })
      setShowCreateFolderModal(false)
      setNewFolderName("")
      setFolderError("")
    } catch (error: any) {
      setFolderError(error.message || "Failed to create folder")
    }
  }
  
  const handleRenameFolder = async (folderId: Id<"folders">, currentName: string) => {
    const newName = prompt("Enter new folder name:", currentName)
    if (!newName || newName === currentName) return
    
    const nameRegex = /^[a-zA-Z0-9_-]+$/
    if (!nameRegex.test(newName)) {
      alert("Folder name can only contain letters, numbers, hyphens, and underscores")
      return
    }
    
    try {
      await renameFolder({ folderId, newName })
    } catch (error: any) {
      alert(error.message || "Failed to rename folder")
    }
  }
  
  const handleDeleteFolder = async (folderId: Id<"folders">) => {
    const folder = folders?.find(f => f._id === folderId)
    const confirmMsg = folder?.imageCount 
      ? `This will delete the folder "${folder.name}" and all ${folder.imageCount} image(s) inside. Are you sure?`
      : `Delete folder "${folder?.name}"?`
    
    if (!confirm(confirmMsg)) return
    
    try {
      await deleteFolder({ folderId })
      if (selectedFolderId === folderId) {
        setSelectedFolderId("all")
      }
    } catch (error: any) {
      alert(error.message || "Failed to delete folder")
    }
  }
  
  const handleMoveImage = async (targetFolderId: Id<"folders"> | undefined) => {
    if (!imageToMove) return
    
    try {
      await moveImageToFolder({ imageId: imageToMove, folderId: targetFolderId })
      setShowMoveModal(false)
      setImageToMove(null)
    } catch (error: any) {
      alert(error.message || "Failed to move image")
    }
  }
  
  const openMoveModal = (imageId: Id<"gallery">) => {
    setImageToMove(imageId)
    setShowMoveModal(true)
  }

  if (images === undefined) {
    return (
      <div className="p-3 sm:p-4 md:p-6 min-h-screen">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <LogoLoader size="md" text="Loading gallery" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="p-3 sm:p-4 md:p-6 min-h-screen relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <DragOverlay isDragOver={isDragOver} />
      <div className="bg-white rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Reference Gallery</h2>
              <p className="text-sm text-foreground/50 mt-1">
                {images?.length || 0} image{images?.length !== 1 ? "s" : ""} • Use @filename or @folder to reference
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-36 sm:w-48 h-9 pl-9 pr-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              
              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-9 px-3 flex items-center gap-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {uploadProgress ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="hidden sm:inline">{uploadProgress}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">Upload</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
          
          {/* Horizontal Folder Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {/* All Images Tab */}
            <button
              onClick={() => setSelectedFolderId("all")}
              className={`flex-shrink-0 h-8 px-3 flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedFolderId === "all" 
                  ? "bg-foreground text-background" 
                  : "bg-secondary/60 text-foreground/70 hover:bg-secondary"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              All
              <span className="text-xs opacity-70">{images?.length || 0}</span>
            </button>
            
            {/* Uncategorized Tab */}
            <button
              onClick={() => setSelectedFolderId("root")}
              className={`flex-shrink-0 h-8 px-3 flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedFolderId === "root" 
                  ? "bg-foreground text-background" 
                  : "bg-secondary/60 text-foreground/70 hover:bg-secondary"
              }`}
            >
              Loose
              <span className="text-xs opacity-70">{images?.filter(i => !i.folderId).length || 0}</span>
            </button>
            
            {/* Folder Tabs */}
            {folders?.map((folder) => (
              <div key={folder._id} className="group relative flex-shrink-0">
                <button
                  onClick={() => setSelectedFolderId(folder._id)}
                  className={`h-8 pl-3 pr-8 flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedFolderId === folder._id 
                      ? "bg-foreground text-background" 
                      : "bg-secondary/60 text-foreground/70 hover:bg-secondary"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="truncate max-w-[100px]">{folder.name}</span>
                  <span className={`text-xs ${folder.isFull ? "text-amber-400" : "opacity-70"}`}>
                    {folder.imageCount}/4
                  </span>
                </button>
                
                {/* Folder dropdown menu */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const menu = e.currentTarget.nextElementSibling as HTMLElement
                        menu.classList.toggle("hidden")
                      }}
                      className={`p-1 rounded-full ${selectedFolderId === folder._id ? "hover:bg-white/20" : "hover:bg-foreground/10"}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="hidden absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-border py-1 z-10 min-w-[100px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRenameFolder(folder._id, folder.name)
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-foreground/70 hover:bg-secondary flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFolder(folder._id)
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Create New Folder Button */}
            <button
              onClick={() => setShowCreateFolderModal(true)}
              className="flex-shrink-0 h-8 px-3 flex items-center gap-1.5 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          </div>

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {uploadError}
            </div>
          )}

          {/* Empty State */}
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No reference images yet</h3>
              <p className="text-sm text-foreground/50 max-w-sm mb-4">
                Upload reference images to use them in your prompts with @filename syntax.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
              >
                Upload Your First Image
              </button>
              <p className="text-xs text-foreground/40 mt-4">
                Or drag & drop images here, or paste from clipboard
              </p>
            </div>
          ) : filteredImages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <p className="text-foreground/50">No images match "{searchTerm}"</p>
            </div>
          ) : (
            /* Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredImages?.map((image) => (
                <GalleryCard
                  key={image._id}
                  image={image}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onViewFull={setSelectedImage}
                  onMove={openMoveModal}
                  deletingId={deletingId}
                  renamingId={renamingId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => {
              setShowUploadModal(false)
              setUploadFilename("")
              setUploadPreview(null)
              setUploadFile(null)
              setUploadError("")
            }}
          >
            <div 
              className="bg-white rounded-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Add to Gallery</h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadFilename("")
                    setUploadPreview(null)
                    setUploadFile(null)
                    setUploadError("")
                  }}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Preview */}
                {uploadPreview && (
                  <div className="flex justify-center">
                    <img
                      src={uploadPreview}
                      alt="Preview"
                      className="max-w-full max-h-48 object-contain rounded-xl border border-border"
                    />
                  </div>
                )}
                
                {/* Filename Input */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Filename (for @mention)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">@</span>
                    <input
                      type="text"
                      value={uploadFilename}
                      onChange={(e) => {
                        setUploadFilename(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
                        setUploadError("")
                      }}
                      placeholder="my-reference-image"
                      className="w-full h-10 pl-7 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      maxLength={30}
                    />
                  </div>
                  <p className="text-xs text-foreground/40 mt-1">
                    Letters, numbers, hyphens, and underscores only
                  </p>
                </div>
                
                {/* Folder Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Folder (optional)
                  </label>
                  <select
                    value={uploadFolderId || ""}
                    onChange={(e) => setUploadFolderId(e.target.value ? e.target.value as Id<"folders"> : undefined)}
                    className="w-full h-10 px-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">No folder (root)</option>
                    {folders?.map((folder) => (
                      <option 
                        key={folder._id} 
                        value={folder._id}
                        disabled={folder.isFull}
                      >
                        {folder.name} ({folder.imageCount}/4){folder.isFull ? " - Full" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Preview mention syntax */}
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-foreground/50 mb-1">Use in prompts:</p>
                  <code className="text-sm text-emerald-600 font-mono">
                    @{uploadFolderId && folders?.find(f => f._id === uploadFolderId)?.name 
                      ? `${folders.find(f => f._id === uploadFolderId)?.name}/${uploadFilename || "filename"}`
                      : uploadFilename || "filename"}
                  </code>
                </div>
                
                {uploadError && (
                  <p className="text-sm text-red-600">{uploadError}</p>
                )}
              </div>
              
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadFilename("")
                    setUploadPreview(null)
                    setUploadFile(null)
                    setUploadError("")
                  }}
                  className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadConfirm}
                  disabled={isUploading || !uploadFilename.trim()}
                  className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {isUploading ? "Saving..." : "Add to Gallery"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="font-semibold text-foreground">@{selectedImage.filename}</h3>
                  <p className="text-xs text-foreground/50">Reference Image</p>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                <div className="flex justify-center">
                  <img
                    src={selectedImage.imageUrl || ""}
                    alt={selectedImage.filename}
                    className="max-w-full max-h-[50vh] object-contain rounded-xl"
                  />
                </div>

                <div className="bg-secondary/30 rounded-xl p-4">
                  <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-2">Usage</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="px-3 py-1.5 bg-white rounded-lg text-sm font-mono text-emerald-600 border border-border">
                      @{selectedImage.filename}
                    </code>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(`@${selectedImage.filename}`)
                      }}
                      className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">
                    Add this to your prompt to use this image as a reference
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <button
                  onClick={() => handleRename(selectedImage._id, selectedImage.filename)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Rename
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedImage._id)
                  }}
                  disabled={deletingId === selectedImage._id}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Folder Modal */}
        {showCreateFolderModal && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => {
              setShowCreateFolderModal(false)
              setNewFolderName("")
              setFolderError("")
            }}
          >
            <div 
              className="bg-white rounded-2xl max-w-sm w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Create Folder</h3>
                <button
                  onClick={() => {
                    setShowCreateFolderModal(false)
                    setNewFolderName("")
                    setFolderError("")
                  }}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => {
                      setNewFolderName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
                      setFolderError("")
                    }}
                    placeholder="my-folder"
                    className="w-full h-10 px-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    maxLength={30}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder()
                    }}
                  />
                  <p className="text-xs text-foreground/40 mt-1">
                    Max 4 images per folder. Use @{newFolderName || "folder"} to load all images.
                  </p>
                </div>
                
                {folderError && (
                  <p className="text-sm text-red-600">{folderError}</p>
                )}
              </div>
              
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                <button
                  onClick={() => {
                    setShowCreateFolderModal(false)
                    setNewFolderName("")
                    setFolderError("")
                  }}
                  className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Move to Folder Modal */}
        {showMoveModal && imageToMove && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => {
              setShowMoveModal(false)
              setImageToMove(null)
            }}
          >
            <div 
              className="bg-white rounded-2xl max-w-sm w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Move to Folder</h3>
                <button
                  onClick={() => {
                    setShowMoveModal(false)
                    setImageToMove(null)
                  }}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
                {/* Root option */}
                <button
                  onClick={() => handleMoveImage(undefined)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Uncategorized (root)
                </button>
                
                {folders?.map((folder) => (
                  <button
                    key={folder._id}
                    onClick={() => handleMoveImage(folder._id)}
                    disabled={folder.isFull}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      folder.isFull 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-secondary"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {folder.name}
                    </span>
                    <span className={`text-xs ${folder.isFull ? "text-amber-500" : "text-foreground/50"}`}>
                      {folder.imageCount}/4
                    </span>
                  </button>
                ))}
                
                {(!folders || folders.length === 0) && (
                  <p className="text-sm text-foreground/50 text-center py-4">
                    No folders yet. Create one first!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

