"use client"

import { useState, useCallback, useMemo } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { LogoLoader } from "@/components/logo-icon"
import { DragOverlay } from "@/components/image-combiner/components/drag-overlay"
import { Breadcrumb } from "@/components/gallery/breadcrumb"
import { FolderCard } from "@/components/gallery/folder-card"
import { GalleryCard } from "@/components/gallery/gallery-card"
import { UploadModal } from "@/components/gallery/upload-modal"
import { CreateFolderModal } from "@/components/gallery/create-folder-modal"
import { MoveFolderModal } from "@/components/gallery/move-folder-modal"
import { FullImageModal } from "@/components/gallery/full-image-modal"
import type { GalleryImage, Folder } from "@/components/gallery/types"
import { useGalleryUpload } from "@/hooks/gallery/use-gallery-upload"
import { useGalleryOperations } from "@/hooks/gallery/use-gallery-operations"

export default function GalleryPage() {
  const images = useQuery(api.gallery.getMyImages, { limit: 100 }) as GalleryImage[] | undefined
  const folders = useQuery(api.gallery.getMyFolders, {}) as Folder[] | undefined
  const generateUploadUrl = useMutation(api.gallery.generateUploadUrl)
  const saveImage = useMutation(api.gallery.saveImage)
  const createFolder = useMutation(api.gallery.createFolder)
  const renameFolder = useMutation(api.gallery.renameFolder)
  const deleteFolder = useMutation(api.gallery.deleteFolder)
  const moveImageToFolder = useMutation(api.gallery.moveImageToFolder)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [currentFolderId, setCurrentFolderId] = useState<Id<"folders"> | null>(null)
  const [uncategorizedExpanded, setUncategorizedExpanded] = useState(true)
  
  // Folder modals
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [folderError, setFolderError] = useState("")
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [imageToMove, setImageToMove] = useState<Id<"gallery"> | null>(null)
  
  // Upload hook
  const uploadHook = useGalleryUpload(currentFolderId)
  
  // Operations hook
  const operationsHook = useGalleryOperations(generateUploadUrl, saveImage)

  // Get current folder info
  const currentFolder = useMemo(() => {
    if (!currentFolderId || !folders) return null
    return folders.find(f => f._id === currentFolderId) || null
  }, [currentFolderId, folders])

  // Get images grouped by folder for previews
  const imagesByFolder = useMemo(() => {
    if (!images) return new Map<Id<"folders">, GalleryImage[]>()
    const map = new Map<Id<"folders">, GalleryImage[]>()
    images.forEach(img => {
      if (img.folderId) {
        const existing = map.get(img.folderId) || []
        map.set(img.folderId, [...existing, img])
      }
    })
    return map
  }, [images])

  // Get uncategorized images (no folder)
  const uncategorizedImages = useMemo(() => {
    if (!images) return []
    return images.filter(img => !img.folderId)
  }, [images])

  // Get images for current view
  const currentViewImages = useMemo(() => {
    if (!images) return []
    if (currentFolderId) {
      return images.filter(img => img.folderId === currentFolderId)
    }
    return []
  }, [images, currentFolderId])

  // Filter by search
  const filteredFolders = useMemo(() => {
    if (!folders || !searchTerm) return folders || []
    return folders.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [folders, searchTerm])

  const filteredUncategorizedImages = useMemo(() => {
    if (!searchTerm) return uncategorizedImages
    return uncategorizedImages.filter(img => 
      img.filename.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [uncategorizedImages, searchTerm])

  const filteredCurrentViewImages = useMemo(() => {
    if (!searchTerm) return currentViewImages
    return currentViewImages.filter(img => 
      img.filename.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [currentViewImages, searchTerm])

  // Upload handler
  const handleUploadConfirm = useCallback(async () => {
    try {
      await operationsHook.handleUploadConfirm(
        uploadHook.uploadPreview || "",
        uploadHook.uploadFilename,
        uploadHook.uploadFolderId
      )
      uploadHook.resetUploadState()
    } catch (error: any) {
      uploadHook.setUploadError(error.message || "Failed to save image")
    }
  }, [operationsHook, uploadHook])

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
      if (currentFolderId === folderId) {
        setCurrentFolderId(null)
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
      onDragEnter={uploadHook.handleDragEnter}
      onDragLeave={uploadHook.handleDragLeave}
      onDragOver={uploadHook.handleDragOver}
      onDrop={uploadHook.handleDrop}
    >
      <DragOverlay isDragOver={uploadHook.isDragOver} />
      <div className="bg-white rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Breadcrumb
                currentFolder={currentFolder}
                onNavigateToRoot={() => setCurrentFolderId(null)}
              />
              <p className="text-sm text-foreground/50 mt-1">
                {currentFolderId 
                  ? `${currentViewImages.length} image${currentViewImages.length !== 1 ? "s" : ""} in folder`
                  : `${folders?.length || 0} folder${(folders?.length || 0) !== 1 ? "s" : ""} • ${uncategorizedImages.length} loose image${uncategorizedImages.length !== 1 ? "s" : ""}`
                }
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {currentFolderId && (
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className="sm:hidden h-9 px-3 flex items-center gap-1.5 bg-secondary/50 hover:bg-secondary rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
              
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
              
              {!currentFolderId && (
                <button
                  onClick={() => setShowCreateFolderModal(true)}
                  className="h-9 px-3 flex items-center gap-2 bg-secondary/50 hover:bg-secondary rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">New Folder</span>
                </button>
              )}
              
              <button
                onClick={() => uploadHook.fileInputRef.current?.click()}
                disabled={uploadHook.isUploading}
                className="h-9 px-3 flex items-center gap-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {uploadHook.uploadProgress ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="hidden sm:inline">{uploadHook.uploadProgress}</span>
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
                ref={uploadHook.fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={uploadHook.handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {uploadHook.uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {uploadHook.uploadError}
            </div>
          )}

          {/* Content based on navigation state */}
          {currentFolderId ? (
            <>
              {filteredCurrentViewImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                  {searchTerm ? (
                    <p className="text-foreground/50">No images match "{searchTerm}"</p>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Empty folder</h3>
                      <p className="text-sm text-foreground/50 max-w-sm mb-4">
                        Upload images to this folder to use them with @{currentFolder?.name}
                      </p>
                      <button
                        onClick={() => uploadHook.fileInputRef.current?.click()}
                        className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
                      >
                        Upload Image
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredCurrentViewImages.map((image) => (
                    <GalleryCard
                      key={image._id}
                      image={image}
                      onRename={operationsHook.handleRename}
                      onDelete={operationsHook.handleDelete}
                      onViewFull={operationsHook.setSelectedImage}
                      onMove={openMoveModal}
                      deletingId={operationsHook.deletingId}
                      renamingId={operationsHook.renamingId}
                      showFolderBadge={false}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {images.length === 0 && (!folders || folders.length === 0) ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No reference images yet</h3>
                  <p className="text-sm text-foreground/50 max-w-sm mb-4">
                    Create folders to organize your images, or upload images directly.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreateFolderModal(true)}
                      className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
                    >
                      Create Folder
                    </button>
                    <button
                      onClick={() => uploadHook.fileInputRef.current?.click()}
                      className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
                    >
                      Upload Image
                    </button>
                  </div>
                  <p className="text-xs text-foreground/40 mt-4">
                    Or drag & drop images here, or paste from clipboard
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredFolders && filteredFolders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-3">
                        Folders
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {filteredFolders.map((folder) => (
                          <FolderCard
                            key={folder._id}
                            folder={folder}
                            previewImages={imagesByFolder.get(folder._id) || []}
                            onOpen={() => setCurrentFolderId(folder._id)}
                            onRename={() => handleRenameFolder(folder._id, folder.name)}
                            onDelete={() => handleDeleteFolder(folder._id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {(filteredUncategorizedImages.length > 0 || (searchTerm && uncategorizedImages.length > 0)) && (
                    <div>
                      <button
                        onClick={() => setUncategorizedExpanded(!uncategorizedExpanded)}
                        className="flex items-center gap-2 text-sm font-medium text-foreground/60 uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
                      >
                        <svg 
                          className={`w-4 h-4 transition-transform ${uncategorizedExpanded ? "rotate-90" : ""}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Uncategorized ({filteredUncategorizedImages.length})
                      </button>
                      
                      {uncategorizedExpanded && (
                        <>
                          {filteredUncategorizedImages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <p className="text-foreground/50">No images match "{searchTerm}"</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                              {filteredUncategorizedImages.map((image) => (
                                <GalleryCard
                                  key={image._id}
                                  image={image}
                                  onRename={operationsHook.handleRename}
                                  onDelete={operationsHook.handleDelete}
                                  onViewFull={operationsHook.setSelectedImage}
                                  onMove={openMoveModal}
                                  deletingId={operationsHook.deletingId}
                                  renamingId={operationsHook.renamingId}
                                  showFolderBadge={false}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {searchTerm && filteredFolders.length === 0 && filteredUncategorizedImages.length === 0 && (
                    <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                      <p className="text-foreground/50">No folders or images match "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modals */}
        <UploadModal
          isOpen={uploadHook.showUploadModal}
          preview={uploadHook.uploadPreview}
          filename={uploadHook.uploadFilename}
          folderId={uploadHook.uploadFolderId}
          folders={folders}
          error={uploadHook.uploadError}
          isUploading={uploadHook.isUploading}
          onClose={uploadHook.resetUploadState}
          onFilenameChange={uploadHook.setUploadFilename}
          onFolderChange={uploadHook.setUploadFolderId}
          onConfirm={async () => {
            uploadHook.setIsUploading(true)
            uploadHook.setUploadError("")
            try {
              await handleUploadConfirm()
            } catch (error: any) {
              uploadHook.setUploadError(error.message || "Failed to save image")
            } finally {
              uploadHook.setIsUploading(false)
            }
          }}
        />

        <FullImageModal
          image={operationsHook.selectedImage}
          deletingId={operationsHook.deletingId}
          onClose={() => operationsHook.setSelectedImage(null)}
          onRename={operationsHook.handleRename}
          onDelete={operationsHook.handleDelete}
          onMove={openMoveModal}
        />

        <CreateFolderModal
          isOpen={showCreateFolderModal}
          folderName={newFolderName}
          error={folderError}
          onClose={() => {
            setShowCreateFolderModal(false)
            setNewFolderName("")
            setFolderError("")
          }}
          onFolderNameChange={setNewFolderName}
          onConfirm={handleCreateFolder}
        />

        <MoveFolderModal
          isOpen={showMoveModal}
          folders={folders}
          onClose={() => {
            setShowMoveModal(false)
            setImageToMove(null)
          }}
          onMove={handleMoveImage}
        />
      </div>
    </div>
  )
}
