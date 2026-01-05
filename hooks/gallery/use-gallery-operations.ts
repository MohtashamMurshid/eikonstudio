import { useState, useCallback } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { dataUrlToBlob, createThumbnailBlob, uploadToStorage } from "@/utils/gallery/image-utils"
import type { GalleryImage } from "@/components/gallery/types"

export function useGalleryOperations(
  generateUploadUrl: () => Promise<string>,
  saveImage: (args: {
    filename: string
    imageStorageId: Id<"_storage">
    thumbnailStorageId: Id<"_storage">
    folderId?: Id<"folders">
  }) => Promise<void>
) {
  const [deletingId, setDeletingId] = useState<Id<"gallery"> | null>(null)
  const [renamingId, setRenamingId] = useState<Id<"gallery"> | null>(null)
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)

  const renameImage = useMutation(api.gallery.renameImage)
  const deleteImage = useMutation(api.gallery.deleteImage)

  const handleRename = useCallback(async (id: Id<"gallery">, currentName: string) => {
    const newName = prompt("Enter new filename:", currentName)
    if (!newName || newName === currentName) return
    
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
    handleRename,
    handleDelete,
    handleUploadConfirm,
  }
}

