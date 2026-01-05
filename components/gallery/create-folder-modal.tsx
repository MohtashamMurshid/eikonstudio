"use client"

interface CreateFolderModalProps {
  isOpen: boolean
  folderName: string
  error: string
  onClose: () => void
  onFolderNameChange: (name: string) => void
  onConfirm: () => void
}

export function CreateFolderModal({
  isOpen,
  folderName,
  error,
  onClose,
  onFolderNameChange,
  onConfirm,
}: CreateFolderModalProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Create Folder</h3>
          <button
            onClick={onClose}
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
              value={folderName}
              onChange={(e) => {
                onFolderNameChange(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
              }}
              placeholder="my-folder"
              className="w-full h-10 px-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={30}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirm()
              }}
            />
            <p className="text-xs text-foreground/40 mt-1">
              Max 4 images per folder. Use @{folderName || "folder"} to load all images.
            </p>
          </div>
          
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!folderName.trim()}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            Create Folder
          </button>
        </div>
      </div>
    </div>
  )
}

