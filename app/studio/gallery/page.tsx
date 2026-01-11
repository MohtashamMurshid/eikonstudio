"use client"

import { useState, useCallback, useMemo } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { LogoLoader } from "@/components/logo-icon"
import { DragOverlay } from "@/components/image-combiner/components/drag-overlay"
import { 
  FolderGrid, 
  GalleryHeader, 
  ImageGrid,
  UploadModal,
  CreateFolderModal,
  MoveFolderModal,
  FullImageModal,
  RenameModal,
  ConfirmModal,
  type GalleryImage, 
  type Folder 
} from "@/components/gallery"
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
  
  // Folder rename modal state
  const [folderRenameModal, setFolderRenameModal] = useState<{
    isOpen: boolean
    folderId: Id<"folders"> | null
    currentName: string
    error: string
    isLoading: boolean
  }>({
    isOpen: false,
    folderId: null,
    currentName: "",
    error: "",
    isLoading: false,
  })
  
  // Folder delete modal state
  const [folderDeleteModal, setFolderDeleteModal] = useState<{
    isOpen: boolean
    folderId: Id<"folders"> | null
    folderName: string
    imageCount: number
    isLoading: boolean
  }>({
    isOpen: false,
    folderId: null,
    folderName: "",
    imageCount: 0,
    isLoading: false,
  })
  
  // Move image error state
  const [moveError, setMoveError] = useState("")
  const [isMovingImage, setIsMovingImage] = useState(false)
  
  // Create folder loading state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  
  // Upload hook
  const uploadHook = useGalleryUpload(currentFolderId)
  
  // Operations hook
  const operationsHook = useGalleryOperations(generateUploadUrl, saveImage)

  // Get current folder info
  const currentFolder = useMemo(() => {
    if (!currentFolderId || !folders) return null
    return folders.find(f => f._id === currentFolderId) || null
  }, [currentFolderId, folders])

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
    
    setIsCreatingFolder(true)
    try {
      await createFolder({ name: newFolderName.trim() })
      setShowCreateFolderModal(false)
      setNewFolderName("")
      setFolderError("")
    } catch (error: any) {
      setFolderError(error.message || "Failed to create folder")
    } finally {
      setIsCreatingFolder(false)
    }
  }
  
  // Open folder rename modal
  const openFolderRenameModal = (folderId: Id<"folders">, currentName: string) => {
    setFolderRenameModal({
      isOpen: true,
      folderId,
      currentName,
      error: "",
      isLoading: false,
    })
  }
  
  // Close folder rename modal
  const closeFolderRenameModal = () => {
    setFolderRenameModal({
      isOpen: false,
      folderId: null,
      currentName: "",
      error: "",
      isLoading: false,
    })
  }
  
  // Confirm folder rename
  const confirmFolderRename = async (newName: string) => {
    if (!folderRenameModal.folderId) return
    
    const nameRegex = /^[a-zA-Z0-9_-]+$/
    if (!nameRegex.test(newName)) {
      setFolderRenameModal(prev => ({
        ...prev,
        error: "Folder name can only contain letters, numbers, hyphens, and underscores",
      }))
      return
    }
    
    setFolderRenameModal(prev => ({ ...prev, isLoading: true }))
    try {
      await renameFolder({ folderId: folderRenameModal.folderId, newName })
      closeFolderRenameModal()
    } catch (error: any) {
      setFolderRenameModal(prev => ({
        ...prev,
        error: error.message || "Failed to rename folder",
        isLoading: false,
      }))
    }
  }
  
  // Open folder delete modal
  const openFolderDeleteModal = (folderId: Id<"folders">) => {
    const folder = folders?.find(f => f._id === folderId)
    if (!folder) return
    
    setFolderDeleteModal({
      isOpen: true,
      folderId,
      folderName: folder.name,
      imageCount: folder.imageCount || 0,
      isLoading: false,
    })
  }
  
  // Close folder delete modal
  const closeFolderDeleteModal = () => {
    setFolderDeleteModal({
      isOpen: false,
      folderId: null,
      folderName: "",
      imageCount: 0,
      isLoading: false,
    })
  }
  
  // Confirm folder delete
  const confirmFolderDelete = async () => {
    if (!folderDeleteModal.folderId) return
    
    setFolderDeleteModal(prev => ({ ...prev, isLoading: true }))
    try {
      await deleteFolder({ folderId: folderDeleteModal.folderId })
      if (currentFolderId === folderDeleteModal.folderId) {
        setCurrentFolderId(null)
      }
      closeFolderDeleteModal()
    } catch (error: any) {
      // Keep modal open on error so user can see something went wrong
      setFolderDeleteModal(prev => ({ ...prev, isLoading: false }))
    }
  }
  
  const handleMoveImage = async (targetFolderId: Id<"folders"> | undefined) => {
    if (!imageToMove) return
    
    setMoveError("")
    setIsMovingImage(true)
    try {
      await moveImageToFolder({ imageId: imageToMove, folderId: targetFolderId })
      setShowMoveModal(false)
      setImageToMove(null)
    } catch (error: any) {
      setMoveError(error.message || "Failed to move image")
    } finally {
      setIsMovingImage(false)
    }
  }
  
  const openMoveModal = (imageId: Id<"gallery">) => {
    setImageToMove(imageId)
    setMoveError("")
    setShowMoveModal(true)
  }

  if (images === undefined) {
    return (
      <div className="p-3 sm:p-4 md:p-6 min-h-screen">
        <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
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
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <div className="space-y-4">
          {/* Header */}
          <GalleryHeader
            currentFolder={currentFolder}
            currentFolderId={currentFolderId}
            foldersCount={folders?.length || 0}
            uncategorizedImagesCount={uncategorizedImages.length}
            currentViewImagesCount={currentViewImages.length}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onNavigateToRoot={() => setCurrentFolderId(null)}
            onCreateFolder={() => setShowCreateFolderModal(true)}
            onUploadClick={() => uploadHook.fileInputRef.current?.click()}
            uploadProgress={uploadHook.uploadProgress}
            isUploading={uploadHook.isUploading}
            fileInputRef={uploadHook.fileInputRef}
            onFileSelect={uploadHook.handleFileSelect}
          />

          {uploadHook.uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {uploadHook.uploadError}
            </div>
          )}

          {/* Content based on navigation state */}
          {currentFolderId ? (
            <ImageGrid
              images={filteredCurrentViewImages}
              onRename={operationsHook.openRenameModal}
              onDelete={operationsHook.openDeleteModal}
              onViewFull={operationsHook.setSelectedImage}
              onMove={openMoveModal}
              deletingId={operationsHook.deletingId}
              renamingId={operationsHook.renamingId}
              movingId={imageToMove}
              showFolderBadge={false}
              emptyState={{
                searchTerm: searchTerm || undefined,
                message: searchTerm ? undefined : `Upload images to this folder to use them with @${currentFolder?.name}`,
                actionLabel: searchTerm ? undefined : "Upload Image",
                onAction: searchTerm ? undefined : () => uploadHook.fileInputRef.current?.click(),
              }}
            />
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
                  <FolderGrid
                    folders={filteredFolders || []}
                    onFolderOpen={setCurrentFolderId}
                    onFolderRename={openFolderRenameModal}
                    onFolderDelete={openFolderDeleteModal}
                  />

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
                        <ImageGrid
                          images={filteredUncategorizedImages}
                          onRename={operationsHook.openRenameModal}
                          onDelete={operationsHook.openDeleteModal}
                          onViewFull={operationsHook.setSelectedImage}
                          onMove={openMoveModal}
                          deletingId={operationsHook.deletingId}
                          renamingId={operationsHook.renamingId}
                          movingId={imageToMove}
                          showFolderBadge={false}
                          emptyState={{
                            searchTerm: searchTerm || undefined,
                          }}
                        />
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
          onRename={operationsHook.openRenameModal}
          onDelete={operationsHook.openDeleteModal}
          onMove={openMoveModal}
        />

        <CreateFolderModal
          isOpen={showCreateFolderModal}
          folderName={newFolderName}
          error={folderError}
          isLoading={isCreatingFolder}
          onClose={() => {
            if (!isCreatingFolder) {
              setShowCreateFolderModal(false)
              setNewFolderName("")
              setFolderError("")
            }
          }}
          onFolderNameChange={setNewFolderName}
          onConfirm={handleCreateFolder}
        />

        <MoveFolderModal
          isOpen={showMoveModal}
          folders={folders}
          isLoading={isMovingImage}
          error={moveError}
          onClose={() => {
            if (!isMovingImage) {
              setShowMoveModal(false)
              setImageToMove(null)
              setMoveError("")
            }
          }}
          onMove={handleMoveImage}
        />
        
        {/* Image Rename Modal */}
        <RenameModal
          isOpen={operationsHook.renameModal.isOpen}
          currentName={operationsHook.renameModal.currentName}
          itemType="image"
          error={operationsHook.renameModal.error}
          isLoading={operationsHook.renamingId !== null}
          onClose={operationsHook.closeRenameModal}
          onConfirm={operationsHook.confirmRename}
        />
        
        {/* Image Delete Modal */}
        <ConfirmModal
          isOpen={operationsHook.deleteModal.isOpen}
          title="Delete Image"
          message="Are you sure you want to delete this reference image? This action cannot be undone."
          confirmText="Delete"
          isDangerous={true}
          isLoading={operationsHook.deletingId !== null}
          onClose={operationsHook.closeDeleteModal}
          onConfirm={operationsHook.confirmDelete}
        />
        
        {/* Folder Rename Modal */}
        <RenameModal
          isOpen={folderRenameModal.isOpen}
          currentName={folderRenameModal.currentName}
          itemType="folder"
          error={folderRenameModal.error}
          isLoading={folderRenameModal.isLoading}
          onClose={closeFolderRenameModal}
          onConfirm={confirmFolderRename}
        />
        
        {/* Folder Delete Modal */}
        <ConfirmModal
          isOpen={folderDeleteModal.isOpen}
          title="Delete Folder"
          message={
            folderDeleteModal.imageCount > 0
              ? `This will delete the folder "${folderDeleteModal.folderName}" and all ${folderDeleteModal.imageCount} image${folderDeleteModal.imageCount !== 1 ? "s" : ""} inside. This action cannot be undone.`
              : `Delete folder "${folderDeleteModal.folderName}"? This action cannot be undone.`
          }
          confirmText="Delete"
          isDangerous={true}
          isLoading={folderDeleteModal.isLoading}
          onClose={closeFolderDeleteModal}
          onConfirm={confirmFolderDelete}
        />
      </div>
    </div>
  )
}
