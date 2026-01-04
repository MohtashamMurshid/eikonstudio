"use client"

import { useState, useCallback, useRef, memo, useEffect } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { LogoLoader } from "@/components/logo-icon"
import { validateImageFormat, compressImage, convertHeicToPng } from "@/components/image-combiner/utils/image-processing"

interface GalleryImage {
  _id: Id<"gallery">
  _creationTime: number
  userId: string
  filename: string
  imageData: string
  thumbnailData: string
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
  deletingId,
  renamingId,
}: {
  image: GalleryImage
  onRename: (id: Id<"gallery">, currentName: string) => void
  onDelete: (id: Id<"gallery">) => void
  onViewFull: (image: GalleryImage) => void
  deletingId: Id<"gallery"> | null
  renamingId: Id<"gallery"> | null
}) => {
  return (
    <div
      className="group relative bg-secondary/30 rounded-xl overflow-hidden border border-border hover:border-foreground/20 transition-all cursor-pointer"
      onClick={() => onViewFull(image)}
    >
      {/* Image */}
      <div className="aspect-square relative">
        <LazyImage
          src={image.thumbnailData}
          alt={image.filename}
          className="aspect-square relative"
        />
        
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
        <p className="text-xs font-medium text-foreground truncate" title={`@${image.filename}`}>
          @{image.filename}
        </p>
        <p className="text-[10px] text-foreground/40 mt-0.5">
          Use in prompt: @{image.filename}
        </p>
      </div>
    </div>
  )
})

GalleryCard.displayName = "GalleryCard"

// Create thumbnail from image data
const createThumbnail = async (imageDataUrl: string, size = 200): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      
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
      resolve(canvas.toDataURL("image/jpeg", 0.7))
    }
    img.src = imageDataUrl
  })
}

export default function GalleryPage() {
  const images = useQuery(api.gallery.getMyImages, { limit: 100 }) as GalleryImage[] | undefined
  const saveImage = useMutation(api.gallery.saveImage)
  const renameImage = useMutation(api.gallery.renameImage)
  const deleteImage = useMutation(api.gallery.deleteImage)
  
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"gallery"> | null>(null)
  const [renamingId, setRenamingId] = useState<Id<"gallery"> | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFilename, setUploadFilename] = useState("")
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState("")
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
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
      // Create thumbnail
      const thumbnailData = await createThumbnail(uploadPreview)
      
      await saveImage({
        filename: uploadFilename.trim(),
        imageData: uploadPreview,
        thumbnailData,
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

  // Filter images by search term
  const filteredImages = images?.filter((img) =>
    img.filename.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      <div className="bg-white rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Reference Gallery</h2>
              <p className="text-sm text-foreground/50 mt-1">
                {images.length} image{images.length !== 1 ? "s" : ""} • Use @filename in prompts to reference images
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 sm:w-64 h-10 pl-9 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              
              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-10 px-4 flex items-center gap-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
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
                    <span className="hidden sm:inline">Upload Image</span>
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
            </div>
          ) : filteredImages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <p className="text-foreground/50">No images match "{searchTerm}"</p>
            </div>
          ) : (
            /* Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredImages?.map((image) => (
                <GalleryCard
                  key={image._id}
                  image={image}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onViewFull={setSelectedImage}
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
                
                {/* Preview mention syntax */}
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-foreground/50 mb-1">Use in prompts:</p>
                  <code className="text-sm text-emerald-600 font-mono">@{uploadFilename || "filename"}</code>
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
                    src={selectedImage.imageData}
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
      </div>
    </div>
  )
}

