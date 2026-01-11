"use client"

import { useState, useEffect } from "react"

interface RenameModalProps {
  isOpen: boolean
  currentName: string
  itemType: "image" | "folder"
  error?: string
  isLoading?: boolean
  onClose: () => void
  onConfirm: (newName: string) => void
}

export function RenameModal({
  isOpen,
  currentName,
  itemType,
  error,
  isLoading,
  onClose,
  onConfirm,
}: RenameModalProps) {
  const [newName, setNewName] = useState(currentName)
  const [localError, setLocalError] = useState("")

  // Reset state when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setNewName(currentName)
      setLocalError("")
    }
  }, [isOpen, currentName])

  const handleConfirm = () => {
    if (!newName.trim()) {
      setLocalError(`Please enter a ${itemType} name`)
      return
    }

    const nameRegex = /^[a-zA-Z0-9_-]+$/
    if (!nameRegex.test(newName)) {
      setLocalError("Name can only contain letters, numbers, hyphens, and underscores")
      return
    }

    if (newName === currentName) {
      onClose()
      return
    }

    setLocalError("")
    onConfirm(newName)
  }

  if (!isOpen) return null

  const displayError = error || localError

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">
            Rename {itemType === "image" ? "Image" : "Folder"}
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              New Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
                setLocalError("")
              }}
              placeholder={currentName}
              className="w-full h-10 px-3 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={50}
              autoFocus
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) handleConfirm()
                if (e.key === "Escape") onClose()
              }}
            />
            <p className="text-xs text-foreground/40 mt-1">
              Letters, numbers, hyphens, and underscores only
            </p>
          </div>
          
          {displayError && (
            <p className="text-sm text-red-600">{displayError}</p>
          )}
        </div>
        
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!newName.trim() || isLoading}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}

