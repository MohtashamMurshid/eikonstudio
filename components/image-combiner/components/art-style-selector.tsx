import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { predefinedArtStyles } from "../constants"

interface ArtStyleSelectorProps {
  selectedArtStyle: string
  customArtStyles: string[]
  onArtStyleChange: (style: string) => void
  onAddCustomStyle: (style: string) => void
}

export function ArtStyleSelector({
  selectedArtStyle,
  customArtStyles,
  onArtStyleChange,
  onAddCustomStyle,
}: ArtStyleSelectorProps) {
  const [showCustomStyleInput, setShowCustomStyleInput] = useState(false)
  const [customStyleInput, setCustomStyleInput] = useState<string>("")

  const handleArtStyleChange = (value: string) => {
    if (value === "custom") {
      setShowCustomStyleInput(true)
      onArtStyleChange("")
    } else if (value === "none") {
      onArtStyleChange("")
    } else {
      onArtStyleChange(value)
      setShowCustomStyleInput(false)
    }
  }

  const handleAddCustomStyle = () => {
    const trimmedStyle = customStyleInput.trim()
    if (trimmedStyle && !customArtStyles.includes(trimmedStyle) && !predefinedArtStyles.includes(trimmedStyle)) {
      onAddCustomStyle(trimmedStyle)
      onArtStyleChange(trimmedStyle)
      setCustomStyleInput("")
      setShowCustomStyleInput(false)
    } else if (trimmedStyle && (customArtStyles.includes(trimmedStyle) || predefinedArtStyles.includes(trimmedStyle))) {
      // Error handling should be done by parent
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedArtStyle || "none"} onValueChange={handleArtStyleChange}>
          <SelectTrigger className="w-full sm:w-auto min-w-[160px] bg-white border-border text-foreground text-sm h-9">
            <SelectValue placeholder="Art Style (optional)" />
          </SelectTrigger>
          <SelectContent className="bg-white border-border text-foreground max-h-[300px]">
            <SelectItem value="none" className="text-sm">
              None
            </SelectItem>
            {predefinedArtStyles.map((style) => (
              <SelectItem key={style} value={style} className="text-sm">
                {style}
              </SelectItem>
            ))}
            {customArtStyles.length > 0 && (
              <>
                <SelectSeparator className="bg-border" />
                {customArtStyles.map((style) => (
                  <SelectItem key={style} value={style} className="text-sm italic">
                    {style} (Custom)
                  </SelectItem>
                ))}
              </>
            )}
            <SelectSeparator className="bg-border" />
            <SelectItem value="custom" className="text-sm text-emerald-600 font-medium">
              + Add Custom Style
            </SelectItem>
          </SelectContent>
        </Select>
        {selectedArtStyle && (
          <button
            onClick={() => onArtStyleChange("")}
            className="text-xs text-foreground/50 hover:text-foreground transition-colors flex items-center gap-1"
            title="Clear art style"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Custom Style Input */}
      {showCustomStyleInput && (
        <div className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
          <input
            type="text"
            value={customStyleInput}
            onChange={(e) => setCustomStyleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddCustomStyle()
              } else if (e.key === "Escape") {
                setShowCustomStyleInput(false)
                setCustomStyleInput("")
              }
            }}
            placeholder="Enter custom art style..."
            className="flex-1 p-2.5 bg-white border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 rounded-lg select-text transition-colors"
            autoFocus
          />
          <Button
            onClick={handleAddCustomStyle}
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          >
            Add
          </Button>
          <button
            onClick={() => {
              setShowCustomStyleInput(false)
              setCustomStyleInput("")
            }}
            className="text-foreground/50 hover:text-foreground transition-colors p-1"
            title="Cancel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
