import type { Id } from "@/convex/_generated/dataModel"

export interface GalleryImage {
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

export interface Folder {
  _id: Id<"folders">
  name: string
  imageCount: number
  isFull: boolean
  createdAt: number
}

