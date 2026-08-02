"use client"

import { memo } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { Folder } from "./types"
import { FolderCard } from "./folder-card"

interface FolderGridProps {
  folders: Folder[]
  onFolderOpen: (folderId: Id<"folders">) => void
  onFolderRename: (folderId: Id<"folders">, currentName: string) => void
  onFolderDelete: (folderId: Id<"folders">) => void
}

export const FolderGrid = memo(({
  folders,
  onFolderOpen,
  onFolderRename,
  onFolderDelete,
}: FolderGridProps) => {
  if (folders.length === 0) {
    return null
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-3">
        Folders
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {folders.map((folder) => (
          <FolderCard
            key={folder._id}
            folder={folder}
            onOpen={() => onFolderOpen(folder._id)}
            onRename={() => onFolderRename(folder._id, folder.name)}
            onDelete={() => onFolderDelete(folder._id)}
          />
        ))}
      </div>
    </div>
  )
})

FolderGrid.displayName = "FolderGrid"

