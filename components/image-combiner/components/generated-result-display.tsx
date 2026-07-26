import { useEffect, useState } from "react"
import { ProgressBar } from "./progress-bar"
import type { GeneratedImage } from "../types"

interface GeneratedResultDisplayProps {
  isLoading: boolean
  isConvertingHeic: boolean
  progress: number
  heicProgress: number
  generatedImage: GeneratedImage | null
  isAddingToGallery: boolean
  isSavingToHistory?: boolean
  onNewGeneration: () => void
  onAddToGallery: () => void
  onUseAsInput: () => void
  onCopy: () => void
  onDownload: () => void
  onFullscreen: () => void
}

export function GeneratedResultDisplay({
  isLoading,
  isConvertingHeic,
  progress,
  heicProgress,
  generatedImage,
  isAddingToGallery,
  isSavingToHistory,
  onNewGeneration,
  onAddToGallery,
  onUseAsInput,
  onCopy,
  onDownload,
  onFullscreen,
}: GeneratedResultDisplayProps) {
  const [imageReady, setImageReady] = useState(false)

  useEffect(() => {
    if (generatedImage?.url) {
      setImageReady(false)
    }
  }, [generatedImage?.url])

  if (!isLoading && !isConvertingHeic && !generatedImage) {
    return null
  }

  return (
    <div className="w-full mt-4 sm:mt-8">
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]">
            <ProgressBar progress={progress} />
          </div>
        ) : isConvertingHeic ? (
          <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]">
            <ProgressBar progress={heicProgress} label="Converting HEIC image..." />
          </div>
        ) : generatedImage ? (
          <div className="p-3 sm:p-4">
            {/* Image Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-foreground/60">Generated Image</span>
                {isSavingToHistory && (
                  <div className="flex items-center gap-1.5 text-xs text-foreground/50">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <button
                  onClick={onNewGeneration}
                  className="h-7 sm:h-8 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground text-xs sm:text-sm transition-colors"
                  title="New Generation"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New</span>
                </button>
                <button
                  onClick={onAddToGallery}
                  disabled={isAddingToGallery}
                  className="h-7 sm:h-8 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 hover:text-emerald-700 text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Add to Gallery"
                >
                  {isAddingToGallery ? (
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span>{isAddingToGallery ? "Adding..." : "Add to Gallery"}</span>
                </button>
                <div className="w-px h-4 sm:h-5 bg-border hidden sm:block" />
                <button
                  onClick={onUseAsInput}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                  title="Use as Input"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </button>
                <button
                  onClick={onCopy}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                  title="Copy"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.5} />
                    <path strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
                <button
                  onClick={onDownload}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                  title="Download"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={onFullscreen}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 text-foreground/60 hover:text-foreground transition-colors"
                  title="Fullscreen"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Image Display */}
            <div
              className="relative flex items-center justify-center cursor-pointer group min-h-[200px] sm:min-h-[280px] w-full"
              onClick={onFullscreen}
            >
              {!imageReady && (
                <div
                  className="absolute inset-0 mx-auto max-w-full max-h-[300px] sm:max-h-[500px] rounded-lg sm:rounded-xl bg-muted animate-pulse"
                  aria-hidden
                />
              )}
              <img
                src={generatedImage.url || "/placeholder.svg"}
                alt="Generated"
                onLoad={() => setImageReady(true)}
                onError={() => setImageReady(true)}
                className={`relative z-[1] max-w-full max-h-[300px] sm:max-h-[500px] object-contain rounded-lg sm:rounded-xl transition-opacity duration-300 ${
                  imageReady ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>

            {/* Prompt Display */}
            <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-secondary/30 rounded-lg sm:rounded-xl">
              <p className="text-xs sm:text-sm text-foreground/70">
                <span className="font-medium text-foreground/90">Prompt:</span> {generatedImage.prompt}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

