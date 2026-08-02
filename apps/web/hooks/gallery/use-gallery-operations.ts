import { useState, useCallback } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { dataUrlToBlob, createThumbnailBlob, uploadToStorage } from "@/utils/gallery/image-utils"
import type { GalleryImage } from "@/components/gallery/types"

interface RenameModalState {
  isOpen: boolean
  id: Id<"gallery"> | null
  currentName: string
  error: string
}

interface DeleteModalState {
  isOpen: boolean
  id: Id<"gallery"> | null
}

/**
 * Hook for gallery operations
 * @param generateUploadUrl - The function to generate a upload URL for the image
 * @param saveImage - The function to save the image to the gallery
 * @returns The gallery operations hook
 */
export function useGalleryOperations(
  generateUploadUrl: () => Promise<string>,
  saveImage: (args: {
    filename: string
    imageStorageId: Id<"_storage">
    thumbnailStorageId: Id<"_storage">
    folderId?: Id<"folders">
  }) => Promise<unknown>
) {
  const [deletingId, setDeletingId] = useState<Id<"gallery"> | null>(null)
  const [renamingId, setRenamingId] = useState<Id<"gallery"> | null>(null)
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  
  // Modal states
  const [renameModal, setRenameModal] = useState<RenameModalState>({
    isOpen: false,
    id: null,
    currentName: "",
    error: "",
  })
  
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    id: null,
  })

  const renameImage = useMutation(api.gallery.renameImage)
  const deleteImage = useMutation(api.gallery.deleteImage)

  // Open rename modal
  const openRenameModal = useCallback((id: Id<"gallery">, currentName: string) => {
    setRenameModal({
      isOpen: true,
      id,
      currentName,
      error: "",
    })
  }, [])

  // Close rename modal
  const closeRenameModal = useCallback(() => {
    setRenameModal({
      isOpen: false,
      id: null,
      currentName: "",
      error: "",
    })
  }, [])

  // Confirm rename
  const confirmRename = useCallback(async (newName: string) => {
    if (!renameModal.id) return
    
    const filenameRegex = /^[a-zA-Z0-9_-]+$/
    if (!filenameRegex.test(newName)) {
      setRenameModal(prev => ({
        ...prev,
        error: "Filename can only contain letters, numbers, hyphens, and underscores",
      }))
      return
    }
    
    setRenamingId(renameModal.id)
    try {
      await renameImage({ imageId: renameModal.id, newFilename: newName })
      closeRenameModal()
    } catch (error: any) {
      console.error("Error renaming image:", error)
      setRenameModal(prev => ({
        ...prev,
        error: error.message || "Failed to rename image",
      }))
    } finally {
      setRenamingId(null)
    }
  }, [renameModal.id, renameImage, closeRenameModal])

  // Open delete modal
  const openDeleteModal = useCallback((id: Id<"gallery">) => {
    setDeleteModal({
      isOpen: true,
      id,
    })
  }, [])

  // Close delete modal
  const closeDeleteModal = useCallback(() => {
    setDeleteModal({
      isOpen: false,
      id: null,
    })
  }, [])

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    if (!deleteModal.id) return
    
    setDeletingId(deleteModal.id)
    try {
      await deleteImage({ imageId: deleteModal.id })
      setSelectedImage((prev) => (prev?._id === deleteModal.id ? null : prev))
      closeDeleteModal()
    } catch (error) {
      console.error("Error deleting image:", error)
      // Keep modal open on error, user can retry or cancel
    } finally {
      setDeletingId(null)
    }
  }, [deleteModal.id, deleteImage, closeDeleteModal])

  const handleUploadConfirm = useCallback(async (
    uploadPreview: string,
    uploadFilename: string,
    uploadFolderId: Id<"folders"> | undefined
  ) => {
    if (!uploadPreview || !uploadFilename.trim()) {
      throw new Error("Please enter a filename")
    }
    
    const filenameRegex = /^[a-zA-Z0-9_-]+$/
    if (!filenameRegex.test(uploadFilename)) {
      throw new Error("Filename can only contain letters, numbers, hyphens, and underscores")
    }
    
    const imageBlob = await dataUrlToBlob(uploadPreview)
    const thumbnailBlob = await createThumbnailBlob(uploadPreview)
    
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
  }, [generateUploadUrl, saveImage])

  return {
    deletingId,
    renamingId,
    selectedImage,
    setSelectedImage,
    // Rename modal
    renameModal,
    openRenameModal,
    closeRenameModal,
    confirmRename,
    // Delete modal
    deleteModal,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete,
    // Upload
    handleUploadConfirm,
  }
}
