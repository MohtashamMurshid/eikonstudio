import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { IMAGE_MODEL_OPTIONS, type ImageModelId } from "../constants"

interface ControlsBarProps {
  imageModel: ImageModelId
  aspectRatio: string
  imageSize: string
  canGenerate: boolean
  isLoading: boolean
  isConvertingHeic: boolean
  onImageModelChange: (value: ImageModelId) => void
  onAspectRatioChange: (value: string) => void
  onImageSizeChange: (value: string) => void
  onGenerate: () => void
  onAddImages: () => void
}

export function ControlsBar({
  imageModel,
  aspectRatio,
  imageSize,
  canGenerate,
  isLoading,
  isConvertingHeic,
  onImageModelChange,
  onAspectRatioChange,
  onImageSizeChange,
  onGenerate,
  onAddImages,
}: ControlsBarProps) {
  const selectedModelMeta =
    IMAGE_MODEL_OPTIONS.find((o) => o.id === imageModel) ?? IMAGE_MODEL_OPTIONS[0]

  return (
    <div className="px-2.5 sm:px-4 pb-2.5 sm:pb-4 flex flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0 flex-1">
        {/* Model — closed: logo only; open: logo + full name per option */}
        <Select value={imageModel} onValueChange={(v) => onImageModelChange(v as ImageModelId)}>
          <SelectTrigger
            title={selectedModelMeta.label}
            aria-label={`Image model: ${selectedModelMeta.label}`}
            className="h-8 min-w-[2.75rem] shrink-0 px-1 sm:px-1.5 bg-secondary/50 border-0 text-foreground text-xs gap-0.5 rounded-lg hover:bg-secondary transition-colors justify-between *:data-[slot=select-value]:sr-only *:data-[slot=select-value]:w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:overflow-hidden *:data-[slot=select-value]:p-0"
          >
            <img
              src={selectedModelMeta.logo}
              alt=""
              width={18}
              height={18}
              className={cn(
                "size-[18px] shrink-0 object-contain pointer-events-none",
                selectedModelMeta.logoClassName,
              )}
            />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground min-w-[200px]">
            {IMAGE_MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <img
                    src={opt.logo}
                    alt=""
                    width={16}
                    height={16}
                    className={cn("size-4 shrink-0 object-contain", opt.logoClassName)}
                  />
                  <span className="truncate">{opt.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      </div>

      {/* Generate Button */}
      <Button
        onClick={onGenerate}
        disabled={!canGenerate || isLoading || isConvertingHeic}
        aria-label="Generate"
        className="shrink-0 h-8 w-8 sm:w-auto sm:px-4 p-0 rounded-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-colors"
      >
        {isConvertingHeic || isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </>
        )}
      </Button>
    </div>
  )
}

