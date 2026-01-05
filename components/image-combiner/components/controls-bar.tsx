import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { predefinedArtStyles } from "../constants"

interface ControlsBarProps {
  aspectRatio: string
  imageSize: string
  selectedArtStyle: string
  canGenerate: boolean
  isLoading: boolean
  isConvertingHeic: boolean
  onAspectRatioChange: (value: string) => void
  onImageSizeChange: (value: string) => void
  onArtStyleChange: (value: string) => void
  onGenerate: () => void
  onAddImages: () => void
}

export function ControlsBar({
  aspectRatio,
  imageSize,
  selectedArtStyle,
  canGenerate,
  isLoading,
  isConvertingHeic,
  onAspectRatioChange,
  onImageSizeChange,
  onArtStyleChange,
  onGenerate,
  onAddImages,
}: ControlsBarProps) {
  return (
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {/* Add Images Button */}
        <button
          onClick={onAddImages}
          className="h-8 px-2 sm:px-2.5 flex items-center gap-1 sm:gap-1.5 bg-secondary/50 text-foreground text-xs rounded-lg hover:bg-secondary transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
            <polyline points="21,15 16,10 5,21" strokeWidth={1.5} />
          </svg>
          <span className="hidden sm:inline">Images</span>
        </button>

        {/* Aspect Ratio Dropdown */}
        <Select value={aspectRatio} onValueChange={onAspectRatioChange}>
          <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors">
            <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
            </svg>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="square" className="text-xs">1:1</SelectItem>
            <SelectItem value="portrait" className="text-xs">9:16</SelectItem>
            <SelectItem value="landscape" className="text-xs">16:9</SelectItem>
            <SelectItem value="wide" className="text-xs">21:9</SelectItem>
          </SelectContent>
        </Select>

        {/* Size Dropdown */}
        <Select value={imageSize} onValueChange={onImageSizeChange}>
          <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors">
            <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="1K" className="text-xs">1K</SelectItem>
            <SelectItem value="2K" className="text-xs">2K</SelectItem>
            <SelectItem value="4K" className="text-xs">4K</SelectItem>
          </SelectContent>
        </Select>

        {/* Art Style Dropdown */}
        <Select value={selectedArtStyle || "none"} onValueChange={(v) => onArtStyleChange(v === "none" ? "" : v)}>
          <SelectTrigger className="h-8 px-2 sm:px-2.5 bg-secondary/50 border-0 text-foreground text-xs gap-1 sm:gap-1.5 rounded-lg hover:bg-secondary transition-colors min-w-[70px] sm:min-w-[100px]">
            <svg className="w-3.5 h-3.5 text-foreground/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
            </svg>
            <SelectValue placeholder="Style" className="truncate" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground max-h-[300px]">
            <SelectItem value="none" className="text-xs">No Style</SelectItem>
            {predefinedArtStyles.map((style) => (
              <SelectItem key={style} value={style} className="text-xs">
                {style}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Generate Button */}
      <Button
        onClick={onGenerate}
        disabled={!canGenerate || isLoading || isConvertingHeic}
        className="h-10 sm:h-8 px-4 rounded-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-colors w-full sm:w-auto"
      >
        {isConvertingHeic ? (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <>
            <svg className="w-4 h-4 sm:mr-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="sm:hidden">Generate</span>
          </>
        )}
      </Button>
    </div>
  )
}

