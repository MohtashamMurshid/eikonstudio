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
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedArtStyle || "none"} onValueChange={handleArtStyleChange}>
          <SelectTrigger className="w-full sm:w-auto min-w-[140px] bg-black/50 border-gray-600 text-white text-xs md:text-sm h-[26px] md:h-[34px]">
            <SelectValue placeholder="Art Style (optional)" />
          </SelectTrigger>
          <SelectContent className="bg-black/95 border-gray-600 text-white max-h-[300px]">
            <SelectItem value="none" className="text-xs md:text-sm">
              None
            </SelectItem>
            {predefinedArtStyles.map((style) => (
              <SelectItem key={style} value={style} className="text-xs md:text-sm">
                {style}
              </SelectItem>
            ))}
            {customArtStyles.length > 0 && (
              <>
                <SelectSeparator className="bg-gray-600" />
                {customArtStyles.map((style) => (
                  <SelectItem key={style} value={style} className="text-xs md:text-sm italic">
                    {style} (Custom)
                  </SelectItem>
                ))}
              </>
            )}
            <SelectSeparator className="bg-gray-600" />
            <SelectItem value="custom" className="text-xs md:text-sm text-emerald-400">
              + Add Custom Style
            </SelectItem>
          </SelectContent>
        </Select>
        {selectedArtStyle && (
          <button
            onClick={() => onArtStyleChange("")}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            title="Clear art style"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="flex-1 p-2 md:p-2.5 bg-black/50 border border-gray-600 text-white text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded select-text"
            autoFocus
          />
          <Button
            onClick={handleAddCustomStyle}
            variant="outline"
            size="sm"
            className="h-[26px] md:h-[34px] px-2 md:px-3 text-xs bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
          >
            Add
          </Button>
          <button
            onClick={() => {
              setShowCustomStyleInput(false)
              setCustomStyleInput("")
            }}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Cancel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

