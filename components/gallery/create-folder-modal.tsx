"use client"

interface CreateFolderModalProps {
  isOpen: boolean
  folderName: string
  error: string
  isLoading?: boolean
  onClose: () => void
  onFolderNameChange: (name: string) => void
  onConfirm: () => void
}

export function CreateFolderModal({
  isOpen,
  folderName,
  error,
  isLoading = false,
  onClose,
  onFolderNameChange,
  onConfirm,
}: CreateFolderModalProps) {
  if (!isOpen) return null

  const handleClose = () => {
    if (!isLoading) {
      onClose()
    }
  }

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-card rounded-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Create Folder</h3>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="w-full h-10 px-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              maxLength={30}
              autoFocus
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) handleConfirm()
                if (e.key === "Escape" && !isLoading) handleClose()
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
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!folderName.trim() || isLoading}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isLoading ? "Creating..." : "Create Folder"}
          </button>
        </div>
      </div>
    </div>
  )
}

